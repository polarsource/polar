from contextlib import AsyncExitStack

from textual.app import App
from textual.binding import Binding

from polar.worker import lifespan

from .db import engine
from .screens.dashboard import DashboardScreen
from .screens.organizations.list import OrganizationsListScreen
from .screens.pledges.list import PledgesListScreen
from .screens.repositories.list import RepositoriesListScreen


class PolarBackOffice(App[None]):
    MODES = {
        "dashboard": DashboardScreen,
        "pledges": PledgesListScreen,
        "organizations": OrganizationsListScreen,
        "repositories": RepositoriesListScreen,
    }
    BINDINGS = [
        ("d", "switch_mode('dashboard')", "Dashboard"),
        ("p", "switch_mode('pledges')", "Pledges"),
        ("o", "switch_mode('organizations')", "Organizations"),
        ("r", "switch_mode('repositories')", "Repositories"),
        Binding("f19", "take_screenshot()", "Take screenshot", show=False),
    ]

    async def on_load(self) -> None:
        self.exit_stack = AsyncExitStack()
        await self.exit_stack.enter_async_context(lifespan())

    def on_mount(self) -> None:
        self.title = "🌀 Polar.sh"
        self.switch_mode("dashboard")

    async def on_unmount(self) -> None:
        await self.exit_stack.aclose()
        await engine.dispose()

    def action_take_screenshot(self) -> None:
        filename = self.save_screenshot()
        self.notify(f"Saved in {filename}", title="Screenshot saved")


if __name__ == "__main__":
    app = PolarBackOffice()
    app.run()
