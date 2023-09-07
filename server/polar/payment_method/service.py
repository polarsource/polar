from typing import Sequence
from uuid import UUID

import structlog
from stripe import PaymentMethod as StripePaymentMethod

from polar.models.payment_method import PaymentMethod
from polar.postgres import AsyncSession, sql

log = structlog.get_logger()


class PaymentMethodService:
    async def list_for_user(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[PaymentMethod]:
        stmt = sql.select(PaymentMethod).where(
            PaymentMethod.user_id == user_id,
            PaymentMethod.deleted_at.is_(None),
        )
        res = await session.execute(stmt)
        return res.scalars().all()

    async def create_for_user(
        self,
        session: AsyncSession,
        user_id: UUID,
        stripe_pm: StripePaymentMethod,
    ) -> PaymentMethod:
        pm = PaymentMethod(
            user_id=user_id,
            stripe_payment_method_id=stripe_pm.stripe_id,
            type="card",
            brand=stripe_pm.card.brand,
            last4=stripe_pm.last4,
        )

        session.add(pm)
        await session.commit()
        return pm


service = PaymentMethodService()
