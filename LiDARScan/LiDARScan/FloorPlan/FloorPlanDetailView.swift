import SwiftUI

/// Shows one floor plan. Add, move and edit device markers, and export PDF, PNG or USDZ.
struct FloorPlanDetailView: View {
    let projectID: UUID
    let scanID: UUID

    @Environment(ProjectStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var placingType: DeviceType?
    @State private var showDevicePicker = false
    @State private var editingMarker: DeviceMarker?
    @State private var shareItem: ShareItem?
    @State private var showDimensions = true
    @State private var showRename = false
    @State private var newName = ""
    @State private var confirmDelete = false
    @State private var exportError: String?

    private var project: Project? { store.project(id: projectID) }
    private var scan: FloorPlanScan? { store.floorPlan(id: scanID, in: projectID) }

    var body: some View {
        Group {
            if let project, let scan {
                content(project: project, scan: scan)
            } else {
                ContentUnavailableView("Floor plan not found", systemImage: "questionmark.folder")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func content(project: Project, scan: FloorPlanScan) -> some View {
        VStack(spacing: 0) {
            if let placingType {
                HStack(spacing: 12) {
                    Image(systemName: placingType.symbol)
                        .font(.title2.bold())
                    Text("Tap the plan to place \(placingType.displayName)")
                        .font(.headline)
                    Spacer()
                    Button("Cancel") { self.placingType = nil }
                        .font(.headline)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .background(.white.opacity(0.25), in: Capsule())
                }
                .foregroundStyle(.white)
                .padding()
                .background(placingType.color)
            }

            FloorPlanCanvasView(scan: scan,
                                showDimensions: showDimensions,
                                interactive: true,
                                onTapPlan: { point in placeMarker(at: point, in: scan) },
                                onTapMarker: { marker in
                                    if placingType == nil { editingMarker = marker }
                                },
                                onMoveMarker: { id, point in moveMarker(id, to: point, in: scan) })
                .background(Color.white)
                .environment(\.colorScheme, .light)

            if scan.elements.isEmpty {
                Text("No walls were detected in this scan.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .padding(.top, 8)
            }

            HStack(spacing: 12) {
                Button {
                    showDevicePicker = true
                } label: {
                    Label("Add Device", systemImage: "plus.circle.fill")
                }
                .buttonStyle(.big)

                Menu {
                    Button {
                        export { try FloorPlanExporter.pdf(project: project, scan: scan, showDimensions: showDimensions) }
                    } label: {
                        Label("PDF (plan + device list)", systemImage: "doc.richtext")
                    }
                    Button {
                        export { try FloorPlanExporter.png(project: project, scan: scan, showDimensions: showDimensions) }
                    } label: {
                        Label("PNG image", systemImage: "photo")
                    }
                    Button {
                        export { try FloorPlanExporter.usdz(project: project, scan: scan, store: store) }
                    } label: {
                        Label("3D model (USDZ)", systemImage: "cube")
                    }
                    .disabled(scan.modelFileName == nil)
                } label: {
                    Label("Export", systemImage: "square.and.arrow.up")
                }
                .menuStyle(.button)
                .buttonStyle(.big(.blue, filled: false))
            }
            .padding()
            .background(.bar)
        }
        .navigationTitle(scan.name)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Toggle(isOn: $showDimensions) {
                        Label("Show Dimensions", systemImage: "ruler")
                    }
                    Button {
                        newName = scan.name
                        showRename = true
                    } label: {
                        Label("Rename", systemImage: "pencil")
                    }
                    Divider()
                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        Label("Delete Floor Plan", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.title2)
                        .frame(minWidth: 44, minHeight: 44)
                }
            }
        }
        .sheet(isPresented: $showDevicePicker) {
            DevicePickerSheet { type in placingType = type }
        }
        .sheet(item: $editingMarker) { marker in
            MarkerEditorSheet(marker: marker,
                              onSave: { updated in saveMarker(updated, in: scan) },
                              onDelete: { removed in deleteMarker(removed, in: scan) })
        }
        .sheet(item: $shareItem) { item in
            ShareSheet(item: item)
        }
        .alert("Rename Floor Plan", isPresented: $showRename) {
            TextField("Name", text: $newName)
            Button("Save") {
                var updated = scan
                let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    updated.name = trimmed
                    store.updateFloorPlan(updated, in: projectID)
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Export failed", isPresented: Binding(get: { exportError != nil }, set: { if !$0 { exportError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(exportError ?? "")
        }
        .confirmationDialog("Delete \(scan.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete Floor Plan", role: .destructive) {
                store.deleteFloorPlan(id: scan.id, in: projectID)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes the plan, its \(scan.markers.count) devices and its 3D model. This can't be undone.")
        }
    }

    // MARK: Actions

    private func placeMarker(at point: PlanPoint, in scan: FloorPlanScan) {
        guard let type = placingType else { return }
        let number = scan.markers.filter { $0.type == type }.count + 1
        let marker = DeviceMarker(type: type, position: point, label: "\(type.code)-\(number)", note: "")
        var updated = scan
        updated.markers.append(marker)
        store.updateFloorPlan(updated, in: projectID)
        placingType = nil
        editingMarker = marker
    }

    private func moveMarker(_ id: UUID, to point: PlanPoint, in scan: FloorPlanScan) {
        var updated = scan
        guard let index = updated.markers.firstIndex(where: { $0.id == id }) else { return }
        updated.markers[index].position = point
        store.updateFloorPlan(updated, in: projectID)
    }

    private func saveMarker(_ marker: DeviceMarker, in scan: FloorPlanScan) {
        // Re-read the latest copy so edits made since the sheet opened aren't lost.
        guard var updated = store.floorPlan(id: scan.id, in: projectID),
              let index = updated.markers.firstIndex(where: { $0.id == marker.id }) else { return }
        updated.markers[index] = marker
        store.updateFloorPlan(updated, in: projectID)
    }

    private func deleteMarker(_ marker: DeviceMarker, in scan: FloorPlanScan) {
        guard var updated = store.floorPlan(id: scan.id, in: projectID) else { return }
        updated.markers.removeAll { $0.id == marker.id }
        store.updateFloorPlan(updated, in: projectID)
    }

    private func export(_ make: () throws -> URL?) {
        do {
            if let url = try make() {
                shareItem = ShareItem(urls: [url])
            } else {
                exportError = "There's no 3D model saved for this floor plan."
            }
        } catch {
            exportError = error.localizedDescription
        }
    }
}
