import DeviceActivity

class RefreshAppBlockMonitor: DeviceActivityMonitor {
  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    RefreshAppBlockShared.refresh(activity.rawValue)
  }
  override func intervalWillEndWarning(for activity: DeviceActivityName) {
    super.intervalWillEndWarning(for: activity)
    RefreshAppBlockShared.refresh(activity.rawValue)
  }
  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    RefreshAppBlockShared.refresh(activity.rawValue)
  }
}
