from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from polar.kit.schemas import Schema
from polar.models.pledge import Pledge
from polar.pledge.schemas import Pledge as PledgeSchema
from polar.reward.schemas import Reward


class BackofficeReward(Reward):
    transfer_id: str | None
    issue_reward_id: UUID
    pledge_payment_id: str | None
    pledger_email: str | None


class BackofficePledge(PledgeSchema):
    payment_id: str | None

    dispute_reason: str | None
    disputed_by_user_id: UUID | None
    disputed_at: datetime | None

    pledger_email: str | None

    @classmethod
    def from_db(
        cls,
        o: Pledge,
        include_receiver_admin_fields: bool = False,
        include_sender_admin_fields: bool = False,
        include_sender_fields: bool = False,
    ) -> Self:
        p = PledgeSchema.from_db(
            o,
            # in backoffice: include all data!
            include_receiver_admin_fields=True,
            include_sender_admin_fields=True,
            include_sender_fields=True,
        )

        return cls(
            id=p.id,
            created_at=p.created_at,
            amount=p.amount,
            state=p.state,
            type=p.type,
            refunded_at=p.refunded_at,
            scheduled_payout_at=p.scheduled_payout_at,
            issue=p.issue,
            pledger=p.pledger,
            pledger_email=o.email,
            payment_id=o.payment_id,
            dispute_reason=o.dispute_reason,
            disputed_at=o.disputed_at,
            disputed_by_user_id=o.disputed_by_user_id,
            hosted_invoice_url=p.hosted_invoice_url,
            created_by=p.created_by,
        )


class BackofficeBadge(Schema):
    org_slug: str
    repo_slug: str
    issue_number: int
    action: Literal["embed", "remove"]


class BackofficeBadgeResponse(BackofficeBadge):
    success: bool
