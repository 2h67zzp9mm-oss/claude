import SwiftUI
import RoomPlan

struct FloorPlanRoute: Hashable {
    let projectID: UUID
    let scanID: UUID
}

struct FloorPlanTab: View {
    @Environment(ProjectStore.self) private var store

    @State private var path: [FloorPlanRoute] = []
    @State private var showScanner = false
    @State private var showProjectPicker = false
    @State private var pendingRoute: FloorPlanRoute?
    @State private var scanProjectID: UUID?

    private var isSupported: Bool { RoomCaptureSession.isSupported }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 16) {
                Button {
                    showProjectPicker = true
                } label: {
                    HStack {
                        Image(systemName: "folder.fill")
                            .font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(store.currentProject?.name ?? "No project selected")
                                .font(.title3.bold())
                                .lineLimit(1)
                            Text(projectSubtitle)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Text("Change")
                            .font(.headline)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, minHeight: 72)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.horizontal)

                if let project = store.currentProject, !project.floorPlans.isEmpty {
                    List {
                        ForEach(project.floorPlans.sorted { $0.createdAt > $1.createdAt }) { scan in
                            NavigationLink(value: FloorPlanRoute(projectID: project.id, scanID: scan.id)) {
                                FloorPlanRow(scan: scan)
                            }
                        }
                    }
                    .listStyle(.plain)
                } else {
                    Spacer()
                    ContentUnavailableView {
                        Label("No floor plans yet", systemImage: "square.split.bottomrightquarter")
                    } description: {
                        Text("Tap Scan Room below. You can scan one room or walk through several rooms to map a whole floor.")
                    }
                    Spacer()
                }

                VStack(spacing: 8) {
                    if !isSupported {
                        Text("RoomPlan needs a LiDAR iPhone. It won't run in the Simulator.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    Button {
                        startScan()
                    } label: {
                        Label("Scan Room", systemImage: "viewfinder")
                    }
                    .buttonStyle(.big)
                    .disabled(!isSupported)
                }
                .padding([.horizontal, .bottom])
            }
            .navigationTitle("Floor Plan")
            .navigationDestination(for: FloorPlanRoute.self) { route in
                FloorPlanDetailView(projectID: route.projectID, scanID: route.scanID)
            }
            .sheet(isPresented: $showProjectPicker) {
                ProjectPickerSheet()
            }
            .fullScreenCover(isPresented: $showScanner, onDismiss: {
                if let pendingRoute {
                    path.append(pendingRoute)
                    self.pendingRoute = nil
                }
            }) {
                RoomScanScreen { output in
                    saveScan(output)
                }
            }
        }
    }

    private var projectSubtitle: String {
        guard let project = store.currentProject else { return "Tap to pick or create a job" }
        let address = project.address.isEmpty ? "" : "\(project.address) · "
        return address + project.date.shortDate
    }

    private func startScan() {
        if store.currentProject == nil {
            // Fast path on site: make a job now, rename it later in Projects.
            store.createProject(name: "Untitled Job", address: "", date: Date())
        }
        scanProjectID = store.currentProjectID
        showScanner = true
    }

    private func saveScan(_ output: RoomScanController.Output) {
        guard let projectID = scanProjectID ?? store.currentProjectID else { return }
        if let scan = store.addFloorPlan(to: projectID,
                                         elements: output.elements,
                                         roomCount: output.roomCount,
                                         tempModelURL: output.modelURL,
                                         tempRoomDataURL: output.roomDataURL) {
            pendingRoute = FloorPlanRoute(projectID: projectID, scanID: scan.id)
        }
    }
}

struct FloorPlanRow: View {
    let scan: FloorPlanScan

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(scan.name)
                .font(.title3.weight(.semibold))
            Text("\(scan.roomCount) room\(scan.roomCount == 1 ? "" : "s") · \(scan.markers.count) device\(scan.markers.count == 1 ? "" : "s") · \(scan.createdAt.shortDate)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
    }
}
