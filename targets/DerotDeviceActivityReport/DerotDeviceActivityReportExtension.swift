import DeviceActivity
import SwiftUI

/// Must match `DeviceActivityReport.Context` in the main app (`derot-device-activity-chart` module).
extension DeviceActivityReport.Context {
  static let derotBar = Self("derotBar")
}

private enum DerotUsageStore {
  static let reportTodayMinutes = "DEROT_REPORT_TODAY_MINUTES"
  static let sampleReady = "DEROT_SCREEN_TIME_SAMPLE_READY"
}

private func derotAppGroupId() -> String? {
  Bundle.main.object(forInfoDictionaryKey: "REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP") as? String
}

private func persistTodayMinutes(_ minutes: Int) {
  guard let group = derotAppGroupId(), let ud = UserDefaults(suiteName: group) else { return }
  let rounded = max(0, minutes)
  ud.set(rounded, forKey: DerotUsageStore.reportTodayMinutes)
  ud.set(Date().timeIntervalSince1970, forKey: "DEROT_REPORT_TODAY_UPDATED_AT")
  if rounded > 0 {
    ud.set(true, forKey: DerotUsageStore.sampleReady)
  }
}

struct DerotBarReportConfiguration {
  struct Row: Identifiable {
    let id: Int
    let title: String
    let minutes: Double
  }

  var rows: [Row]
  var totalMinutes: Int
}

struct DerotBarReportView: View {
  let configuration: DerotBarReportConfiguration

  private func formatTotal(_ minutes: Int) -> String {
    if minutes < 1 { return "—" }
    let h = minutes / 60
    let m = minutes % 60
    if h <= 0 { return "\(m)min" }
    if m <= 0 { return "\(h)h" }
    return "\(h)h \(m)min"
  }

  var body: some View {
    VStack(spacing: 6) {
      Text("Today")
        .font(.caption)
        .foregroundStyle(.secondary)
      Text(formatTotal(configuration.totalMinutes))
        .font(.system(size: 36, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(.primary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

struct DerotBarReportScene: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .derotBar
  let content: (DerotBarReportConfiguration) -> DerotBarReportView

  init(content: @escaping (DerotBarReportConfiguration) -> DerotBarReportView) {
    self.content = content
  }

  func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> DerotBarReportConfiguration {
    var totalSeconds: TimeInterval = 0

    for await datum in data {
      for await segment in datum.activitySegments {
        totalSeconds += segment.totalActivityDuration
      }
    }

    let totalMinutes = max(0, Int((totalSeconds / 60.0).rounded()))
    persistTodayMinutes(totalMinutes)

    return DerotBarReportConfiguration(rows: [], totalMinutes: totalMinutes)
  }
}

@main
struct DerotDeviceActivityReportExtension: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    DerotBarReportScene { configuration in
      DerotBarReportView(configuration: configuration)
    }
  }
}
