import SwiftUI
import RoomPlan

struct RoomCaptureContainer: UIViewRepresentable {
    let captureView: RoomCaptureView

    func makeUIView(context: Context) -> RoomCaptureView { captureView }
    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}
}

/// Full-screen RoomPlan scanner. Scan one room, then either scan the next room or finish.
struct RoomScanScreen: View {
    var onFinished: (RoomScanController.Output) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var controller: RoomScanController?
    @State private var confirmDiscard = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let controller {
                RoomCaptureContainer(captureView: controller.captureView)
                    .ignoresSafeArea()
                overlay(controller)
            }
        }
        .onAppear {
            if controller == nil {
                let newController = RoomScanController()
                controller = newController
                newController.startRoom()
            }
        }
        .confirmationDialog("Discard this scan?", isPresented: $confirmDiscard, titleVisibility: .visible) {
            Button("Discard Scan", role: .destructive) {
                controller?.cancel()
                dismiss()
            }
            Button("Keep Scanning", role: .cancel) {}
        } message: {
            Text("Rooms scanned so far will not be saved.")
        }
        .statusBarHidden()
    }

    @ViewBuilder
    private func overlay(_ controller: RoomScanController) -> some View {
        VStack(spacing: 12) {
            HStack {
                Button {
                    confirmDiscard = true
                } label: {
                    Label("Cancel", systemImage: "xmark")
                        .font(.headline)
                        .padding(.horizontal, 18)
                        .frame(minHeight: 48)
                        .background(.ultraThinMaterial, in: Capsule())
                }
                .disabled(controller.phase == .finishing)
                Spacer()
                Text(roomCountText(controller))
                    .font(.headline)
                    .padding(.horizontal, 18)
                    .frame(minHeight: 48)
                    .background(.ultraThinMaterial, in: Capsule())
            }
            .padding(.horizontal)
            .padding(.top, 8)

            Spacer()

            VStack(spacing: 12) {
                switch controller.phase {
                case .scanning:
                    Text("Walk slowly around the room. Point at every wall, door and window.")
                        .font(.callout)
                        .multilineTextAlignment(.center)
                    Button {
                        controller.finishRoom()
                    } label: {
                        Label("Done With This Room", systemImage: "checkmark.circle.fill")
                    }
                    .buttonStyle(.big(.green))

                case .processing:
                    ProgressView("Processing room…")
                        .font(.headline)
                        .frame(minHeight: 60)

                case .reviewing:
                    Button {
                        controller.startRoom()
                    } label: {
                        Label("Scan Next Room", systemImage: "plus.circle.fill")
                    }
                    .buttonStyle(.big(.blue, filled: false))
                    Button {
                        finish(controller)
                    } label: {
                        Label("Finish and Save", systemImage: "square.and.arrow.down.fill")
                    }
                    .buttonStyle(.big(.green))

                case .finishing:
                    ProgressView("Building floor plan…")
                        .font(.headline)
                        .frame(minHeight: 60)

                case .failed(let message):
                    Text(message)
                        .font(.callout)
                        .multilineTextAlignment(.center)
                    Button {
                        controller.startRoom()
                    } label: {
                        Label("Scan Room Again", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.big(.blue, filled: controller.rooms.isEmpty))
                    if !controller.rooms.isEmpty {
                        Button {
                            finish(controller)
                        } label: {
                            Label("Finish and Save", systemImage: "square.and.arrow.down.fill")
                        }
                        .buttonStyle(.big(.green))
                    }
                }
            }
            .padding()
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
    }

    private func roomCountText(_ controller: RoomScanController) -> String {
        let count = controller.rooms.count
        return count == 1 ? "1 room" : "\(count) rooms"
    }

    private func finish(_ controller: RoomScanController) {
        Task {
            do {
                let output = try await controller.buildOutput()
                onFinished(output)
                dismiss()
            } catch {
                controller.markFailed(error.localizedDescription)
            }
        }
    }
}
