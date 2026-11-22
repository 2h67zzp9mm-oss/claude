import Foundation

enum Units {
    /// Formats a length in meters as feet and inches, rounded to the nearest inch, e.g. 12' 4".
    static func feetInches(_ meters: Double) -> String {
        let totalInches = Int((meters * 39.37007874).rounded())
        let feet = totalInches / 12
        let inches = totalInches % 12
        return "\(feet)' \(inches)\""
    }

    static func squareFeet(_ squareMeters: Double) -> String {
        let value = squareMeters * 10.7639104
        return String(format: "%.1f sq ft", value)
    }
}

extension Date {
    var shortDate: String { formatted(date: .abbreviated, time: .omitted) }
}

extension String {
    /// A version of the string that is safe to use as a file name.
    var safeFileName: String {
        let invalid = CharacterSet(charactersIn: "/\\?%*|\"<>:")
        let cleaned = components(separatedBy: invalid).joined(separator: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? "Untitled" : cleaned
    }
}
