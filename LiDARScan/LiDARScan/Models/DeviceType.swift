import SwiftUI

/// Fire alarm and security devices that can be dropped on a floor plan.
enum DeviceType: String, Codable, CaseIterable, Identifiable {
    case smokeDetector
    case heatDetector
    case pullStation
    case hornStrobe
    case panel
    case camera
    case doorContact
    case motion
    case keypad

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .smokeDetector: "Smoke Detector"
        case .heatDetector: "Heat Detector"
        case .pullStation: "Pull Station"
        case .hornStrobe: "Horn/Strobe"
        case .panel: "Panel"
        case .camera: "Camera"
        case .doorContact: "Door Contact"
        case .motion: "Motion"
        case .keypad: "Keypad"
        }
    }

    /// Short code used in default labels and on the plan.
    var code: String {
        switch self {
        case .smokeDetector: "SD"
        case .heatDetector: "HD"
        case .pullStation: "PS"
        case .hornStrobe: "HS"
        case .panel: "PNL"
        case .camera: "CAM"
        case .doorContact: "DC"
        case .motion: "MD"
        case .keypad: "KP"
        }
    }

    var symbol: String {
        switch self {
        case .smokeDetector: "smoke.fill"
        case .heatDetector: "thermometer.high"
        case .pullStation: "hand.raised.fill"
        case .hornStrobe: "speaker.wave.3.fill"
        case .panel: "square.grid.3x3.square"
        case .camera: "video.fill"
        case .doorContact: "door.left.hand.closed"
        case .motion: "figure.walk.motion"
        case .keypad: "circle.grid.3x3.fill"
        }
    }

    var isFire: Bool {
        switch self {
        case .smokeDetector, .heatDetector, .pullStation, .hornStrobe, .panel: true
        default: false
        }
    }

    var color: Color {
        isFire ? Color(red: 0.85, green: 0.12, blue: 0.0) : Color(red: 0.10, green: 0.42, blue: 0.85)
    }
}
