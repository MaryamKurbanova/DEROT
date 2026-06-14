import DeviceActivity
import ExpoModulesCore
import FamilyControls
import ManagedSettings
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

private func derotSaveSelection(id: String, selection: FamilyActivitySelection) {
  guard let group = derotAppGroupId(),
        let ud = UserDefaults(suiteName: group)
  else {
    return
  }
  let encoder = JSONEncoder()
  guard let data = try? encoder.encode(selection) else { return }
  let encoded = data.base64EncodedString()
  var dict = ud.dictionary(forKey: "familyActivitySelectionIds") ?? [:]
  dict[id] = encoded
  ud.set(dict, forKey: "familyActivitySelectionIds")
}

@available(iOS 15.0, *)
private func derotEnsureAppSelection(appId: String, bundleIdentifier: String) -> Bool {
  let selectionId = "derot_lock_\(appId)"
  if let existing = derotLoadSelection(selectionId: selectionId),
     existing.applicationTokens.count == 1,
     existing.categoryTokens.isEmpty,
     existing.webDomainTokens.isEmpty
  {
    return true
  }

  guard let application = Application(bundleIdentifier: bundleIdentifier) else {
    return false
  }

  var selection = FamilyActivitySelection()
  selection.applicationTokens = Set([application.token])
  guard selection.applicationTokens.count == 1 else { return false }

  derotSaveSelection(id: selectionId, selection: selection)
  return true
}

private struct DerotReportHost: View {
  let selection: FamilyActivitySelection

  private var filterApplications: Set<ApplicationToken> {
    if !selection.categoryTokens.isEmpty { return [] }
    return selection.applicationTokens
  }

  private var filterCategories: Set<ActivityCategoryToken> {
    selection.categoryTokens
  }

  private var filterWebDomains: Set<WebDomainToken> {
    if !selection.categoryTokens.isEmpty || !selection.applicationTokens.isEmpty { return [] }
    return selection.webDomainTokens
  }

  private var usesFullDayFilter: Bool {
    selection.applicationTokens.isEmpty
      && selection.categoryTokens.isEmpty
      && selection.webDomainTokens.isEmpty
  }

  private var filter: DeviceActivityFilter {
    let day = Calendar.current.dateInterval(of: .day, for: Date())!
    if usesFullDayFilter {
      if #available(iOS 17.0, *) {
        return DeviceActivityFilter(
          segment: .daily(during: day),
          users: .all,
          devices: .all
        )
      }
      return DeviceActivityFilter(segment: .daily(during: day), devices: .all)
    }
    let apps = filterApplications
    let cats = filterCategories
    let web = filterWebDomains
    if #available(iOS 17.0, *) {
      return DeviceActivityFilter(
        segment: .daily(during: day),
        users: .all,
        devices: .all,
        applications: apps,
        categories: cats,
        webDomains: web
      )
    }
    return DeviceActivityFilter(
      segment: .daily(during: day),
      devices: .all,
      applications: apps,
      categories: cats,
      webDomains: web
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
    _ = id
    let root = DerotReportHost(selection: FamilyActivitySelection())
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

    Function("isAvailable") { () -> Bool in
      true
    }

    Function("ensureAppSelectionForBundle") { (appId: String, bundleIdentifier: String) -> Bool in
      guard #available(iOS 15.0, *) else { return false }
      return derotEnsureAppSelection(appId: appId, bundleIdentifier: bundleIdentifier)
    }

    View(DerotDeviceActivityChartExpoView.self) {
      Prop("familyActivitySelectionId") { (view: DerotDeviceActivityChartExpoView, id: String) in
        view.applySelectionId(id)
      }
    }
  }
}
