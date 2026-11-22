import Foundation
import RoomPlan
import simd

/// Flattens RoomPlan's 3D surfaces into 2D line segments for the top-down plan.
enum FloorPlanBuilder {
    static func elements(from room: CapturedRoom) -> [PlanElement] {
        build(walls: room.walls, doors: room.doors, windows: room.windows, openings: room.openings)
    }

    static func elements(from structure: CapturedStructure) -> [PlanElement] {
        build(walls: structure.walls, doors: structure.doors, windows: structure.windows, openings: structure.openings)
    }

    private static func build(walls: [CapturedRoom.Surface],
                              doors: [CapturedRoom.Surface],
                              windows: [CapturedRoom.Surface],
                              openings: [CapturedRoom.Surface]) -> [PlanElement] {
        walls.map { element(from: $0, kind: .wall) }
            + openings.map { element(from: $0, kind: .opening) }
            + windows.map { element(from: $0, kind: .window) }
            + doors.map { element(from: $0, kind: .door) }
    }

    private static func element(from surface: CapturedRoom.Surface, kind: PlanElementKind) -> PlanElement {
        let t = surface.transform
        // Column 3 is the surface center; column 0 runs along its width; column 2 is its normal.
        let center = SIMD2<Double>(Double(t.columns.3.x), Double(t.columns.3.z))
        var direction = SIMD2<Double>(Double(t.columns.0.x), Double(t.columns.0.z))
        if simd_length(direction) < 1e-6 {
            direction = SIMD2<Double>(1, 0)
        }
        direction = simd_normalize(direction)

        var normal = SIMD2<Double>(Double(t.columns.2.x), Double(t.columns.2.z))
        if simd_length(normal) < 1e-6 {
            normal = SIMD2<Double>(-direction.y, direction.x)
        }
        normal = simd_normalize(normal)

        let width = Double(surface.dimensions.x)
        let half = direction * (width / 2)
        let start = center - half
        let end = center + half

        return PlanElement(kind: kind,
                           start: PlanPoint(x: start.x, y: start.y),
                           end: PlanPoint(x: end.x, y: end.y),
                           normal: PlanPoint(x: normal.x, y: normal.y),
                           widthMeters: width,
                           heightMeters: Double(surface.dimensions.y))
    }
}
