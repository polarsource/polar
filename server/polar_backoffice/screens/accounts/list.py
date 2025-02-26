import webbrowser

from babel.dates import format_datetime
from babel.numbers import format_currency
from rich.text import Text
from sqlalchemy import desc, func, select, text
from sqlalchemy.orm import selectinload
from textual import work
from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import DataTable, Footer

from polar.enums import AccountType
from polar.models import Account, Transaction
from polar_backoffice.utils import system_timezone

from ...db import sessionmaker
from ...widgets.header import PolarHeader
from ...widgets.search_bar import SearchBar


class AccountsListScreen(Screen[None]):
    BINDINGS = [
        ("ctrl+r", "refresh", "Refresh"),
        ("ctrl+s", "open_in_stripe", "Open in Stripe"),
    ]

    accounts: dict[str, Account] = {}

    def compose(self) -> ComposeResult:
        yield PolarHeader()
        yield DataTable(cursor_type="row")
        yield Footer()
        yield SearchBar()

    def on_mount(self) -> None:
        self.sub_title = "Accounts"

        table = self.query_one(DataTable)
        table.add_columns("Created at", "Type", "Admin", "Used by", "Balance", "Status")
        self.get_accounts()

    def action_refresh(self) -> None:
        self.get_accounts()

    def action_open_in_stripe(self) -> None:
        table = self.query_one(DataTable)
        cell_key = table.coordinate_to_cell_key(table.cursor_coordinate)
        row_key = cell_key.row_key.value
        if row_key is None:
            return

        account = self.accounts[row_key]

        if account.account_type != AccountType.stripe:
            self.notify("Not a Stripe account")
            return

        webbrowser.open_new_tab(
            f"https://dashboard.stripe.com/connect/accounts/{account.stripe_id}"
        )

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        row_key = event.row_key.value
        if row_key is None:
            return

        account = self.accounts[row_key]

    @work(exclusive=True)
    async def get_accounts(self) -> None:
        table = self.query_one(DataTable)
        table.loading = True
        table.clear()
        async with sessionmaker() as session:
            statement = (
                select(
                    Account,
                    func.coalesce(
                        func.sum(Transaction.amount).over(partition_by=Account.id),
                        0,
                    ).label("balance"),
                )
                .join(
                    Transaction,
                    onclause=Transaction.account_id == Account.id,
                    isouter=True,
                )
                .where(
                    Account.deleted_at.is_(None),
                    Account.status == Account.Status.UNDER_REVIEW,
                )
                .order_by(
                    desc(text("balance")),
                    Account.created_at.desc(),
                )
                .options(
                    selectinload(Account.admin),
                    selectinload(Account.users),
                    selectinload(Account.organizations),
                )
            )

            stream = await session.stream(statement)
            async for result in stream.unique():
                account, balance = result._tuple()
                table.add_row(
                    format_datetime(
                        account.created_at, locale="en_US", tzinfo=system_timezone()
                    ),
                    account.account_type.get_display_name(),
                    account.admin.email,
                    ", ".join(account.get_associations_names()),
                    format_currency(balance / 100, "USD", locale="en_US"),
                    Text(
                        account.status,
                        style="dark_orange" if account.is_under_review() else "",
                    ),
                    key=str(account.id),
                )
                self.accounts[str(account.id)] = account
            table.loading = False
            table.focus()
