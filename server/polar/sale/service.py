import uuid
from collections.abc import Sequence

import stripe as stripe_lib
from sqlalchemy import Select, and_, func, select, text
from sqlalchemy.orm import contains_eager, joinedload

from polar.account.service import account as account_service
from polar.auth.models import AuthSubject, is_organization, is_user
from polar.enums import UserSignupType
from polar.exceptions import PolarError
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.loops.service import loops as loops_service
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.models import (
    HeldBalance,
    Organization,
    Product,
    ProductPrice,
    Sale,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.transaction import TransactionType
from polar.notifications.notification import (
    MaintainerCreateAccountNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.organization.service import organization as organization_service
from polar.product.service.product_price import product_price as product_price_service
from polar.sale.schemas import SalesStatisticsPeriod
from polar.subscription.service import subscription as subscription_service
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)
from polar.user.service import user as user_service


class SaleError(PolarError): ...


class NotASaleInvoice(SaleError):
    def __init__(self, invoice_id: str) -> None:
        self.invoice_id = invoice_id
        message = (
            f"Received invoice {invoice_id} from Stripe, but it is not a sale."
            " Check if it's an issue pledge."
        )
        super().__init__(message)


class InvoiceWithNoOrMultipleLines(SaleError):
    def __init__(self, invoice_id: str) -> None:
        self.invoice_id = invoice_id
        message = (
            f"Received invoice {invoice_id} from Stripe " f"with no or multiple lines."
        )
        super().__init__(message)


class ProductPriceDoesNotExist(SaleError):
    def __init__(self, invoice_id: str, stripe_price_id: str) -> None:
        self.invoice_id = invoice_id
        self.stripe_price_id = stripe_price_id
        message = (
            f"Received invoice {invoice_id} from Stripe with price {stripe_price_id}, "
            f"but no associated ProductPrice exists."
        )
        super().__init__(message)


class SubscriptionDoesNotExist(SaleError):
    def __init__(self, invoice_id: str, stripe_subscription_id: str) -> None:
        self.invoice_id = invoice_id
        self.stripe_subscription_id = stripe_subscription_id
        message = (
            f"Received invoice {invoice_id} from Stripe "
            f"for subscription {stripe_subscription_id}, "
            f"but no associated Subscription exists."
        )
        super().__init__(message)


class InvoiceNotAvailable(SaleError):
    def __init__(self, sale: Sale) -> None:
        self.sale = sale
        message = "The invoice is not available for this sale."
        super().__init__(message, 404)


class SaleService(ResourceServiceReader[Sale]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: uuid.UUID | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[Sale], int]:
        statement = self._get_readable_sale_statement(auth_subject)

        statement = statement.options(
            joinedload(Sale.user),
            joinedload(Sale.product_price),
            joinedload(Sale.subscription),
        ).order_by(Sale.created_at.desc())

        if organization_id is not None:
            statement = statement.where(Product.organization_id == organization_id)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Sale | None:
        statement = (
            self._get_readable_sale_statement(auth_subject)
            .where(Sale.id == id)
            .options(
                joinedload(Sale.user),
                joinedload(Sale.product_price),
                joinedload(Sale.subscription),
            )
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_sale_invoice_url(self, sale: Sale) -> str:
        if sale.stripe_invoice_id is None:
            raise InvoiceNotAvailable(sale)

        stripe_invoice = stripe_service.get_invoice(sale.stripe_invoice_id)

        if stripe_invoice.hosted_invoice_url is None:
            raise InvoiceNotAvailable(sale)

        return stripe_invoice.hosted_invoice_url

    async def get_statistics_periods(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: uuid.UUID | None = None,
        product_id: uuid.UUID | None = None,
    ) -> Sequence[SalesStatisticsPeriod]:
        sale_statement = self._get_readable_sale_statement(auth_subject)
        subscription_statement = self._get_readable_subscription_statement(auth_subject)

        if organization_id is not None:
            sale_statement = sale_statement.where(
                Product.organization_id == organization_id
            )
            subscription_statement = subscription_statement.where(
                Product.organization_id == organization_id
            )

        if product_id is not None:
            sale_statement = sale_statement.where(Product.id == product_id)
            subscription_statement = subscription_statement.where(
                Product.id == product_id
            )

        statistics_periods: list[SalesStatisticsPeriod] = []

        # Effective Sales data
        date_column = func.generate_series(
            text("current_date - interval '11 month'"),
            text("current_date"),
            text("'1 month'::interval"),
        ).column_valued("date")
        sales_data_statement = (
            select(
                func.count(Sale.id).label("sales"),
                func.coalesce(func.sum(Sale.amount).label("earnings"), 0),
                func.date_trunc("month", date_column),
            )
            .join(
                Sale,
                onclause=and_(
                    func.date_trunc("month", Sale.created_at)
                    == func.date_trunc("month", date_column),
                    Sale.id.in_(sale_statement.with_only_columns(Sale.id)),
                ),
                isouter=True,
            )
            .group_by(date_column)
            .order_by(date_column)
        )

        sales_data = await session.execute(sales_data_statement)
        for sales, earnings, date in sales_data.all():
            statistics_periods.append(
                SalesStatisticsPeriod(
                    date=date,
                    sales=sales,
                    earnings=earnings,
                    expected_sales=0,
                    expected_earnings=0,
                )
            )

        # Add expected sales data by looking at active subscriptions renewal date
        current_date_column = text("current_date")
        expected_statement = (
            select(
                func.count(Subscription.id).label("sales"),
                func.coalesce(func.sum(ProductPrice.price_amount).label("earnings"), 0),
            )
            .add_columns(
                func.date_trunc("month", current_date_column),
                current_date_column,
            )
            .join(Subscription.price)
            .where(
                Subscription.active.is_(True),
                Subscription.current_period_end > current_date_column,
                func.date_trunc("month", Subscription.current_period_end)
                == func.date_trunc("month", current_date_column),
                Subscription.id.in_(
                    subscription_statement.with_only_columns(Subscription.id)
                ),
            )
        )

        expected_result = await session.execute(expected_statement)
        expected_sales, expected_earnings, date, _ = expected_result.one()
        statistics_periods[-1].expected_sales = expected_sales
        statistics_periods[-1].expected_earnings = expected_earnings

        return statistics_periods

    async def create_sale_from_stripe(
        self, session: AsyncSession, *, invoice: stripe_lib.Invoice
    ) -> Sale:
        assert invoice.charge is not None
        assert invoice.id is not None

        if invoice.metadata and invoice.metadata.get("type") in {
            ProductType.pledge,
            ProductType.donation,
        }:
            raise NotASaleInvoice(invoice.id)

        # Get price and product
        if len(invoice.lines.data) != 1:
            raise InvoiceWithNoOrMultipleLines(invoice.id)
        line = invoice.lines.data[0]
        assert line.price is not None
        stripe_price_id = line.price.id
        product_price = await product_price_service.get_by_stripe_price_id(
            session, stripe_price_id
        )
        if product_price is None:
            raise ProductPriceDoesNotExist(invoice.id, stripe_price_id)
        product = product_price.product

        user: User | None = None

        # Get subscription if applicable
        subscription: Subscription | None = None
        if invoice.subscription is not None:
            stripe_subscription_id = get_expandable_id(invoice.subscription)
            subscription = await subscription_service.get_by_stripe_subscription_id(
                session, stripe_subscription_id
            )
            if subscription is None:
                raise SubscriptionDoesNotExist(invoice.id, stripe_subscription_id)
            user = await user_service.get(session, subscription.user_id)

        # Get or create customer user
        assert invoice.customer is not None
        stripe_customer_id = get_expandable_id(invoice.customer)
        if user is None:
            user = await user_service.get_by_stripe_customer_id(
                session, stripe_customer_id
            )
            if user is None:
                assert invoice.customer_email is not None
                user = await user_service.get_by_email_or_signup(
                    session, invoice.customer_email, signup_type=UserSignupType.backer
                )

        # Take the chance to update Stripe customer ID and email marketing
        user.stripe_customer_id = stripe_customer_id
        await loops_service.user_update(user, isBacker=True)
        session.add(user)

        # Create Sale
        tax = invoice.tax or 0
        sale = Sale(
            amount=invoice.total - tax,
            tax_amount=tax,
            currency=invoice.currency,
            stripe_invoice_id=invoice.id,
            user=user,
            product=product,
            product_price=product_price,
            subscription=subscription,
        )
        session.add(sale)

        await self._create_sale_balance(
            session, sale, charge_id=get_expandable_id(invoice.charge)
        )

        return sale

    async def _create_sale_balance(
        self, session: AsyncSession, sale: Sale, charge_id: str
    ) -> None:
        product = sale.product
        account = await account_service.get_by_organization_id(
            session, product.organization_id
        )

        transfer_amount = sale.amount

        # Retrieve the payment transaction and link it to the sale
        payment_transaction = await balance_transaction_service.get_by(
            session, type=TransactionType.payment, charge_id=charge_id
        )
        if payment_transaction is None:
            raise PaymentTransactionForChargeDoesNotExist(charge_id)
        payment_transaction.sale = sale
        session.add(payment_transaction)

        # Prepare an held balance
        # It'll be used if the account is not created yet
        held_balance = HeldBalance(
            amount=transfer_amount, sale=sale, payment_transaction=payment_transaction
        )

        # No account, create the held balance
        if account is None:
            managing_organization = await organization_service.get(
                session, product.organization_id
            )
            assert managing_organization is not None
            held_balance.organization_id = managing_organization.id
            await held_balance_service.create(session, held_balance=held_balance)

            await notifications_service.send_to_org_admins(
                session=session,
                org_id=managing_organization.id,
                notif=PartialNotification(
                    type=NotificationType.maintainer_create_account,
                    payload=MaintainerCreateAccountNotificationPayload(
                        organization_name=managing_organization.name,
                        url=managing_organization.account_url,
                    ),
                ),
            )

            return

        # Account created, create the balance immediately
        balance_transactions = (
            await balance_transaction_service.create_balance_from_charge(
                session,
                source_account=None,
                destination_account=account,
                charge_id=charge_id,
                amount=transfer_amount,
                sale=sale,
            )
        )
        await platform_fee_transaction_service.create_fees_reversal_balances(
            session, balance_transactions=balance_transactions
        )

    def _get_readable_sale_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Sale]]:
        statement = (
            select(Sale)
            .where(Sale.deleted_at.is_(None))
            .join(Sale.product)
            .options(contains_eager(Sale.product))
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Product.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                        UserOrganization.is_admin.is_(True),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id,
            )

        return statement

    def _get_readable_subscription_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Subscription]]:
        statement = (
            select(Subscription)
            .where(Subscription.deleted_at.is_(None))
            .join(Subscription.product)
            .options(contains_eager(Subscription.product))
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Product.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                        UserOrganization.is_admin.is_(True),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id,
            )

        return statement


sale = SaleService(Sale)
