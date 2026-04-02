import DeviceActivity
import FamilyControls
import ManagedSettings
import SwiftUI

/// Must match `DeviceActivityReport.Context` in the main app (`derot-device-activity-chart` module).
extension DeviceActivityReport.Context {
  static let derotBar = Self("derotBar")
}

/// Renders today’s usage for the filter your app passes into `DeviceActivityReport` (monitored selection).
private struct DerotBarReportScene: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .derotBar

  struct Configuration {
    struct Row: Identifiable {
      let id: Int
      let application: Application
      let minutes: Double
    }

    var rows: [Row]
  }

  func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> Configuration {
    var rows: [(Application, Double)] = []
    for await datum in data {
      for await segment in datum.activitySegments {
        for await category in segment.categories {
          for await appActivity in category.applications {
            rows.append((appActivity.application, appActivity.totalActivityDuration / 60.0))
          }
        }
      }
    }
    rows.sort { $0.1 > $1.1 }
    let top = Array(rows.prefix(12))
    let numbered = top.enumerated().map {
      Configuration.Row(id: $0.offset, application: $0.element.0, minutes: $0.element.1)
    }
    return Configuration(rows: numbered)
  }

  var content: (Configuration) -> some View {
    { config in
      if config.rows.isEmpty {
        Text("No activity in this range for your monitored apps.")
          .font(.footnote)
          .foregroundStyle(.secondary)
          .padding()
      } else {
        List {
          ForEach(config.rows) { row in
            HStack {
              Label(row.application)
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
}

@main
struct DerotDeviceActivityReportExtension: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    DerotBarReportScene()
  }
}
