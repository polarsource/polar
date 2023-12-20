import webbrowser

from babel.numbers import format_currency
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from textual import work
from textual.app import ComposeResult
from textual.containers import Container
from textual.css.query import NoMatches
from textual.screen import Screen
from textual.widget import Widget
from textual.widgets import DataTable, Digits, Footer, Static

from polar.models import Issue, Pledge
from polar.models.pledge import PledgeState
from polar.pledge.schemas import Pledger

from ...db import sessionmaker
from ...widgets.header import PolarHeader


class PledgeContainer(Widget):
    def __init__(
        self,
        pledge: Pledge,
        name: str | None = None,
        id: str | None = None,
        classes: str | None = None,
        disabled: bool = False,
    ) -> None:
        self.pledge = pledge
        super().__init__(name=name, id=id, classes=classes, disabled=disabled)

    def compose(self) -> ComposeResult:
        pledger = Pledger.from_pledge(self.pledge)
        pledger_name = (
            pledger.github_username or pledger.name if pledger else "Anonymous"
        )

        yield Static(
            f"Pledge {self.pledge.id}",
            classes="header",
        )
        with Container(classes="info"):
            yield Digits(
                format_currency(self.pledge.amount / 100, "USD", locale="en_US"),
                classes="amount",
            )
            yield Static(pledger_name)
            yield Static(pledger_name)


class PledgesIssueScreen(Screen[None]):
    CSS_PATH = "issue.tcss"
    BINDINGS = [
        ("escape", "pop_screen", "Back"),
        ("ctrl+r", "refresh", "Refresh"),
        ("ctrl+g", "open_in_github", "Open issue in GitHub"),
        ("ctrl+s", "open_in_stripe", "Open in Stripe"),
    ]

    pledges: dict[str, Pledge] = {}

    def __init__(
        self,
        issue: Issue,
        name: str | None = None,
        id: str | None = None,
        classes: str | None = None,
    ) -> None:
        self.issue = issue
        super().__init__(name, id, classes)

    def compose(self) -> ComposeResult:
        yield PolarHeader()
        yield DataTable(cursor_type="row")
        yield Footer()

    def on_mount(self) -> None:
        self.sub_title = self.issue.reference_key

        table = self.query_one(DataTable)
        table.add_columns("Pledge ID", "Pledger", "Amount", "Type", "State")
        self.get_issue_pledges()

    def action_refresh(self) -> None:
        self.get_issue_pledges()

    def on_data_table_row_highlighted(self, event: DataTable.RowHighlighted) -> None:
        row_key = event.row_key.value
        if row_key is None:
            return

        try:
            pledge_container = self.query_one(PledgeContainer)
            pledge_container.remove()
        except NoMatches:
            pass
        pledge = self.pledges[row_key]
        self.mount(PledgeContainer(pledge), before=self.query_one(Footer))

    def action_open_in_github(self) -> None:
        webbrowser.open_new_tab(
            f"https://github.com/{self.issue.organization.name}"
            f"/{self.issue.repository.name}/issues/{self.issue.number}"
        )

    def action_open_in_stripe(self) -> None:
        table = self.query_one(DataTable)
        cell_key = table.coordinate_to_cell_key(table.cursor_coordinate)
        row_key = cell_key.row_key.value
        if row_key is None:
            return

        pledge = self.pledges[row_key]
        if pledge.payment_id is not None:
            webbrowser.open_new_tab(
                f"https://dashboard.stripe.com/payments/{pledge.payment_id}"
            )

    @work(exclusive=True)
    async def get_issue_pledges(self) -> None:
        table = self.query_one(DataTable)
        table.loading = True
        table.clear()
        async with sessionmaker() as session:
            statement = (
                select(Pledge)
                .options(
                    joinedload(Pledge.on_behalf_of_organization),
                    joinedload(Pledge.user),
                    joinedload(Pledge.by_organization),
                )
                .where(
                    Pledge.state != PledgeState.initiated,
                    Pledge.issue_id == self.issue.id,
                )
                .order_by(Pledge.created_at.desc())
            )
            stream = await session.stream_scalars(statement)
            async for pledge in stream.unique():
                pledger = Pledger.from_pledge(pledge)
                pledger_name = (
                    pledger.github_username or pledger.name if pledger else "Anonymous"
                )
                table.add_row(
                    str(pledge.id),
                    pledger_name,
                    format_currency(pledge.amount / 100, "USD", locale="en_US"),
                    pledge.type,
                    pledge.state.capitalize(),
                    key=str(pledge.id),
                )
                self.pledges[str(pledge.id)] = pledge
        table.loading = False
        table.focus()
