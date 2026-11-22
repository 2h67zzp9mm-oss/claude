# LiDAR Scan

A personal iPhone app for job sites, quoting, 3D printing and house scans. It uses only Apple frameworks (RoomPlan, ARKit, RealityKit, SwiftUI, Core Graphics), with no accounts, ads, cloud or third-party packages. Everything stays on the phone.

**Status: step 1 (project skeleton + Floor Plan mode).** Measure and Object Scan are placeholders for now. Projects has the basics: create, edit, rename, pick the current project, and delete with confirmation. ZIP backup comes in a later step.

> This code was written without Xcode, so it hasn't been compiled yet. The first build in Xcode is the real test. If you see errors, copy them back to Claude.

## What you need

| Item | Version |
|---|---|
| Mac | Apple silicon (M1 or newer) |
| macOS | Tahoe 26.6 or later |
| Xcode | 27.2 (free, Mac App Store) |
| iPhone | iPhone 12 Pro Max on iOS 27 |
| Apple ID | Any free Apple ID. No paid developer account needed |

## Device compatibility (iPhone 12 Pro Max)

- **iOS:** iOS 27 supports iPhone 11 and newer. The app targets iOS 27.0.
- **RoomPlan:** needs LiDAR and iOS 16+. Multi-room merging (`StructureBuilder`) needs iOS 17+. Both work.
- **Object Capture on the phone** (for the later Object Scan step): needs LiDAR and A14 or newer. The 12 Pro Max meets this.
- RoomPlan doesn't run in the Simulator, so test on the phone.

## Build and install on your iPhone

1. **Get the code.** On GitHub, open the repo, then click **Code › Download ZIP** and unzip it. Or run `git clone` and check out the branch.
2. **Open the project.** Double-click `LiDARScan/LiDARScan.xcodeproj`.
3. **Sign in to Xcode once.** Go to **Xcode › Settings › Accounts › +**, choose **Apple ID**, and sign in.
4. **Set signing.** In the left sidebar, click the blue **LiDARScan** project, then the **LiDARScan** target, then **Signing & Capabilities**:
   - Keep **Automatically manage signing** checked.
   - For **Team**, pick *Your Name (Personal Team)*.
   - The bundle identifier adds your team ID automatically, so it should be unique. If Xcode still says the identifier isn't available, change it to something like `com.yourname.lidarscan`.
5. **Plug in the iPhone** with a cable. Unlock it and tap **Trust This Computer**.
6. **Turn on Developer Mode** on the iPhone: **Settings › Privacy & Security › Developer Mode › On**, then restart. The switch only appears after the phone has been connected to Xcode once.
7. **Pick the phone** in the device menu at the top of the Xcode window, next to the LiDARScan scheme.
8. **Build and run** with **⌘R** (or the ▶ button). The first build takes a few minutes.
9. **Trust your developer profile.** The first launch is blocked with "Untrusted Developer". On the iPhone, go to **Settings › General › VPN & Device Management**, tap your Apple ID, then tap **Trust**. Press ▶ in Xcode again.
10. When the app asks for camera access, allow it.

### Free Apple ID limits

- The app stops opening **7 days** after you install it. Plug the phone in and press ▶ again to renew it. Your projects and scans aren't touched.
- You can have up to 3 sideloaded apps at a time.

## Using Floor Plan

1. **Pick a project** with the card at the top. If you don't, tapping **Scan Room** creates an "Untitled Job" that you can rename in Projects.
2. **Scan Room.** Walk slowly and point at every wall, door and window. Tap **Done With This Room**.
3. **Scan Next Room** to map a whole floor, or **Finish and Save**. Rooms scanned back to back are merged into one plan.
4. On the plan:
   - **Add Device**: pick a type, then tap the plan to drop it. Each device gets an automatic label like `SD-1`, and you can edit its label and note.
   - **Drag** a device to move it. **Tap** a device to edit or delete it.
   - **Export**: PDF (plan with title block and legend, plus a device schedule page), PNG, or the 3D model as USDZ. Each goes to the iOS share sheet, where you can AirDrop it, email it or **Save to Files**.
   - The **⋯** menu has Show Dimensions, Rename and Delete Floor Plan.

Wall lengths are in feet and inches, rounded to the nearest inch. LiDAR is good to about an inch or two, so check critical measurements with a tape.

Deleting a device, floor plan or project always asks for confirmation first.

## Where data lives

`Documents/Projects/<project id>/` on the phone, which holds `project.json`, the USDZ models and the raw RoomPlan data. File sharing is turned on, so you can also see this folder in the **Files** app under *On My iPhone › LiDAR Scan*.

## Project layout

```
LiDARScan/
  LiDARScan.xcodeproj
  Info.plist            extra keys (Files app access, ARKit requirement)
  LiDARScan/            all sources (Xcode picks up new files in this folder automatically)
    App/                app entry and tab bar
    Models/             Project, FloorPlanScan, DeviceMarker, DeviceType, units
    Storage/            ProjectStore (JSON on disk)
    FloorPlan/          RoomPlan scanner, 2D plan drawing, markers, export
    Projects/           project list, detail, forms
    Measure/            placeholder (step 2)
    ObjectScan/         placeholder (step 3)
    Shared/             big buttons, share sheet
```
