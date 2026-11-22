import SwiftUI

/// Big grid of device types to pick from before tapping the plan.
struct DevicePickerSheet: View {
    var onPick: (DeviceType) -> Void
    @Environment(\.dismiss) private var dismiss

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(DeviceType.allCases) { type in
                        Button {
                            onPick(type)
                            dismiss()
                        } label: {
                            VStack(spacing: 8) {
                                Image(systemName: type.symbol)
                                    .font(.system(size: 30, weight: .bold))
                                Text(type.displayName)
                                    .font(.headline)
                                    .multilineTextAlignment(.center)
                            }
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 96)
                            .background(type.color, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }
            .navigationTitle("Add Device")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
    }
}

/// Edit a marker's type, label and note, or delete it (with confirmation).
struct MarkerEditorSheet: View {
    @State var marker: DeviceMarker
    var onSave: (DeviceMarker) -> Void
    var onDelete: (DeviceMarker) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Device") {
                    Picker("Type", selection: $marker.type) {
                        ForEach(DeviceType.allCases) { type in
                            Label(type.displayName, systemImage: type.symbol).tag(type)
                        }
                    }
                    .pickerStyle(.navigationLink)
                    .font(.title3)
                }
                Section("Label") {
                    TextField("e.g. SD-1 Hallway", text: $marker.label)
                        .font(.title3)
                        .textInputAutocapitalization(.characters)
                }
                Section("Note") {
                    TextField("Mounting height, wiring, model…", text: $marker.note, axis: .vertical)
                        .font(.title3)
                        .lineLimit(3...8)
                }
                Section {
                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        Label("Delete Device", systemImage: "trash")
                            .font(.title3)
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                }
            }
            .navigationTitle(marker.type.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(marker)
                        dismiss()
                    }
                    .bold()
                }
            }
            .confirmationDialog("Delete this device?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete Device", role: .destructive) {
                    onDelete(marker)
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }
}
