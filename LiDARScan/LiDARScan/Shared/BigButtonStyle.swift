import SwiftUI

/// Large, thumb-friendly button for job-site use.
struct BigButtonStyle: ButtonStyle {
    var color: Color = .accentColor
    var filled: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        BigButtonBody(configuration: configuration, color: color, filled: filled)
    }

    private struct BigButtonBody: View {
        let configuration: ButtonStyleConfiguration
        let color: Color
        let filled: Bool
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            configuration.label
                .font(.title3.weight(.semibold))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, minHeight: 60)
                .padding(.horizontal, 12)
                .foregroundStyle(filled ? Color.white : color)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(filled ? color : color.opacity(0.15))
                )
                .opacity(isEnabled ? (configuration.isPressed ? 0.7 : 1) : 0.4)
        }
    }
}

extension ButtonStyle where Self == BigButtonStyle {
    static var big: BigButtonStyle { BigButtonStyle() }
    static func big(_ color: Color, filled: Bool = true) -> BigButtonStyle {
        BigButtonStyle(color: color, filled: filled)
    }
}
