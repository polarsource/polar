import textwrap
import webbrowser

from babel.numbers import format_currency
from rich.text import Text
from sqlalchemy import and_, func, select
from sqlalchemy.orm import contains_eager
from textual import work
from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import DataTable, Footer

from polar.issue.search import search_query
from polar.models import Issue, Organization, Pledge, Repository
from polar.models.pledge import PledgeState

from ...db import sessionmaker
from ...widgets.header import PolarHeader
from ...widgets.search_bar import SearchBar
from .issue import PledgesIssueScreen


class PledgesListScreen(Screen[None]):
    BINDINGS = [
        ("ctrl+r", "refresh", "Refresh"),
        ("ctrl+f", "find", "Find"),
        ("ctrl+g", "open_in_github", "Open in GitHub"),
    ]

    issues: dict[str, Issue] = {}
    search_query: str | None = None

    def compose(self) -> ComposeResult:
        yield PolarHeader()
        yield DataTable(cursor_type="row")
        yield Footer()
        yield SearchBar()

    def on_mount(self) -> None:
        self.sub_title = "Pledges"

        table = self.query_one(DataTable)
        table.add_columns(
            "Issue ID",
            "Issue Title",
            "State",
            "Confirmation state",
            "Number of pledges",
            "Amount pledged",
        )
        self.get_pledges_per_issue()

    def action_refresh(self) -> None:
        self.get_pledges_per_issue()

    def action_find(self) -> None:
        search_bar = self.query_one(SearchBar)
        search_bar.toggle()

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

    def on_search_bar_submitted(self, event: SearchBar.Submitted) -> None:
        self.search_query = event.query
        self.get_pledges_per_issue()

    def on_search_bar_cleared(self, event: SearchBar.Cleared) -> None:
        self.search_query = None
        self.get_pledges_per_issue()

    @work(exclusive=True)
    async def get_pledges_per_issue(self) -> None:
        table = self.query_one(DataTable)
        table.loading = True
        table.clear()
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
                .join(Organization, onclause=Issue.organization_id == Organization.id)
                .join(Repository, onclause=Issue.repository_id == Repository.id)
                .options(
                    contains_eager(Issue.pledges),
                    contains_eager(Issue.organization),
                    contains_eager(Issue.repository),
                )
            ).order_by(Pledge.created_at.desc())

            if self.search_query:
                clauses = self.search_query.split()
                fuzzy_clauses = []
                for clause in clauses:
                    if clause.startswith("org:"):
                        statement = statement.where(
                            Organization.name.ilike(f"%{clause[len("org:"):]}%")
                        )
                    elif clause.startswith("repo:"):
                        statement = statement.where(
                            Repository.name.ilike(f"%{clause[len("repo:"):]}%")
                        )
                    elif clause.startswith("#:"):
                        statement = statement.where(
                            Issue.number == int(clause[len("#:") :])
                        )
                    else:
                        fuzzy_clauses.append(clause)
                if len(fuzzy_clauses):
                    fuzzy_query = search_query(" ".join(fuzzy_clauses))
                    statement = statement.where(
                        Issue.title_tsv.bool_op("@@")(func.to_tsquery(fuzzy_query))
                    )

            stream = await session.stream_scalars(statement)
            async for issue in stream.unique():
                confirmation_state = Text()
                if issue.needs_confirmation_solved:
                    confirmation_state.append(
                        "Needs confirmation", style="bold dark_orange"
                    )
                elif issue.confirmed_solved_at:
                    confirmation_state.append("Confirmed", style="green")
                else:
                    confirmation_state.append("Not confirmed")

                table.add_row(
                    issue.reference_key,
                    textwrap.shorten(issue.title, 64),
                    issue.state.capitalize(),
                    confirmation_state,
                    len(issue.pledges),
                    format_currency(
                        issue.pledged_amount_sum / 100, "USD", locale="en_US"
                    ),
                    key=str(issue.id),
                )
                self.issues[str(issue.id)] = issue
            table.loading = False
            table.focus()
