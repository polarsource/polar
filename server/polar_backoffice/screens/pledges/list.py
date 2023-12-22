import webbrowser

from babel.numbers import format_currency
from sqlalchemy import and_, select
from sqlalchemy.orm import contains_eager, joinedload
from textual import work
from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import DataTable, Footer, Header

from polar.models import Issue, Pledge
from polar.models.pledge import PledgeState

from ...db import sessionmaker
from .issue import PledgesIssueScreen


class PledgesListScreen(Screen[None]):
    issues: dict[str, Issue] = {}

    BINDINGS = [("ctrl+g", "open_in_github", "Open in GitHub")]

    def compose(self) -> ComposeResult:
        yield Header()
        yield DataTable(cursor_type="row")
        yield Footer()

    def on_mount(self) -> None:
        self.sub_title = "Pledges"

        table = self.query_one(DataTable)
        table.add_columns(
            "Issue ID", "Issue Title", "State", "Number of pledges", "Amount pledged"
        )
        self.get_pledges_per_issue()

    def action_open_in_github(self) -> None:
        table = self.query_one(DataTable)
        cell_key = table.coordinate_to_cell_key(table.cursor_coordinate)
        row_key = cell_key.row_key.value
        if row_key is None:
            return

        issue = self.issues[row_key]
        webbrowser.open_new_tab(
            f"https://github.com/{issue.organization.name}"
            f"/{issue.repository.name}/issues/{issue.number}"
        )

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        row_key = event.row_key.value
        if row_key is None:
            return

        issue = self.issues[row_key]
        self.app.push_screen(PledgesIssueScreen(issue))

    @work(exclusive=True)
    async def get_pledges_per_issue(self) -> None:
        table = self.query_one(DataTable)
        async with sessionmaker() as session:
            statement = (
                select(Issue)
                .join(
                    Pledge,
                    onclause=and_(
                        Pledge.issue_id == Issue.id,
                        Pledge.state != PledgeState.initiated,
                    ),
                )
                .options(
                    contains_eager(Issue.pledges),
                    joinedload(Issue.organization),
                    joinedload(Issue.repository),
                )
            ).order_by(Pledge.created_at.desc())
            stream = await session.stream_scalars(statement)
            async for issue in stream.unique():
                table.add_row(
                    issue.reference_key,
                    issue.title,
                    issue.state.capitalize(),
                    len(issue.pledges),
                    format_currency(
                        issue.pledged_amount_sum / 100, "USD", locale="en_US"
                    ),
                    key=str(issue.id),
                )
                self.issues[str(issue.id)] = issue
