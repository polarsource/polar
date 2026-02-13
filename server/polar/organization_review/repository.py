from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from polar.kit.repository.base import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.account import Account
from polar.models.dispute import Dispute
from polar.models.organization import Organization
from polar.models.organization_review import OrganizationReview
from polar.models.payment import Payment, PaymentStatus
from polar.models.product import Product
from polar.models.refund import Refund, RefundStatus
from polar.models.user import User
from polar.models.user_organization import UserOrganization


class OrganizationReviewRepository(
    RepositorySoftDeletionIDMixin[OrganizationReview, UUID],
    RepositorySoftDeletionMixin[OrganizationReview],
    RepositoryBase[OrganizationReview],
):
    model = OrganizationReview

    async def get_account_with_admin(
        self, account_id: UUID
    ) -> Account | None:
        statement = (
            select(Account)
            .where(Account.id == account_id, Account.deleted_at.is_(None))
            .options(joinedload(Account.admin))
        )
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_products_with_prices(
        self, organization_id: UUID
    ) -> list[Product]:
        statement = (
            select(Product)
            .where(
                Product.organization_id == organization_id,
                Product.deleted_at.is_(None),
            )
            .options(selectinload(Product.prices))
        )
        result = await self.session.execute(statement)
        return list(result.scalars().unique().all())

    async def get_payment_stats(
        self, organization_id: UUID
    ) -> tuple[int, int, int]:
        """Returns (total_payments, succeeded_payments, total_amount_cents)."""
        statement = select(
            func.count(Payment.id),
            func.count(Payment.id).filter(
                Payment.status == PaymentStatus.succeeded
            ),
            func.coalesce(
                func.sum(Payment.amount).filter(
                    Payment.status == PaymentStatus.succeeded
                ),
                0,
            ),
        ).where(
            Payment.organization_id == organization_id,
            Payment.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        row = result.one()
        return row[0], row[1], row[2]

    async def get_risk_scores(
        self, organization_id: UUID
    ) -> list[int]:
        statement = select(Payment.risk_score).where(
            Payment.organization_id == organization_id,
            Payment.status == PaymentStatus.succeeded,
            Payment.risk_score.is_not(None),
            Payment.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return [row[0] for row in result.all()]

    async def get_refund_stats(
        self, organization_id: UUID
    ) -> tuple[int, int]:
        """Returns (refund_count, refund_amount_cents)."""
        statement = select(
            func.count(Refund.id),
            func.coalesce(func.sum(Refund.amount), 0),
        ).where(
            Refund.organization_id == organization_id,
            Refund.status == RefundStatus.succeeded,
            Refund.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        row = result.one()
        return row[0], row[1]

    async def get_dispute_stats(
        self, organization_id: UUID
    ) -> tuple[int, int]:
        """Returns (dispute_count, dispute_amount_cents)."""
        statement = select(
            func.count(Dispute.id),
            func.coalesce(func.sum(Dispute.amount), 0),
        ).where(
            Dispute.payment_id.in_(
                select(Payment.id).where(
                    Payment.organization_id == organization_id,
                    Payment.deleted_at.is_(None),
                )
            ),
            Dispute.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        row = result.one()
        return row[0], row[1]

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        statement = select(User).where(User.id == user_id)
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_other_organizations_for_user(
        self, user_id: UUID, exclude_organization_id: UUID
    ) -> list[Organization]:
        statement = (
            select(Organization)
            .join(
                UserOrganization,
                UserOrganization.organization_id == Organization.id,
            )
            .where(
                UserOrganization.user_id == user_id,
                Organization.id != exclude_organization_id,
                Organization.deleted_at.is_(None),
            )
            .options(joinedload(Organization.review))
        )
        result = await self.session.execute(statement)
        return list(result.scalars().unique().all())
