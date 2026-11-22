import Foundation
import Observation
import RoomPlan
import UIKit

/// Receives RoomCaptureView callbacks. RoomCaptureViewDelegate requires NSSecureCoding,
/// so this small object exists just to satisfy that and forward results.
final class RoomCaptureDelegateProxy: NSObject, RoomCaptureViewDelegate {
    var onProcessed: ((CapturedRoom?, Error?) -> Void)?

    override init() {
        super.init()
    }

    required init?(coder: NSCoder) {
        super.init()
    }

    func encode(with coder: NSCoder) {}

    static var supportsSecureCoding: Bool { true }

    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        true
    }

    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        onProcessed?(processedResult, error)
    }
}

/// Drives a RoomPlan scan of one room or several rooms in a row (a whole floor).
/// Rooms scanned back to back share one AR session, so they line up and can be merged.
@MainActor
@Observable
final class RoomScanController {
    enum Phase: Equatable {
        case scanning
        case processing
        case reviewing
        case finishing
        case failed(String)
    }

    struct Output {
        var elements: [PlanElement]
        var roomCount: Int
        var modelURL: URL?
        var roomDataURL: URL?
    }

    enum ScanError: LocalizedError {
        case noRooms
        var errorDescription: String? { "No rooms were captured." }
    }

    private(set) var phase: Phase = .scanning
    private(set) var rooms: [CapturedRoom] = []

    let captureView: RoomCaptureView
    private let proxy = RoomCaptureDelegateProxy()

    init() {
        captureView = RoomCaptureView(frame: .zero)
        captureView.delegate = proxy
        proxy.onProcessed = { [weak self] room, error in
            Task { @MainActor in
                self?.handleProcessed(room: room, error: error)
            }
        }
    }

    func startRoom() {
        var configuration = RoomCaptureSession.Configuration()
        configuration.isCoachingEnabled = true
        captureView.captureSession.run(configuration: configuration)
        phase = .scanning
    }

    /// Ends the current room but keeps the AR session alive so the next room lines up.
    func finishRoom() {
        phase = .processing
        captureView.captureSession.stop(pauseARSession: false)
    }

    func cancel() {
        captureView.captureSession.stop()
    }

    private func handleProcessed(room: CapturedRoom?, error: Error?) {
        if let room, error == nil || !room.walls.isEmpty {
            rooms.append(room)
            phase = .reviewing
        } else {
            phase = .failed(error?.localizedDescription ?? "RoomPlan couldn't process that room. Try again with slower, steadier movement.")
        }
    }

    /// Merges the rooms, builds the 2D plan and exports the 3D model to temporary files.
    func buildOutput() async throws -> Output {
        phase = .finishing
        captureView.captureSession.stop()

        guard !rooms.isEmpty else { throw ScanError.noRooms }

        let tempFolder = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: tempFolder, withIntermediateDirectories: true)
        let modelURL = tempFolder.appendingPathComponent("Model.usdz")
        let roomDataURL = tempFolder.appendingPathComponent("Rooms.json")

        var elements: [PlanElement] = []
        var exported = false

        if rooms.count > 1 {
            do {
                let builder = StructureBuilder(options: [.beautifyObjects])
                let structure = try await builder.capturedStructure(from: rooms)
                elements = FloorPlanBuilder.elements(from: structure)
                try structure.export(to: modelURL, exportOptions: .parametric)
                exported = true
            } catch {
                // Fall back to the raw rooms. They share one coordinate space, so they still line up.
                if elements.isEmpty {
                    elements = rooms.flatMap { FloorPlanBuilder.elements(from: $0) }
                }
            }
        } else if let room = rooms.first {
            elements = FloorPlanBuilder.elements(from: room)
            do {
                try room.export(to: modelURL, exportOptions: .parametric)
                exported = true
            } catch {
                exported = false
            }
        }

        var savedRoomData = false
        if let data = try? JSONEncoder().encode(rooms) {
            savedRoomData = (try? data.write(to: roomDataURL)) != nil
        }

        return Output(elements: elements,
                      roomCount: rooms.count,
                      modelURL: exported ? modelURL : nil,
                      roomDataURL: savedRoomData ? roomDataURL : nil)
    }

    func markFailed(_ message: String) {
        phase = .failed(message)
    }
}
