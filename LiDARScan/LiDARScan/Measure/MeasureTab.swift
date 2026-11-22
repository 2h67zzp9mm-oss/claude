import SwiftUI

struct MeasureTab: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label("Measure", systemImage: "ruler")
            } description: {
                Text("Tap-to-tap distance, wall area and ceiling height are coming in the next step.")
            }
            .navigationTitle("Measure")
        }
    }
}
