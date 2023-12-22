from contextlib import AsyncExitStack

from textual.app import App

from polar.worker import lifespan

from .db import engine
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

    async def on_load(self) -> None:
        self.exit_stack = AsyncExitStack()
        await self.exit_stack.enter_async_context(lifespan())

    def on_mount(self) -> None:
        self.title = "🌀 Polar.sh"
        self.switch_mode("dashboard")

    async def on_unmount(self) -> None:
        await self.exit_stack.aclose()
        await engine.dispose()


if __name__ == "__main__":
    app = PolarBackOffice()
    app.run()
