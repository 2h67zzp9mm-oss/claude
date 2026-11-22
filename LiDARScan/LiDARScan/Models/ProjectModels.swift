import Foundation
import CoreGraphics

/// A point on the 2D plan, in meters. x is to the right, y is "down" on the page
/// (it is the world z axis seen from above).
struct PlanPoint: Codable, Hashable {
    var x: Double
    var y: Double

    var cgPoint: CGPoint { CGPoint(x: x, y: y) }
}

enum PlanElementKind: String, Codable {
    case wall, door, window, opening
}

/// One wall, door, window or opening, flattened to a line segment seen from above.
struct PlanElement: Codable, Hashable, Identifiable {
    var id: UUID = UUID()
    var kind: PlanElementKind
    var start: PlanPoint
    var end: PlanPoint
    /// Unit vector facing out of the surface (used to draw door swings).
    var normal: PlanPoint
    var widthMeters: Double
    var heightMeters: Double
}

struct DeviceMarker: Codable, Hashable, Identifiable {
    var id: UUID = UUID()
    var type: DeviceType
    var position: PlanPoint
    var label: String
    var note: String
}

struct FloorPlanScan: Codable, Hashable, Identifiable {
    var id: UUID = UUID()
    var name: String
    var createdAt: Date
    var roomCount: Int
    var elements: [PlanElement]
    var markers: [DeviceMarker]
    /// USDZ 3D model file name inside the project folder.
    var modelFileName: String?
    /// Raw RoomPlan data (JSON) inside the project folder, kept for future re-processing.
    var roomDataFileName: String?

    var walls: [PlanElement] { elements.filter { $0.kind == .wall } }
}

struct Project: Codable, Hashable, Identifiable {
    var id: UUID
    var name: String
    var address: String
    var date: Date
    var createdAt: Date
    var floorPlans: [FloorPlanScan]

    init(id: UUID = UUID(), name: String, address: String, date: Date, createdAt: Date = Date(), floorPlans: [FloorPlanScan] = []) {
        self.id = id
        self.name = name
        self.address = address
        self.date = date
        self.createdAt = createdAt
        self.floorPlans = floorPlans
    }

    enum CodingKeys: String, CodingKey {
        case id, name, address, date, createdAt, floorPlans
    }

    // Tolerant decoding so files saved by older versions keep loading as new fields are added.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Untitled"
        address = try c.decodeIfPresent(String.self, forKey: .address) ?? ""
        date = try c.decodeIfPresent(Date.self, forKey: .date) ?? Date()
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? date
        floorPlans = try c.decodeIfPresent([FloorPlanScan].self, forKey: .floorPlans) ?? []
    }

    var scanCount: Int { floorPlans.count }
}
