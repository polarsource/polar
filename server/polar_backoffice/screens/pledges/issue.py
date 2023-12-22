import webbrowser

from babel.dates import format_datetime
from babel.numbers import format_currency, format_percent
from rich.text import Text
from sqlalchemy import and_, desc, func, select, text
from sqlalchemy.orm import joinedload
from textual import on, work
from textual.app import ComposeResult
from textual.containers import Container
from textual.css.query import NoMatches
from textual.message import Message
from textual.screen import Screen
from textual.widget import Widget
from textual.widgets import Button, DataTable, Digits, Footer, Label, Rule, Static

from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models import Issue, IssueReward, Pledge, PledgeTransaction
from polar.models.pledge import PledgeState, PledgeType
from polar.pledge.schemas import Pledger
from polar.pledge.service import pledge as pledge_service
from polar.reward.service import reward_service

from ...db import sessionmaker
from ...utils import system_timezone
from ...widgets.confirm_modal import ConfirmModal
from ...widgets.header import PolarHeader


class PledgeReward(Widget):
    class Updated(Message):
        ...

    def __init__(
        self,
        pledge: Pledge,
        reward: IssueReward,
        pledge_transaction: PledgeTransaction | None,
        name: str | None = None,
        id: str | None = None,
        classes: str | None = None,
        disabled: bool = False,
    ) -> None:
        self.pledge = pledge
        self.reward = reward
        self.pledge_transaction = pledge_transaction

        rewarded_name = "Unknown"
        if self.reward.user is not None:
            rewarded_name = self.reward.user.username
        elif self.reward.organization is not None:
            rewarded_name = self.reward.organization.name
        elif self.reward.github_username:
            rewarded_name = self.reward.github_username

        self.rewarded_name = rewarded_name
        super().__init__(name=name, id=id, classes=classes, disabled=disabled)

    def compose(self) -> ComposeResult:
        with Container(classes="paid" if self.pledge_transaction else "unpaid"):
            amount = (
                self.reward.get_share_amount(self.pledge)
                if self.pledge_transaction is None
                else self.pledge_transaction.amount
            )
            label = Text.assemble(
                "→ ",
                (format_currency(amount / 100, "USD", locale="en_US"), "bold green"),
                (
                    (
                        f" ("
                        f"{format_percent(self.reward.share_thousands / 1000, locale="en_US")}"
                        ")"
                    ),
                    "bold",
                ),
                " to ",
                (self.rewarded_name, "bold"),
            )
            yield Label(label)
            if self.pledge_transaction:
                yield Label("Transferred", id="transfer-label")
            elif self.pledge.ready_for_transfer:
                yield Button("Create transfer", variant="primary", id="create_transfer")
            else:
                yield Label("Not ready for transfer", id="transfer-label")

    @on(Button.Pressed, "#create_transfer")
    def on_create_transfer(self, event: Button.Pressed) -> None:
        def check_confirm(confirm: bool) -> None:
            if confirm:
                event.button.disabled = True
                self.create_transfer()

        self.app.push_screen(
            ConfirmModal(
                f"The money will be transferred to {self.rewarded_name}. Do you confirm?"
            ),
            check_confirm,
        )

    @work(exclusive=True)
    async def create_transfer(self) -> None:
        async with sessionmaker() as session:
            try:
                await pledge_service.transfer(session, self.pledge.id, self.reward.id)
            except PolarError as e:
                self.app.bell()
                self.notify(e.message, severity="error", timeout=10)
            else:
                self.post_message(PledgeReward.Updated())
            finally:
                self.query_one("Button#create_transfer", Button).disabled = False


class PledgeRewards(Widget):
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

    def on_mount(self) -> None:
        self.get_rewards()

    def on_pledge_reward_updated(self, event: PledgeReward.Updated) -> None:
        self.get_rewards()

    @work(exclusive=True)
    async def get_rewards(self) -> None:
        self.remove_children()
        async with sessionmaker() as session:
            results = await reward_service.list(
                session, pledge_id=self.pledge.id, issue_id=self.pledge.issue_id
            )
            items = [
                PledgeReward(self.pledge, reward, pledge_transaction)
                for _, reward, pledge_transaction in results
            ]
            self.mount(*items)


