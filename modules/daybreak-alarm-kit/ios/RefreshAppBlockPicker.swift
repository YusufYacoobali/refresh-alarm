import SwiftUI
import FamilyControls

struct RefreshAppBlockPicker: View {
  @State var selection: FamilyActivitySelection
  var social: Bool = false
  var complete: (FamilyActivitySelection?) -> Void
  var body: some View {
    NavigationStack {
      VStack {
        if social {
          Text("Choose the social apps you want to block. You can select the Social category, then add YouTube, Twitch, and other video apps from Entertainment.")
            .font(.subheadline).foregroundStyle(.secondary).padding()
        }
        FamilyActivityPicker(selection: $selection)
      }
        .navigationTitle(social ? "Social apps" : "Apps to block")
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button("Cancel") { complete(nil) } }
          ToolbarItem(placement: .confirmationAction) { Button("Done") { complete(selection) } }
        }
    }.interactiveDismissDisabled()
  }
}
