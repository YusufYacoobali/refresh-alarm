import SwiftUI
import FamilyControls

struct RefreshAppBlockPicker: View {
  @State var selection: FamilyActivitySelection
  var complete: (FamilyActivitySelection?) -> Void
  var body: some View {
    NavigationStack {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Apps to block")
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button("Cancel") { complete(nil) } }
          ToolbarItem(placement: .confirmationAction) { Button("Done") { complete(selection) } }
        }
    }.interactiveDismissDisabled()
  }
}
