import webbrowser

from babel.dates import format_datetime
from babel.numbers import format_currency
from rich.text import Text
from sqlalchemy import case, desc, func, select, text
from sqlalchemy.orm import selectinload
from textual import work
from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import DataTable, Footer

from polar.account.service import account as account_service
from polar.enums import AccountType
from polar.models import Account, Transaction
from polar.worker import flush_enqueued_jobs
from polar_backoffice.utils import system_timezone

from ...db import sessionmaker
from ...widgets.confirm_modal import ConfirmModal
from ...widgets.header import PolarHeader
from ...widgets.search_bar import SearchBar


class AccountsListScreen(Screen[None]):
    BINDINGS = [
        ("ctrl+r", "refresh", "Refresh"),
        ("ctrl+s", "open_in_stripe", "Open in Stripe"),
        ("$", "confirm_account_reviewed", "Confirm reviewed"),
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

    def action_confirm_account_reviewed(self) -> None:
        table = self.query_one(DataTable)
        cell_key = table.coordinate_to_cell_key(table.cursor_coordinate)
        row_key = cell_key.row_key.value
        if row_key is None:
            return

        account = self.accounts[row_key]

        def check_confirm(confirm: bool) -> None:
            if confirm:
                self.confirm_account_reviewed(account)

        self.app.push_screen(
            ConfirmModal(
                "The account will be marked as reviewed "
                "and the transfers will be resumed. Do you confirm?"
            ),
            check_confirm,
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
                .where(Account.deleted_at.is_(None))
                .order_by(
                    case(
                        (Account.status == Account.Status.UNDER_REVIEW, 1),
                        (Account.status == Account.Status.ACTIVE, 2),
                        (Account.status == Account.Status.ONBOARDING_STARTED, 3),
                        (Account.status == Account.Status.CREATED, 4),
                    ),
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
                    AccountType.get_display_name(account.account_type),
                    account.admin.username_or_email,
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

    @work(exclusive=True)
    async def confirm_account_reviewed(self, account: Account) -> None:
        async with sessionmaker() as session:
            await account_service.confirm_account_reviewed(session, account)
        await flush_enqueued_jobs(self.app.arq_pool)  # type: ignore
        self.app.notify(
            "The account has been marked as reviewed. Held transfers will resume.",
            title="Account reviewed",
            timeout=5,
        )
        self.get_accounts()
