import SwiftUI

/// Maps plan coordinates (meters) to screen points so the whole plan fits the view.
struct PlanTransform {
    let minX: Double
    let minY: Double
    let scale: Double
    let offset: CGPoint
    let center: CGPoint

    init(bounds: CGRect, size: CGSize, padding: CGFloat) {
        let width = max(Double(bounds.width), 0.5)
        let height = max(Double(bounds.height), 0.5)
        let availableWidth = max(Double(size.width - padding * 2), 1)
        let availableHeight = max(Double(size.height - padding * 2), 1)
        scale = min(availableWidth / width, availableHeight / height)
        minX = Double(bounds.minX)
        minY = Double(bounds.minY)
        offset = CGPoint(x: (Double(size.width) - width * scale) / 2,
                         y: (Double(size.height) - height * scale) / 2)
        center = CGPoint(x: size.width / 2, y: size.height / 2)
    }

    func toScreen(_ p: PlanPoint) -> CGPoint {
        CGPoint(x: offset.x + (p.x - minX) * scale, y: offset.y + (p.y - minY) * scale)
    }

    func toPlan(_ s: CGPoint) -> PlanPoint {
        PlanPoint(x: (Double(s.x) - offset.x) / scale + minX, y: (Double(s.y) - offset.y) / scale + minY)
    }

    /// Bounding box of all elements in meters, with a sensible default for an empty plan.
    static func bounds(of elements: [PlanElement]) -> CGRect {
        guard !elements.isEmpty else { return CGRect(x: -2.5, y: -2.5, width: 5, height: 5) }
        var minX = Double.infinity, minY = Double.infinity
        var maxX = -Double.infinity, maxY = -Double.infinity
        for e in elements {
            for p in [e.start, e.end] {
                minX = min(minX, p.x); maxX = max(maxX, p.x)
                minY = min(minY, p.y); maxY = max(maxY, p.y)
            }
        }
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }
}

/// Draws walls, doors, windows, openings and wall dimensions in black on white.
enum FloorPlanPainter {
    static func paint(_ context: inout GraphicsContext,
                      elements: [PlanElement],
                      transform t: PlanTransform,
                      showDimensions: Bool,
                      labelFontSize: CGFloat) {
        let wallWidth = CGFloat(max(3, min(9, 0.15 * t.scale)))

        // Walls
        var walls = Path()
        for e in elements where e.kind == .wall {
            walls.move(to: t.toScreen(e.start))
            walls.addLine(to: t.toScreen(e.end))
        }
        context.stroke(walls, with: .color(.black), style: StrokeStyle(lineWidth: wallWidth, lineCap: .square, lineJoin: .miter))

        // Doors, windows and openings cut a gap in the wall, then get their own symbol.
        for e in elements where e.kind != .wall {
            let a = t.toScreen(e.start)
            let b = t.toScreen(e.end)
            var gap = Path()
            gap.move(to: a)
            gap.addLine(to: b)
            context.stroke(gap, with: .color(.white), lineWidth: wallWidth + 2)

            let dx = b.x - a.x, dy = b.y - a.y
            let length = max(sqrt(dx * dx + dy * dy), 0.001)
            let perp = CGPoint(x: -dy / length, y: dx / length)

            switch e.kind {
            case .window:
                let h = wallWidth / 2
                var frame = Path()
                frame.move(to: CGPoint(x: a.x + perp.x * h, y: a.y + perp.y * h))
                frame.addLine(to: CGPoint(x: b.x + perp.x * h, y: b.y + perp.y * h))
                frame.addLine(to: CGPoint(x: b.x - perp.x * h, y: b.y - perp.y * h))
                frame.addLine(to: CGPoint(x: a.x - perp.x * h, y: a.y - perp.y * h))
                frame.closeSubpath()
                context.stroke(frame, with: .color(.black), lineWidth: 1.2)
                context.stroke(gap, with: .color(Color(red: 0.1, green: 0.45, blue: 0.85)), lineWidth: 1.5)

            case .door:
                // Leaf swings 90 degrees from the hinge (start) toward the door's normal.
                let normal = CGPoint(x: e.normal.x, y: e.normal.y)
                let leafEnd = CGPoint(x: a.x + normal.x * length, y: a.y + normal.y * length)
                var leaf = Path()
                leaf.move(to: a)
                leaf.addLine(to: leafEnd)
                context.stroke(leaf, with: .color(.black), lineWidth: 1.5)

                let startAngle = atan2(dy, dx)
                let endAngle = atan2(normal.y, normal.x)
                var delta = endAngle - startAngle
                while delta > .pi { delta -= 2 * .pi }
                while delta < -.pi { delta += 2 * .pi }
                var arc = Path()
                let steps = 20
                for i in 0...steps {
                    let angle = startAngle + delta * CGFloat(i) / CGFloat(steps)
                    let p = CGPoint(x: a.x + cos(angle) * length, y: a.y + sin(angle) * length)
                    if i == 0 { arc.move(to: p) } else { arc.addLine(to: p) }
                }
                context.stroke(arc, with: .color(.gray), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))

            case .opening:
                context.stroke(gap, with: .color(.gray), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))

            case .wall:
                break
            }
        }

        guard showDimensions else { return }

        // Wall lengths in feet and inches, placed on the side of the wall away from the plan's center.
        for e in elements where e.kind == .wall && e.widthMeters >= 0.3 {
            let a = t.toScreen(e.start)
            let b = t.toScreen(e.end)
            let dx = b.x - a.x, dy = b.y - a.y
            let length = max(sqrt(dx * dx + dy * dy), 0.001)
            guard length > 40 else { continue }
            var perp = CGPoint(x: -dy / length, y: dx / length)
            let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
            let towardCenter = (t.center.x - mid.x) * perp.x + (t.center.y - mid.y) * perp.y
            if towardCenter > 0 { perp = CGPoint(x: -perp.x, y: -perp.y) }
            let distance = wallWidth / 2 + labelFontSize * 0.9
            let position = CGPoint(x: mid.x + perp.x * distance, y: mid.y + perp.y * distance)

            var angle = atan2(dy, dx)
            if angle > .pi / 2 { angle -= .pi }
            if angle < -.pi / 2 { angle += .pi }

            let text = Text(Units.feetInches(e.widthMeters))
                .font(.system(size: labelFontSize, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.black)
            let resolved = context.resolve(text)
            let size = resolved.measure(in: CGSize(width: 400, height: 100))

            var labelContext = context
            labelContext.translateBy(x: position.x, y: position.y)
            labelContext.rotate(by: .radians(Double(angle)))
            let box = CGRect(x: -size.width / 2 - 3, y: -size.height / 2 - 1, width: size.width + 6, height: size.height + 2)
            labelContext.fill(Path(roundedRect: box, cornerRadius: 3), with: .color(.white.opacity(0.85)))
            labelContext.draw(resolved, at: .zero, anchor: .center)
        }
    }
}

