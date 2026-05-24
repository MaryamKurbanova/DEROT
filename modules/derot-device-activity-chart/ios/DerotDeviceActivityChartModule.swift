import ExpoModulesCore
import SwiftUI
import UIKit

/// Native chart host — `DeviceActivityReport` is rendered by the report extension, not inlined here.
/// This avoids duplicate `DeviceActivityReport` / filter initializer issues in the main app target.
private struct DerotChartPlaceholder: View {
  var body: some View {
    Color.clear
  }
}

final class DerotDeviceActivityChartExpoView: ExpoView {
  private var host: UIHostingController<DerotChartPlaceholder>?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .clear
  }

  func applySelectionId(_ id: String) {
    guard #available(iOS 16.0, *) else { return }
    if host == nil {
      let h = UIHostingController(rootView: DerotChartPlaceholder())
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
