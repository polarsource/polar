from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    ColumnExpressionArgument,
    and_,
    distinct,
    func,
    or_,
    select,
    update,
)
from sqlalchemy.orm import InstrumentedAttribute, raiseload

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import (
    Checkout,
    Customer,
    Discount,
    DiscountRedemption,
    Order,
    Payment,
    Refund,
    Subscription,
)
from polar.models.checkout import CheckoutStatus
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.refund import RefundReason, RefundStatus


class DiscountRepository(RepositoryBase[Discount], RepositoryIDMixin[Discount, UUID]):
    model = Discount

    async def get_by_code_and_organization_for_update(
        self,
        code: str,
        organization_id: UUID,
        *,
        nowait: bool = False,
    ) -> Discount | None:
        """Get discount by code and organization with FOR UPDATE lock."""
        statement = (
            select(Discount)
            .where(
                func.upper(Discount.code) == code.upper(),
                Discount.organization_id == organization_id,
                ~Discount.is_deleted,
            )
            .with_for_update(nowait=nowait)
            .options(raiseload(Discount.organization))
        )
        return await self.get_one_or_none(statement)

    async def get_by_external_id_and_organization(
        self, external_id: str, organization_id: UUID
    ) -> Discount | None:
        statement = select(Discount).where(
            Discount.external_id == external_id,
            Discount.organization_id == organization_id,
            ~Discount.is_deleted,
        )
        return await self.get_one_or_none(statement)

    async def get_all_by_external_ids(
        self,
        organization_id: UUID,
        external_ids: Sequence[str],
        *,
        for_update: bool = False,
    ) -> Sequence[Discount]:
        statement = select(Discount).where(
            Discount.organization_id == organization_id,
            Discount.external_id.in_(external_ids),
            ~Discount.is_deleted,
        )
        if for_update:
            statement = statement.with_for_update(of=Discount, key_share=True)
        return await self.get_all(statement)

    async def get_all_by_codes(
        self, organization_id: UUID, codes: Sequence[str]
    ) -> Sequence[Discount]:
        statement = select(Discount).where(
            Discount.organization_id == organization_id,
            func.upper(Discount.code).in_([code.upper() for code in codes]),
            ~Discount.is_deleted,
        )
        return await self.get_all(statement)


class DiscountRedemptionRepository(
    RepositoryBase[DiscountRedemption], RepositoryIDMixin[DiscountRedemption, UUID]
):
    model = DiscountRedemption

    async def set_subscription_by_checkout(
        self, checkout_id: UUID, subscription_id: UUID
    ) -> None:
        statement = (
            update(DiscountRedemption)
            .values(subscription_id=subscription_id)
            .where(DiscountRedemption.checkout_id == checkout_id)
        )
        await self.session.execute(statement)

    async def count_redemptions_by_customer(
        self,
        discount_id: UUID,
        *,
        exclude_checkout_id: UUID,
        customer_id: UUID | None = None,
        customer_email: str | None = None,
        payment_method_fingerprint: str | None = None,
    ) -> int:
        """
        Count past redemptions of a discount attributable to a given customer.

        The customer is identified by any of the provided hints (OR logic), mirroring
        the trial-abuse feature: customer ID, unaliased email, or payment method
        fingerprint. Identity is derived by joining the redemption's linked checkout
        (customer ID + email), its subscription (customer ID + email, for discounts
        applied to an existing subscription) and payment (card fingerprint, only
        present when a charge occurred).

        A redemption whose orders are all fully refunded doesn't count, unless the
        refund was issued to head off a chargeback. A redemption with no order
        counts only while its checkout is still confirmed, or when it is tied to
        a subscription. The global ``redemptions_count`` uses the same orphan
        rule, and still counts a redemption that has any order.

        The current, in-progress redemption is excluded via ``exclude_checkout_id``.
        """

        def unalias(column: InstrumentedAttribute[str | None]) -> ColumnElement[str]:
            # Strip the `+alias` suffix from the local part in SQL, mirroring
            # `polar.kit.email.unalias_email`. The provided `customer_email` is
            # expected to be already unaliased and lowercased.
            return func.regexp_replace(func.lower(column), r"\+[^@]*", "")

        clauses: list[ColumnExpressionArgument[bool]] = []

        if customer_id is not None:
            clauses.append(Checkout.customer_id == customer_id)
            clauses.append(Subscription.customer_id == customer_id)

        if customer_email is not None:
            clauses.append(unalias(Checkout.customer_email) == customer_email)
            clauses.append(unalias(Customer.email) == customer_email)

        if payment_method_fingerprint is not None:
            clauses.append(
                Payment.method_metadata["fingerprint"].astext
                == payment_method_fingerprint
            )

        # No hints to match against: nothing can be attributed to the customer.
        if not clauses:
            return 0

        # NULL-safe: a checkout-less redemption never matches a checkout-less order.
        redemption_orders = select(Order.id).where(
            or_(
                Order.checkout_id == DiscountRedemption.checkout_id,
                Order.subscription_id == DiscountRedemption.subscription_id,
            )
        )
        chargeback_prevented = (
            select(Refund.id)
            .where(
                Refund.order_id == Order.id,
                Refund.status == RefundStatus.succeeded,
                Refund.reason == RefundReason.dispute_prevention,
            )
            .exists()
        )

        statement = (
            select(func.count(distinct(DiscountRedemption.id)))
            .join(Checkout, Checkout.id == DiscountRedemption.checkout_id, isouter=True)
            .join(
                Subscription,
                Subscription.id == DiscountRedemption.subscription_id,
                isouter=True,
            )
            .join(Customer, Customer.id == Subscription.customer_id, isouter=True)
            .where(
                DiscountRedemption.discount_id == discount_id,
                # NULL-safe: subscription-only redemptions have no checkout.
                DiscountRedemption.checkout_id.is_distinct_from(exclude_checkout_id),
                or_(*clauses),
                or_(
                    and_(
                        ~redemption_orders.exists(),
                        or_(
                            Checkout.status == CheckoutStatus.confirmed,
                            DiscountRedemption.subscription_id.is_not(None),
                        ),
                    ),
                    redemption_orders.where(
                        Order.status.in_(OrderStatus.paid_statuses())
                    ).exists(),
                    redemption_orders.where(chargeback_prevented).exists(),
                ),
            )
        )

        if payment_method_fingerprint is not None:
            statement = statement.join(
                Payment,
                (Payment.checkout_id == DiscountRedemption.checkout_id)
                # A retried checkout keeps its declined attempts.
                & (Payment.status == PaymentStatus.succeeded),
                isouter=True,
            )

        result = await self.session.execute(statement)
        return result.scalar_one()
