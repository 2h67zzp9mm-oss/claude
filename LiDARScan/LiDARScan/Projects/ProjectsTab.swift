import SwiftUI

struct ProjectsTab: View {
    @Environment(ProjectStore.self) private var store
    @State private var showNewProject = false
    @State private var projectToDelete: Project?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if store.projects.isEmpty {
                    ContentUnavailableView {
                        Label("No projects yet", systemImage: "folder")
                    } description: {
                        Text("Create a project for each job or site. Every scan is saved under a project.")
                    }
                } else {
                    List {
                        ForEach(store.projects) { project in
                            NavigationLink(value: project.id) {
                                ProjectRow(project: project, isCurrent: project.id == store.currentProjectID)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    projectToDelete = project
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }

                Button {
                    showNewProject = true
                } label: {
                    Label("New Project", systemImage: "plus.circle.fill")
                }
                .buttonStyle(.big)
                .padding()
            }
            .navigationTitle("Projects")
            .navigationDestination(for: UUID.self) { id in
                ProjectDetailView(projectID: id)
            }
            .navigationDestination(for: FloorPlanRoute.self) { route in
                FloorPlanDetailView(projectID: route.projectID, scanID: route.scanID)
            }
            .sheet(isPresented: $showNewProject) {
                ProjectFormSheet(title: "New Project") { name, address, date in
                    store.createProject(name: name, address: address, date: date)
                }
            }
            .confirmDeleteProject($projectToDelete)
        }
    }
}

struct ProjectRow: View {
    let project: Project
    var isCurrent: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(project.name)
                    .font(.title3.weight(.semibold))
                    .lineLimit(1)
                if isCurrent {
                    Text("CURRENT")
                        .font(.caption.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.accentColor.opacity(0.15), in: Capsule())
                        .foregroundStyle(Color.accentColor)
                }
            }
            if !project.address.isEmpty {
                Text(project.address)
                    .font(.subheadline)
                    .lineLimit(1)
            }
            Text("\(project.date.shortDate) · \(project.scanCount) scan\(project.scanCount == 1 ? "" : "s")")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
    }
}

struct ProjectDetailView: View {
    let projectID: UUID

    @Environment(ProjectStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var showEdit = false
    @State private var projectToDelete: Project?
    @State private var scanToDelete: FloorPlanScan?

    var body: some View {
        if let project = store.project(id: projectID) {
            List {
                Section {
                    LabeledContent("Name", value: project.name)
                    LabeledContent("Address", value: project.address.isEmpty ? "None" : project.address)
                    LabeledContent("Date", value: project.date.shortDate)
                    Button {
                        showEdit = true
                    } label: {
                        Label("Rename or Edit Details", systemImage: "pencil")
                            .frame(minHeight: 44)
                    }
                    if store.currentProjectID != project.id {
                        Button {
                            store.selectProject(project.id)
                        } label: {
                            Label("Use for New Scans", systemImage: "checkmark.circle")
                                .frame(minHeight: 44)
                        }
                    } else {
                        Label("New scans are saved here", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                }
                .font(.title3)

                Section("Floor Plans") {
                    if project.floorPlans.isEmpty {
                        Text("No floor plans yet.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(project.floorPlans.sorted { $0.createdAt > $1.createdAt }) { scan in
                        NavigationLink(value: FloorPlanRoute(projectID: project.id, scanID: scan.id)) {
                            FloorPlanRow(scan: scan)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                scanToDelete = scan
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }

                Section {
                    Button(role: .destructive) {
                        projectToDelete = project
                    } label: {
                        Label("Delete Project", systemImage: "trash")
                            .frame(minHeight: 44)
                    }
                }
            }
            .navigationTitle(project.name)
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showEdit) {
                ProjectFormSheet(title: "Edit Project", project: project) { name, address, date in
                    var updated = project
                    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
                    updated.name = trimmed.isEmpty ? project.name : trimmed
                    updated.address = address
                    updated.date = date
                    store.updateProject(updated)
                }
            }
            .confirmDeleteProject($projectToDelete) {
                dismiss()
            }
            .confirmationDialog("Delete \(scanToDelete?.name ?? "floor plan")?",
                                isPresented: Binding(get: { scanToDelete != nil }, set: { if !$0 { scanToDelete = nil } }),
                                titleVisibility: .visible,
                                presenting: scanToDelete) { scan in
                Button("Delete Floor Plan", role: .destructive) {
                    store.deleteFloorPlan(id: scan.id, in: project.id)
                }
                Button("Cancel", role: .cancel) {}
            } message: { _ in
                Text("This permanently deletes the plan, its devices and its 3D model. This can't be undone.")
            }
        } else {
            ContentUnavailableView("Project not found", systemImage: "questionmark.folder")
        }
    }
}

extension View {
    /// Confirmation prompt before permanently deleting a project and all its scans.
    func confirmDeleteProject(_ project: Binding<Project?>, onDeleted: @escaping () -> Void = {}) -> some View {
        modifier(ConfirmDeleteProjectModifier(project: project, onDeleted: onDeleted))
    }
}

private struct ConfirmDeleteProjectModifier: ViewModifier {
    @Binding var project: Project?
    var onDeleted: () -> Void
    @Environment(ProjectStore.self) private var store

    func body(content: Content) -> some View {
        content.confirmationDialog("Delete \(project?.name ?? "project")?",
                                   isPresented: Binding(get: { project != nil }, set: { if !$0 { project = nil } }),
                                   titleVisibility: .visible,
                                   presenting: project) { item in
            Button("Delete Project and \(item.scanCount) Scan\(item.scanCount == 1 ? "" : "s")", role: .destructive) {
                store.deleteProject(id: item.id)
                onDeleted()
            }
            Button("Cancel", role: .cancel) {}
        } message: { _ in
            Text("This permanently deletes the project and every scan in it from this phone. This can't be undone.")
        }
    }
}

/// Create or edit a project's name, address and date.
struct ProjectFormSheet: View {
    let title: String
    var project: Project? = nil
    var onSave: (String, String, Date) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var address = ""
    @State private var date = Date()
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Job or Site Name") {
                    TextField("e.g. Smith Residence", text: $name)
                        .font(.title3)
                        .textInputAutocapitalization(.words)
                }
                Section("Address") {
                    TextField("Street, city", text: $address, axis: .vertical)
                        .font(.title3)
                        .textContentType(.fullStreetAddress)
                        .lineLimit(1...3)
                }
                Section("Date") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                        .font(.title3)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(name, address, date)
                        dismiss()
                    }
                    .bold()
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear {
                guard !loaded else { return }
                loaded = true
                if let project {
                    name = project.name
                    address = project.address
                    date = project.date
                }
            }
        }
    }
}

/// Pick which project new scans are saved to, or create one.
struct ProjectPickerSheet: View {
    @Environment(ProjectStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var showNewProject = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                List {
                    ForEach(store.projects) { project in
                        Button {
                            store.selectProject(project.id)
                            dismiss()
                        } label: {
                            HStack {
                                ProjectRow(project: project)
                                Spacer()
                                if project.id == store.currentProjectID {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.title2)
                                        .foregroundStyle(Color.accentColor)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .listStyle(.plain)

                Button {
                    showNewProject = true
                } label: {
                    Label("New Project", systemImage: "plus.circle.fill")
                }
                .buttonStyle(.big)
                .padding()
            }
            .navigationTitle("Choose Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .sheet(isPresented: $showNewProject) {
                ProjectFormSheet(title: "New Project") { name, address, date in
                    store.createProject(name: name, address: address, date: date)
                    dismiss()
                }
            }
        }
    }
}
