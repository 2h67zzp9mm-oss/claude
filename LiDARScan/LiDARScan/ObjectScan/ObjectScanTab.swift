import SwiftUI

struct ObjectScanTab: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label("Object Scan", systemImage: "cube")
            } description: {
                Text("Object Capture with OBJ and STL export for 3D printing is coming in a later step.")
            }
            .navigationTitle("Object Scan")
        }
    }
}
