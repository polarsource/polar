"""Payout account lane: Stripe Connect readiness + past-due requirements.

Wraps :func:`polar.organization_review.collectors.payout_account.collect_payout_account_data`
and decomposes the result into v2 signals: ``CHARGES_OR_PAYOUTS_DISABLED``
(blocking — payouts won't flow) and ``PAYOUT_REQUIREMENTS_PAST_DUE``
(merchant-actionable — they're missing a document).
"""

from __future__ import annotations

from typing import ClassVar

from polar.organization.repository import OrganizationReviewRepository
from polar.organization_review.collectors.payout_account import (
    collect_payout_account_data,
)

from ..schemas import LaneFacts, RaisedSignal, Severity, SignalKind
from .base import LaneRunContext, LaneRunResult


class PayoutAccountLane:
    """Inspects Stripe Connect capabilities + outstanding requirements."""

    name: ClassVar[str] = "payout_account"

    async def is_enabled(self, ctx: LaneRunContext) -> bool:
        # Cheap — let the lane decide what to emit based on whether the
        # account exists, rather than skipping outright. This keeps
        # SUBMISSION reviews informative even if the merchant hasn't
        # connected Stripe yet.
        return True

    async def run(self, ctx: LaneRunContext) -> LaneRunResult:
        review_repo = OrganizationReviewRepository.from_session(ctx.session)
        payout_account = await review_repo.get_payout_account_with_admin(
            ctx.organization.id
        )
        payout_data = collect_payout_account_data(payout_account)

        facts = LaneFacts(
            name=self.name,
            payload={
                "account_present": payout_account is not None,
                "is_details_submitted": payout_data.is_details_submitted,
                "is_charges_enabled": payout_data.is_charges_enabled,
                "is_payouts_enabled": payout_data.is_payouts_enabled,
                "country": payout_data.country,
                "business_type": payout_data.business_type,
                "requirements_past_due": payout_data.requirements_past_due,
                "requirements_currently_due": (
                    payout_data.requirements_currently_due
                ),
                "requirements_disabled_reason": (
                    payout_data.requirements_disabled_reason
                ),
                "business_name": payout_data.business_name,
                "business_url": payout_data.business_url,
            },
        )

        signals: list[RaisedSignal] = []

        # If Stripe has disabled either capability, surface as HIGH —
        # the merchant cannot transact until this resolves.
        if payout_account is not None and (
            not payout_data.is_charges_enabled
            or not payout_data.is_payouts_enabled
        ):
            signals.append(
                RaisedSignal(
                    kind=SignalKind.CHARGES_OR_PAYOUTS_DISABLED,
                    severity=Severity.HIGH,
                    summary=(
                        "Stripe Connect account: "
                        f"charges_enabled={payout_data.is_charges_enabled}, "
                        f"payouts_enabled={payout_data.is_payouts_enabled}. "
                        f"Disabled reason: "
                        f"{payout_data.requirements_disabled_reason or '—'}"
                    ),
                    evidence={
                        "charges_enabled": payout_data.is_charges_enabled,
                        "payouts_enabled": payout_data.is_payouts_enabled,
                        "disabled_reason": (
                            payout_data.requirements_disabled_reason
                        ),
                        "errors": payout_data.requirements_errors,
                    },
                )
            )

        # Past-due requirements are merchant-actionable: surface the
        # specific items so the merchant Case page (Slice 4) can show
        # an actionable list.
        if payout_data.requirements_past_due:
            signals.append(
                RaisedSignal(
                    kind=SignalKind.PAYOUT_REQUIREMENTS_PAST_DUE,
                    severity=Severity.MEDIUM,
                    summary=(
                        "Stripe payout account has "
                        f"{len(payout_data.requirements_past_due)} "
                        "past-due requirement(s)."
                    ),
                    evidence={
                        "past_due": payout_data.requirements_past_due,
                    },
                )
            )

        return LaneRunResult(facts=facts, signals=signals)


payout_account_lane = PayoutAccountLane()


__all__ = ["PayoutAccountLane", "payout_account_lane"]
