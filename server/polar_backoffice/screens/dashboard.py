from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import Footer, Markdown

from ..widgets.header import PolarHeader

EXAMPLE_MARKDOWN = """\
# Polar.sh back-office tool

This is the back-office tool to manage Polar 🏗️
"""


class DashboardScreen(Screen[None]):
    def compose(self) -> ComposeResult:
        yield PolarHeader()
        yield Markdown(EXAMPLE_MARKDOWN)
        yield Footer()

    def on_mount(self) -> None:
        self.sub_title = "Dashboard"
