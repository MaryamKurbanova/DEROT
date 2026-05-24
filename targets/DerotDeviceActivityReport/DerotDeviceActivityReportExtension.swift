import DeviceActivity
import SwiftUI

/// Must match `DeviceActivityReport.Context` in the main app (`derot-device-activity-chart` module).
extension DeviceActivityReport.Context {
  static let derotBar = Self("derotBar")
}

struct DerotBarReportConfiguration {
  struct Row: Identifiable {
    let id: Int
    let title: String
    let minutes: Double
  }

  var rows: [Row]
}

/// Renders today’s usage for the filter your app passes into `DeviceActivityReport` (monitored selection).
private struct DerotBarReportView: View {
  let config: DerotBarReportConfiguration

  init(_ config: DerotBarReportConfiguration) {
    self.config = config
  }

  var body: some View {
    if config.rows.isEmpty {
      Text("No activity in this range for your monitored apps.")
        .font(.footnote)
        .foregroundStyle(.secondary)
        .padding()
    } else {
      List {
        ForEach(config.rows) { row in
          HStack {
            Text(row.title)
            Spacer()
            Text("\(Int(row.minutes))m")
              .monospacedDigit()
              .foregroundStyle(.secondary)
          }
        }
      }
      .listStyle(.plain)
    }
  }
}

private struct DerotBarReportScene: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .derotBar

  func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> DerotBarReportConfiguration {
    var rows: [(String, Double)] = []
    for await datum in data {
      for await segment in datum.activitySegments {
        for await category in segment.categories {
          for await appActivity in category.applications {
            let title = appActivity.application.localizedDisplayName ?? "App"
            rows.append((title, appActivity.totalActivityDuration / 60.0))
          }
        }
      }
    }
    rows.sort { $0.1 > $1.1 }
    let top = Array(rows.prefix(12))
    let numbered = top.enumerated().map {
      DerotBarReportConfiguration.Row(id: $0.offset, title: $0.element.0, minutes: $0.element.1)
    }
    return DerotBarReportConfiguration(rows: numbered)
  }
}

@main
struct DerotDeviceActivityReportExtension: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    DerotBarReportScene { configuration in
      DerotBarReportView(configuration)
    }
  }
}
