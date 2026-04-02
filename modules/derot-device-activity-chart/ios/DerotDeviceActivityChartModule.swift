import DeviceActivity
import ExpoModulesCore
import FamilyControls
import SwiftUI
import UIKit

extension DeviceActivityReport.Context {
  static let derotBar = Self("derotBar")
}

private func derotDecodeSelection(_ base64: String) -> FamilyActivitySelection {
  guard let data = Data(base64Encoded: base64),
        let decoded = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
  else {
    return FamilyActivitySelection()
  }
  return decoded
}

private func derotAppGroupId() -> String? {
  Bundle.main.object(forInfoDictionaryKey: "REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP") as? String
}

private func derotLoadSelection(selectionId: String) -> FamilyActivitySelection? {
  guard let group = derotAppGroupId(),
        let ud = UserDefaults(suiteName: group),
        let dict = ud.dictionary(forKey: "familyActivitySelectionIds"),
        let str = dict[selectionId] as? String
  else {
    return nil
  }
  let decoded = derotDecodeSelection(str)
  if decoded.applicationTokens.isEmpty && decoded.categoryTokens.isEmpty && decoded.webDomainTokens.isEmpty {
    return nil
  }
  return decoded
}

private struct DerotReportHost: View {
  let selection: FamilyActivitySelection

  private var filter: DeviceActivityFilter {
    let day = Calendar.current.dateInterval(of: .day, for: Date())!
    return DeviceActivityFilter(
      segment: .daily(during: day),
      devices: .all,
      applications: selection.applicationTokens,
      categories: selection.categoryTokens,
      webDomains: selection.webDomainTokens
    )
  }

  var body: some View {
    DeviceActivityReport(.derotBar, filter: filter)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

final class DerotDeviceActivityChartExpoView: ExpoView {
  private var host: UIHostingController<DerotReportHost>?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .clear
  }

  func applySelectionId(_ id: String) {
    guard #available(iOS 16.0, *) else { return }
    guard !id.isEmpty, let sel = derotLoadSelection(selectionId: id) else {
      host?.view.removeFromSuperview()
      host = nil
      return
    }
    let root = DerotReportHost(selection: sel)
    if let existing = host {
      existing.rootView = root
    } else {
      let h = UIHostingController(rootView: root)
      h.view.backgroundColor = .clear
      host = h
      addSubview(h.view)
    }
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    host?.view.frame = bounds
  }
}

public final class DerotDeviceActivityChartModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DerotDeviceActivityChart")

    View(DerotDeviceActivityChartExpoView.self) {
      Prop("familyActivitySelectionId") { (view: DerotDeviceActivityChartExpoView, id: String) in
        view.applySelectionId(id)
      }
    }
  }
}
