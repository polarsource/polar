from textual.app import App

from .screens.dashboard import DashboardScreen
from .screens.pledges.list import PledgesListScreen


class PolarBackOffice(App[None]):
    MODES = {
        "dashboard": DashboardScreen,
        "pledges": PledgesListScreen,
    }
    BINDINGS = [
        ("d", "switch_mode('dashboard')", "Dashboard"),
        ("p", "switch_mode('pledges')", "Pledges"),
    ]

    def on_mount(self) -> None:
        self.title = "Polar.sh"
        self.switch_mode("dashboard")


if __name__ == "__main__":
    app = PolarBackOffice()
    app.run()
