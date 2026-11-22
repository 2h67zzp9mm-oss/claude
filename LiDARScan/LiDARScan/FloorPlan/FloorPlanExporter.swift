import SwiftUI
import UIKit

/// Letter-size landscape sheet with a title block, the plan and a device legend.
struct FloorPlanSheetView: View {
    let project: Project
    let scan: FloorPlanScan
    var showDimensions: Bool = true

    private struct DeviceCount: Identifiable {
        let type: DeviceType
        let count: Int
        var id: DeviceType { type }
    }

    private var deviceCounts: [DeviceCount] {
        DeviceType.allCases.compactMap { type in
            let count = scan.markers.filter { $0.type == type }.count
            return count > 0 ? DeviceCount(type: type, count: count) : nil
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.name).font(.system(size: 18, weight: .bold))
                    if !project.address.isEmpty {
                        Text(project.address).font(.system(size: 11))
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(scan.name).font(.system(size: 13, weight: .semibold))
                    Text("Job date \(project.date.shortDate)  ·  Scanned \(scan.createdAt.shortDate)")
                        .font(.system(size: 9))
                    Text("Dimensions are approximate (LiDAR scan). Verify before install.")
                        .font(.system(size: 8))
                }
            }
            Divider().overlay(Color.black)

            FloorPlanCanvasView(scan: scan,
                                showDimensions: showDimensions,
                                markerDiameter: 18,
                                labelFontSize: 8,
                                padding: 24)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            if !deviceCounts.isEmpty {
                Divider().overlay(Color.black)
                HStack(spacing: 14) {
                    ForEach(deviceCounts) { item in
                        HStack(spacing: 4) {
                            ZStack {
                                Circle().fill(item.type.color)
                                Image(systemName: item.type.symbol)
                                    .font(.system(size: 6, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                            .frame(width: 12, height: 12)
                            Text("\(item.type.displayName) × \(item.count)")
                                .font(.system(size: 9))
                        }
                    }
                }
            }
        }
        .foregroundStyle(Color.black)
        .padding(28)
        .background(Color.white)
        .environment(\.colorScheme, .light)
    }
}

/// Table of every device with its label and note, for quoting.
struct DeviceScheduleView: View {
    let project: Project
    let scan: FloorPlanScan
    let markers: [DeviceMarker]
    let pageNumber: Int
    let pageCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Device Schedule: \(project.name), \(scan.name)")
                    .font(.system(size: 14, weight: .bold))
                Spacer()
                Text("Page \(pageNumber) of \(pageCount)").font(.system(size: 9))
            }
            .padding(.bottom, 8)
            row("#", "Label", "Type", "Note", header: true)
            ForEach(Array(markers.enumerated()), id: \.element.id) { index, marker in
                row("\(index + 1 + (pageNumber - 2) * DeviceScheduleView.rowsPerPage)",
                    marker.label, marker.type.displayName, marker.note, header: false)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color.black)
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.white)
        .environment(\.colorScheme, .light)
    }

    static let rowsPerPage = 24

    private func row(_ number: String, _ label: String, _ type: String, _ note: String, header: Bool) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(number).frame(width: 28, alignment: .leading)
            Text(label).frame(width: 130, alignment: .leading)
            Text(type).frame(width: 110, alignment: .leading)
            Text(note).frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(.system(size: 10, weight: header ? .bold : .regular))
        .lineLimit(2)
        .padding(.vertical, 4)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.black.opacity(header ? 0.8 : 0.15)).frame(height: header ? 1 : 0.5)
        }
    }
}

@MainActor
enum FloorPlanExporter {
    enum ExportError: LocalizedError {
        case renderFailed
        var errorDescription: String? { "Couldn't render the floor plan." }
    }

    /// US Letter landscape, in points.
    static let pageSize = CGSize(width: 792, height: 612)

    private static func exportFolder() throws -> URL {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("Exports", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    private static func baseName(project: Project, scan: FloorPlanScan) -> String {
        "\(project.name) - \(scan.name)".safeFileName
    }

    static func pdf(project: Project, scan: FloorPlanScan, showDimensions: Bool) throws -> URL {
        let url = try exportFolder().appendingPathComponent(baseName(project: project, scan: scan) + ".pdf")
        var mediaBox = CGRect(origin: .zero, size: pageSize)
        guard let consumer = CGDataConsumer(url: url as CFURL),
              let pdf = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
            throw ExportError.renderFailed
        }

        func addPage<Content: View>(_ content: Content) {
            let renderer = ImageRenderer(content: content.frame(width: pageSize.width, height: pageSize.height))
            renderer.render { _, draw in
                pdf.beginPDFPage(nil)
                draw(pdf)
                pdf.endPDFPage()
            }
        }

        addPage(FloorPlanSheetView(project: project, scan: scan, showDimensions: showDimensions))

        let pages = stride(from: 0, to: scan.markers.count, by: DeviceScheduleView.rowsPerPage).map {
            Array(scan.markers[$0..<min($0 + DeviceScheduleView.rowsPerPage, scan.markers.count)])
        }
        for (index, markers) in pages.enumerated() {
            addPage(DeviceScheduleView(project: project, scan: scan, markers: markers,
                                       pageNumber: index + 2, pageCount: pages.count + 1))
        }
        pdf.closePDF()
        return url
    }

    static func png(project: Project, scan: FloorPlanScan, showDimensions: Bool) throws -> URL {
        let url = try exportFolder().appendingPathComponent(baseName(project: project, scan: scan) + ".png")
        let renderer = ImageRenderer(content: FloorPlanSheetView(project: project, scan: scan, showDimensions: showDimensions)
            .frame(width: pageSize.width, height: pageSize.height))
        renderer.scale = 3
        guard let data = renderer.uiImage?.pngData() else { throw ExportError.renderFailed }
        try data.write(to: url, options: .atomic)
        return url
    }

    /// Copies the USDZ to a temp file with a readable name before sharing.
    static func usdz(project: Project, scan: FloorPlanScan, store: ProjectStore) throws -> URL? {
        guard let fileName = scan.modelFileName else { return nil }
        let source = store.fileURL(projectID: project.id, fileName: fileName)
        guard FileManager.default.fileExists(atPath: source.path) else { return nil }
        let url = try exportFolder().appendingPathComponent(baseName(project: project, scan: scan) + ".usdz")
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
        try FileManager.default.copyItem(at: source, to: url)
        return url
    }
}
