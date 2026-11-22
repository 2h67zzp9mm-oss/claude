import Foundation
import Observation

/// Saves every project as a folder in the app's Documents directory:
///   Documents/Projects/<project id>/project.json  plus the scan files (USDZ, raw data).
/// Everything stays on the phone.
@MainActor
@Observable
final class ProjectStore {
    private(set) var projects: [Project] = []
    private(set) var currentProjectID: UUID?
    var lastError: String?

    let rootURL: URL
    private let fileManager = FileManager.default
    private let currentKey = "currentProjectID"

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        rootURL = docs.appendingPathComponent("Projects", isDirectory: true)
        try? FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        load()
        if let saved = UserDefaults.standard.string(forKey: currentKey),
           let id = UUID(uuidString: saved),
           projects.contains(where: { $0.id == id }) {
            currentProjectID = id
        } else {
            currentProjectID = projects.first?.id
        }
    }

    // MARK: Lookup

    var currentProject: Project? {
        guard let currentProjectID else { return nil }
        return project(id: currentProjectID)
    }

    func project(id: UUID) -> Project? {
        projects.first { $0.id == id }
    }

    func floorPlan(id: UUID, in projectID: UUID) -> FloorPlanScan? {
        project(id: projectID)?.floorPlans.first { $0.id == id }
    }

    func folderURL(for projectID: UUID) -> URL {
        rootURL.appendingPathComponent(projectID.uuidString, isDirectory: true)
    }

    func fileURL(projectID: UUID, fileName: String) -> URL {
        folderURL(for: projectID).appendingPathComponent(fileName)
    }

    // MARK: Projects

    func selectProject(_ id: UUID?) {
        currentProjectID = id
        UserDefaults.standard.set(id?.uuidString, forKey: currentKey)
    }

    @discardableResult
    func createProject(name: String, address: String, date: Date) -> Project {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let project = Project(name: trimmed.isEmpty ? "Untitled Job" : trimmed, address: address, date: date)
        try? fileManager.createDirectory(at: folderURL(for: project.id), withIntermediateDirectories: true)
        projects.append(project)
        sortProjects()
        save(project)
        selectProject(project.id)
        return project
    }

    func updateProject(_ project: Project) {
        guard let index = projects.firstIndex(where: { $0.id == project.id }) else { return }
        projects[index] = project
        sortProjects()
        save(project)
    }

    /// Permanently deletes a project and all its scans. Callers must confirm with the user first.
    func deleteProject(id: UUID) {
        projects.removeAll { $0.id == id }
        do {
            try fileManager.removeItem(at: folderURL(for: id))
        } catch {
            lastError = "Couldn't delete project files: \(error.localizedDescription)"
        }
        if currentProjectID == id {
            selectProject(projects.first?.id)
        }
    }

    // MARK: Floor plans

    /// Moves the temporary files from a finished scan into the project folder and saves the floor plan.
    @discardableResult
    func addFloorPlan(to projectID: UUID,
                      elements: [PlanElement],
                      roomCount: Int,
                      tempModelURL: URL?,
                      tempRoomDataURL: URL?) -> FloorPlanScan? {
        guard var project = project(id: projectID) else { return nil }
        let folder = folderURL(for: projectID)
        try? fileManager.createDirectory(at: folder, withIntermediateDirectories: true)

        var scan = FloorPlanScan(name: "Floor Plan \(project.floorPlans.count + 1)",
                                 createdAt: Date(),
                                 roomCount: roomCount,
                                 elements: elements,
                                 markers: [])
        if let tempModelURL, fileManager.fileExists(atPath: tempModelURL.path) {
            let name = "\(scan.id.uuidString).usdz"
            if moveFile(from: tempModelURL, to: folder.appendingPathComponent(name)) {
                scan.modelFileName = name
            }
        }
        if let tempRoomDataURL, fileManager.fileExists(atPath: tempRoomDataURL.path) {
            let name = "\(scan.id.uuidString)-rooms.json"
            if moveFile(from: tempRoomDataURL, to: folder.appendingPathComponent(name)) {
                scan.roomDataFileName = name
            }
        }
        project.floorPlans.append(scan)
        updateProject(project)
        return scan
    }

    func updateFloorPlan(_ scan: FloorPlanScan, in projectID: UUID) {
        guard var project = project(id: projectID),
              let index = project.floorPlans.firstIndex(where: { $0.id == scan.id }) else { return }
        project.floorPlans[index] = scan
        updateProject(project)
    }

    /// Permanently deletes a floor plan and its files. Callers must confirm with the user first.
    func deleteFloorPlan(id: UUID, in projectID: UUID) {
        guard var project = project(id: projectID),
              let scan = project.floorPlans.first(where: { $0.id == id }) else { return }
        for name in [scan.modelFileName, scan.roomDataFileName].compactMap({ $0 }) {
            try? fileManager.removeItem(at: fileURL(projectID: projectID, fileName: name))
        }
        project.floorPlans.removeAll { $0.id == id }
        updateProject(project)
    }

    // MARK: Persistence

    private func moveFile(from source: URL, to destination: URL) -> Bool {
        do {
            if fileManager.fileExists(atPath: destination.path) {
                try fileManager.removeItem(at: destination)
            }
            try fileManager.moveItem(at: source, to: destination)
            return true
        } catch {
            lastError = "Couldn't save file: \(error.localizedDescription)"
            return false
        }
    }

    private func sortProjects() {
        projects.sort { $0.date > $1.date }
    }

    private static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    private static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    private func save(_ project: Project) {
        let folder = folderURL(for: project.id)
        do {
            try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
            let data = try Self.makeEncoder().encode(project)
            try data.write(to: folder.appendingPathComponent("project.json"), options: .atomic)
        } catch {
            lastError = "Couldn't save project: \(error.localizedDescription)"
        }
    }

    private func load() {
        guard let folders = try? fileManager.contentsOfDirectory(at: rootURL, includingPropertiesForKeys: nil) else { return }
        let decoder = Self.makeDecoder()
        var loaded: [Project] = []
        for folder in folders {
            let file = folder.appendingPathComponent("project.json")
            guard let data = try? Data(contentsOf: file) else { continue }
            if let project = try? decoder.decode(Project.self, from: data) {
                loaded.append(project)
            }
        }
        projects = loaded
        sortProjects()
    }
}
