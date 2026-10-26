import ExpoModulesCore
import UIKit

public class DuoHingeModule: Module {
  private var interaction: UIInteraction?
  private var latest: [String: Any]?

  public func definition() -> ModuleDefinition {
    Name("DuoHinge")
    Events("onHingeChange")

    Function("getHinge") { () -> [String: Any]? in
      self.latest
    }

    OnStartObserving {
      DispatchQueue.main.async { self.attach() }
    }

    OnStopObserving {
      DispatchQueue.main.async { self.detach() }
    }
  }

  private var keyWindow: UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }

  private func attach() {
    guard #available(iOS 27.1, *), interaction == nil, let window = keyWindow else { return }
    let hingeInteraction = UIHingeInteraction { [weak self] _, update in
      self?.publish(hinge: update.hinge)
    }
    window.addInteraction(hingeInteraction)
    interaction = hingeInteraction
  }

  private func detach() {
    if let interaction, let window = keyWindow {
      window.removeInteraction(interaction)
    }
    interaction = nil
  }

  @available(iOS 27.1, *)
  private func publish(hinge: UIHinge?) {
    var payload: [String: Any] = ["status": "unknown", "angle": 0]
    if let hinge {
      payload["status"] = Self.statusName(hinge.status)
      payload["angle"] = hinge.angle
    }
    if let window = keyWindow,
       let division = window.reservedRegions(kind: .division).first(where: { $0.isActive }) {
      payload["division"] = [
        "x": division.frame.minX,
        "y": division.frame.minY,
        "width": division.frame.width,
        "height": division.frame.height,
      ]
    }
    latest = payload
    sendEvent("onHingeChange", payload)
  }

  @available(iOS 27.1, *)
  private static func statusName(_ status: UIHinge.Status) -> String {
    switch status {
    case .closed: return "closed"
    case .partiallyOpen: return "partiallyOpen"
    case .fullyOpen: return "fullyOpen"
    default: return "unknown"
    }
  }
}
