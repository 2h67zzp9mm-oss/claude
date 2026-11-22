import SwiftUI

enum AppTab: Hashable {
    case floorPlan, measure, objectScan, projects
}

struct RootTabView: View {
    @State private var selection: AppTab = .floorPlan

    var body: some View {
        TabView(selection: $selection) {
            Tab("Floor Plan", systemImage: "square.split.bottomrightquarter", value: AppTab.floorPlan) {
                FloorPlanTab()
            }
            Tab("Measure", systemImage: "ruler", value: AppTab.measure) {
                MeasureTab()
            }
            Tab("Object", systemImage: "cube", value: AppTab.objectScan) {
                ObjectScanTab()
            }
            Tab("Projects", systemImage: "folder", value: AppTab.projects) {
                ProjectsTab()
            }
        }
    }
}