/// A device marker drawn on the plan: colored circle with an icon, and its label underneath.
struct MarkerBadge: View {
    let marker: DeviceMarker
    var diameter: CGFloat = 34
    var showLabel: Bool = true
    var isSelected: Bool = false

    var body: some View {
        VStack(spacing: 2) {
            ZStack {
                Circle()
                    .fill(marker.type.color)
                Circle()
                    .stroke(isSelected ? Color.yellow : Color.white, lineWidth: isSelected ? 3 : 2)
                Image(systemName: marker.type.symbol)
                    .font(.system(size: diameter * 0.45, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: diameter, height: diameter)
            .shadow(color: .black.opacity(0.25), radius: 1.5, y: 1)

            if showLabel {
                Text(marker.label.isEmpty ? marker.type.code : marker.label)
                    .font(.system(size: max(9, diameter * 0.32), weight: .bold))
                    .foregroundStyle(.black)
                    .lineLimit(1)
                    .padding(.horizontal, 4)
                    .background(Color.white.opacity(0.85), in: RoundedRectangle(cornerRadius: 3))
                    .fixedSize()
            }
        }
    }
}

/// The plan with its markers. Used on screen (interactive) and for PDF/PNG export (static).
struct FloorPlanCanvasView: View {
    let scan: FloorPlanScan
    var showDimensions: Bool = true
    var markerDiameter: CGFloat = 34
    var labelFontSize: CGFloat = 12
    var padding: CGFloat = 36
    var interactive: Bool = false
    var onTapPlan: ((PlanPoint) -> Void)? = nil
    var onTapMarker: ((DeviceMarker) -> Void)? = nil
    var onMoveMarker: ((UUID, PlanPoint) -> Void)? = nil

    @State private var dragging: (id: UUID, location: CGPoint)?

    var body: some View {
        GeometryReader { geometry in
            let transform = PlanTransform(bounds: PlanTransform.bounds(of: scan.elements),
                                          size: geometry.size,
                                          padding: padding)
            ZStack(alignment: .topLeading) {
                Canvas { context, _ in
                    FloorPlanPainter.paint(&context,
                                           elements: scan.elements,
                                           transform: transform,
                                           showDimensions: showDimensions,
                                           labelFontSize: labelFontSize)
                }
                .contentShape(Rectangle())
                .onTapGesture { location in
                    guard interactive else { return }
                    onTapPlan?(transform.toPlan(location))
                }

                ForEach(scan.markers) { marker in
                    let isDragging = dragging?.id == marker.id
                    let point = isDragging ? (dragging?.location ?? .zero) : transform.toScreen(marker.position)
                    MarkerBadge(marker: marker, diameter: markerDiameter, isSelected: isDragging)
                        // Center the circle (not the label) on the marker's point.
                        .alignmentGuide(.top) { d in d[VerticalAlignment.top] + markerDiameter / 2 }
                        .alignmentGuide(.leading) { d in d[HorizontalAlignment.center] }
                        .offset(x: point.x, y: point.y)
                        .allowsHitTesting(interactive)
                        .onTapGesture {
                            onTapMarker?(marker)
                        }
                        .gesture(
                            DragGesture(minimumDistance: 6, coordinateSpace: .named("plan"))
                                .onChanged { value in
                                    dragging = (marker.id, value.location)
                                }
                                .onEnded { value in
                                    dragging = nil
                                    onMoveMarker?(marker.id, transform.toPlan(value.location))
                                }
                        )
                }
            }
            .coordinateSpace(name: "plan")
        }
    }
}