class PledgeContainer(Widget):
    class Updated(Message):
        ...

    def __init__(
        self,
        pledge: Pledge,
        name: str | None = None,
        id: str | None = None,
        classes: str | None = None,
        disabled: bool = False,
    ) -> None:
        self.pledge = pledge
        pledger = Pledger.from_pledge(self.pledge)
        self.pledger_name = (
            pledger.github_username or pledger.name if pledger else "Anonymous"
        )
        super().__init__(name=name, id=id, classes=classes, disabled=disabled)

    def compose(self) -> ComposeResult:
        pledger = Pledger.from_pledge(self.pledge)
        pledger_name = (
            pledger.github_username or pledger.name if pledger else "Anonymous"
        )

        yield Static(
            f"Pledge by {pledger_name}",
            classes="header",
        )
        yield Digits(
            format_currency(self.pledge.amount / 100, "USD", locale="en_US"),
            classes="amount",
        )
        if (
            self.pledge.scheduled_payout_at
            and self.pledge.scheduled_payout_at > utc_now()
        ):
            yield Label(
                Text.assemble(
                    "Still in dispute window.",
                    (
                        f" Ends at {format_datetime(self.pledge.scheduled_payout_at, locale="en_US", tzinfo=system_timezone())}.",
                        "bold",
                    ),
                ),
                classes="dispute-window-warning",
            )
        with Container(classes="buttons"):
            if self.pledge.payment_id is not None:
                yield Button("View payment", id="view_payment")
            if self.pledge.type == PledgeType.pay_on_completion:
                if self.pledge.invoice_hosted_url is None:
                    yield Button("Send invoice", variant="primary", id="send_invoice")
                else:
                    yield Button("View invoice", id="view_invoice")
        yield Rule()
        yield PledgeRewards(self.pledge)

    @on(Button.Pressed, "#view_payment")
    def on_view_payment(self) -> None:
        if self.pledge.payment_id is not None:
            webbrowser.open_new_tab(
                f"https://dashboard.stripe.com/payments/{self.pledge.payment_id}"
            )

    @on(Button.Pressed, "#view_invoice")
    def on_view_invoice(self) -> None:
        if self.pledge.invoice_hosted_url is not None:
            webbrowser.open_new_tab(self.pledge.invoice_hosted_url)

    @on(Button.Pressed, "#send_invoice")
    def on_send_invoice(self, event: Button.Pressed) -> None:
        def check_confirm(confirm: bool) -> None:
            if confirm:
                event.button.disabled = True
                self.send_invoice()

        self.app.push_screen(
            ConfirmModal(
                f"The invoice will be sent to {self.pledger_name}. Do you confirm?"
            ),
            check_confirm,
        )

    @work(exclusive=True)
    async def send_invoice(self) -> None:
        async with sessionmaker() as session:
            await pledge_service.send_invoice(session, self.pledge.id)
            self.screen.notify("Invoice sent")
            self.post_message(PledgeContainer.Updated())


class PledgesIssueScreen(Screen[None]):
    CSS_PATH = "issue.tcss"
    BINDINGS = [
        ("escape", "pop_screen", "Back"),
        ("ctrl+r", "refresh", "Refresh"),
        ("ctrl+g", "open_in_github", "Open issue in GitHub"),
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
        yield Rule("vertical", line_style="heavy", classes="screen-separator")
        yield Footer()

    def on_mount(self) -> None:
        self.sub_title = self.issue.reference_key

        table = self.query_one(DataTable)
        table.add_columns(
            "Created at", "Pledger", "Amount", "Type", "State", "Rewards to transfer"
        )
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

    def on_pledge_container_updated(self, event: PledgeContainer.Updated) -> None:
        self.get_issue_pledges()

    def action_open_in_github(self) -> None:
        webbrowser.open_new_tab(
            f"https://github.com/{self.issue.organization.name}"
            f"/{self.issue.repository.name}/issues/{self.issue.number}"
        )

    @work(exclusive=True)
    async def get_issue_pledges(self) -> None:
        table = self.query_one(DataTable)
        previous_coordinate = table.cursor_coordinate
        table.loading = True
        table.clear()
        async with sessionmaker() as session:
            statement = (
                select(
                    Pledge,
                    # Count the rewards ready for transfer
                    func.count(IssueReward.id)
                    .filter(
                        PledgeTransaction.id.is_(None),
                        Pledge.ready_for_transfer.is_(True),
                    )
                    .over(partition_by=Pledge.id)
                    .label("pending_rewards_count"),
                )
                .join(
                    IssueReward,
                    onclause=Pledge.issue_id == IssueReward.issue_id,
                    isouter=True,
                )
                .join(
                    PledgeTransaction,
                    onclause=and_(
                        PledgeTransaction.pledge_id == Pledge.id,
                        PledgeTransaction.issue_reward_id == IssueReward.id,
                    ),
                    isouter=True,
                )
                .options(
                    joinedload(Pledge.on_behalf_of_organization),
                    joinedload(Pledge.user),
                    joinedload(Pledge.by_organization),
                )
                .where(
                    Pledge.state != PledgeState.initiated,
                    Pledge.issue_id == self.issue.id,
                )
                .order_by(
                    desc(text("pending_rewards_count")),
                    Pledge.created_at.desc(),
                )
            )
            stream = await session.stream(statement)
            async for pledge, pending_rewards_count in stream.unique():
                pledger = Pledger.from_pledge(pledge)
                pledger_name = (
                    pledger.github_username or pledger.name if pledger else "Anonymous"
                )
                table.add_row(
                    format_datetime(
                        pledge.created_at,
                        tzinfo=system_timezone(),
                        locale="en_US",
                    ),
                    pledger_name,
                    format_currency(pledge.amount / 100, "USD", locale="en_US"),
                    pledge.type,
                    pledge.state.capitalize(),
                    Text(
                        str(pending_rewards_count),
                        style="dark_orange" if pending_rewards_count > 0 else "",
                    ),
                    key=str(pledge.id),
                )
                self.pledges[str(pledge.id)] = pledge
        table.loading = False
        table.cursor_coordinate = previous_coordinate
        table.focus()
