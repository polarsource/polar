import webbrowser

from babel.dates import format_datetime
from sqlalchemy import select
from textual import work
from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import DataTable, Footer

from polar.models import Organization
from polar_backoffice.screens.repositories.list import (
    OrganizationRepositoriesListScreen,
)
from polar_backoffice.utils import system_timezone

from ...db import sessionmaker
from ...widgets.header import PolarHeader
from ...widgets.search_bar import SearchBar


class OrganizationsListScreen(Screen[None]):
    BINDINGS = [
        ("ctrl+r", "refresh", "Refresh"),
        ("ctrl+f", "find", "Find"),
        ("ctrl+g", "open_in_github", "Open in GitHub"),
        ("ctrl+p", "open_in_polar", "Open in Polar"),
    ]

    organizations: dict[str, Organization] = {}
    search_query: str | None = None

    def compose(self) -> ComposeResult:
        yield PolarHeader()
        yield DataTable(cursor_type="row")
        yield Footer()
        yield SearchBar()

    def on_mount(self) -> None:
        self.sub_title = "Organizations"

        table = self.query_one(DataTable)
        table.add_columns(
            "Name", "Platform", "Personal", "Teams enabled", "Installed at"
        )
        self.get_organizations()

    def action_refresh(self) -> None:
        self.get_organizations()

    def action_find(self) -> None:
        search_bar = self.query_one(SearchBar)
        search_bar.toggle()

    def action_open_in_github(self) -> None:
        table = self.query_one(DataTable)
        cell_key = table.coordinate_to_cell_key(table.cursor_coordinate)
        row_key = cell_key.row_key.value
        if row_key is None:
            return

        organization = self.organizations[row_key]
        webbrowser.open_new_tab(f"https://github.com/{organization.name}")

    def action_open_in_polar(self) -> None:
        table = self.query_one(DataTable)
        cell_key = table.coordinate_to_cell_key(table.cursor_coordinate)
        row_key = cell_key.row_key.value
        if row_key is None:
            return

        organization = self.organizations[row_key]
        webbrowser.open_new_tab(organization.polar_site_url)

    async def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        row_key = event.row_key.value
        if row_key is None:
            return

        organization = self.organizations[row_key]
        self.app.push_screen(OrganizationRepositoriesListScreen(organization))

    def on_search_bar_submitted(self, event: SearchBar.Submitted) -> None:
        self.search_query = event.query
        self.get_organizations()

    def on_search_bar_cleared(self, event: SearchBar.Cleared) -> None:
        self.search_query = None
        self.get_organizations()

    @work(exclusive=True)
    async def get_organizations(self) -> None:
        table = self.query_one(DataTable)
        table.loading = True
        table.clear()
        async with sessionmaker() as session:
            statement = (
                (select(Organization))
                .where(Organization.installation_id.is_not(None))
                .order_by(Organization.name)
            )

            if self.search_query:
                statement = statement.where(
                    Organization.name.ilike(f"%{self.search_query}%")
                )

            stream = await session.stream_scalars(statement)
            async for organization in stream.unique():
                table.add_row(
                    organization.name,
                    organization.platform,
                    "✅" if organization.is_personal else "❌",
                    "✅" if organization.is_teams_enabled else "❌",
                    format_datetime(
                        organization.installation_created_at,
                        locale="en_US",
                        tzinfo=system_timezone(),
                    ),
                    key=str(organization.id),
                )
                self.organizations[str(organization.id)] = organization
            table.loading = False
            table.focus()
