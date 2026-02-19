from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import register_entities
from sqlalchemy import TIMESTAMP, BigInteger, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.enums import AccountType
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .payout import Payout


class PayoutAttemptStatus(StrEnum):
    pending = "pending"
    in_transit = "in_transit"
    succeeded = "succeeded"
    failed = "failed"

    @classmethod
    def from_stripe(cls, stripe_status: str) -> "PayoutAttemptStatus":
        if stripe_status == "in_transit":
            return cls.in_transit
        if stripe_status == "paid":
            return cls.succeeded
        if stripe_status == "failed":
            return cls.failed
        return cls.pending


class PayoutAttempt(RecordModel):
    __tablename__ = "payout_attempts"

    payout_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("payouts.id", ondelete="cascade"), nullable=False
    )
    """ID of the associated Payout."""
    payout: Mapped["Payout"] = relationship("Payout", back_populates="attempts")

    processor: Mapped[AccountType] = mapped_column(
        StringEnum(AccountType), nullable=False
    )
    """Payment processor used for this payout attempt."""
    processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True, unique=False
    )
    """ID of the payout in the payment processor (Stripe payout ID)."""
    status: Mapped[PayoutAttemptStatus] = mapped_column(
        StringEnum(PayoutAttemptStatus),
        nullable=False,
        index=True,
        default=PayoutAttemptStatus.pending,
    )
    """Status of this payout attempt."""
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    """Amount in smallest currency units for this payout attempt."""
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    """Currency of this payout attempt."""
    failed_reason: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    """Reason for failure, if applicable."""
    paid_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    """Date and time when this payout attempt was paid."""


payout_status_update_function = PGFunction(
    schema="public",
    signature="payout_status_update()",
    definition="""
    RETURNS trigger AS $$
    DECLARE
        has_succeeded BOOLEAN;
        has_attempts BOOLEAN;
        all_failed BOOLEAN;
        latest_status TEXT;
        new_status TEXT;
        current_status TEXT;
    BEGIN
        -- Don't update canceled payouts
        SELECT status INTO current_status
        FROM payouts
        WHERE id = NEW.payout_id;

        IF current_status = 'canceled' THEN
            RETURN NEW;
        END IF;

        -- Check if any attempt succeeded
        SELECT EXISTS(
            SELECT 1 FROM payout_attempts
            WHERE payout_id = NEW.payout_id
            AND status = 'succeeded'
        ) INTO has_succeeded;

        -- Check if there are any attempts
        SELECT EXISTS(
            SELECT 1 FROM payout_attempts
            WHERE payout_id = NEW.payout_id
        ) INTO has_attempts;

        -- Get the latest attempt's status
        SELECT status INTO latest_status
        FROM payout_attempts
        WHERE payout_id = NEW.payout_id
        ORDER BY created_at DESC
        LIMIT 1;

        -- Check if all attempts failed
        SELECT has_attempts AND NOT EXISTS(
            SELECT 1 FROM payout_attempts
            WHERE payout_id = NEW.payout_id
            AND status != 'failed'
        ) INTO all_failed;

        -- Determine new status
        IF has_succeeded THEN
            new_status := 'succeeded';
        ELSIF NOT has_attempts THEN
            new_status := 'pending';
        ELSIF latest_status = 'in_transit' THEN
            new_status := 'in_transit';
        ELSIF all_failed THEN
            new_status := 'failed';
        ELSE
            new_status := 'pending';
        END IF;

        -- Update the payout status
        UPDATE payouts
        SET status = new_status
        WHERE id = NEW.payout_id;

        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

payout_status_update_trigger = PGTrigger(
    schema="public",
    signature="payout_status_update_trigger",
    on_entity="payout_attempts",
    definition="""
    AFTER INSERT OR UPDATE ON payout_attempts
    FOR EACH ROW EXECUTE FUNCTION payout_status_update();
    """,
)

register_entities(
    (
        payout_status_update_function,
        payout_status_update_trigger,
    )
)
