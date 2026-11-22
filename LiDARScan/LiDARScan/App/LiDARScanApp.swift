import SwiftUI

@main
struct LiDARScanApp: App {
    @State private var store = ProjectStore()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(store)
        }
    }
}
