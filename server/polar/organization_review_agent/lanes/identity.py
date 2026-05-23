"""Identity lane: Stripe Identity verification status.

Reads the legacy ``collect_identity_data`` collector and emits a
single :class:`SignalKind.IDENTITY_NOT_VERIFIED` signal when the
admin user hasn't completed Stripe verification.

Stripe Identity calls happen inside the legacy collector; this lane
is a thin v2-shaped wrapper. The legacy collector swallows Stripe
errors silently, so this lane never fails because of a third-party
outage — it just emits no signals.
"""

from __future__ import annotations

from typing import ClassVar

from polar.organization.repository import OrganizationRepository
from polar.organization_review.collectors.identity import (
    collect_identity_data,
)

from ..schemas import LaneFacts, RaisedSignal, Severity, SignalKind
from .base import LaneRunContext, LaneRunResult


# Identity verification only kicks in once the merchant has connected
# a payout account — checking before is noise (admin hasn't even tried
# to verify yet). Slice 7 generalises this per-context.
_RELEVANT_CONTEXTS: frozenset[str] = frozenset(
    {"threshold", "manual", "appeal"}
)

_VERIFIED_STATUSES: frozenset[str] = frozenset({"verified"})


class IdentityLane:
    name: ClassVar[str] = "identity"

    async def is_enabled(self, ctx: LaneRunContext) -> bool:
        return ctx.review_context in _RELEVANT_CONTEXTS

    async def run(self, ctx: LaneRunContext) -> LaneRunResult:
        org_repo = OrganizationRepository.from_session(ctx.session)
        admin_user = await org_repo.get_admin_user(ctx.organization)
        identity = await collect_identity_data(admin_user)

        facts = LaneFacts(
            name=self.name,
            payload={
                "admin_user_present": admin_user is not None,
                "verification_status": identity.verification_status,
                "verification_error_code": (
                    identity.verification_error_code
                ),
                "verified_address_country": (
                    identity.verified_address_country
                ),
            },
        )

        signals: list[RaisedSignal] = []
        # Treat None / "unverified" / "pending" / "requires_input" as
        # unverified. Only "verified" clears the signal.
        if (
            identity.verification_status not in _VERIFIED_STATUSES
            and admin_user is not None
        ):
            signals.append(
                RaisedSignal(
                    kind=SignalKind.IDENTITY_NOT_VERIFIED,
                    severity=Severity.MEDIUM,
                    summary=(
                        "Admin user identity not verified "
                        f"(status: {identity.verification_status or 'none'})"
                        + (
                            f"; last error: {identity.verification_error_code}"
                            if identity.verification_error_code
                            else ""
                        )
                    ),
                    evidence={
                        "verification_status": identity.verification_status,
                        "verification_error_code": (
                            identity.verification_error_code
                        ),
                    },
                )
            )

        return LaneRunResult(facts=facts, signals=signals)


identity_lane = IdentityLane()


__all__ = ["IdentityLane", "identity_lane"]
