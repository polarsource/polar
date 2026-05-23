"""History lane: prior denials, prior blocks, blocked admin user.

Wraps the legacy ``polar.organization_review.collectors.history`` to
produce v2-shaped :class:`RaisedSignal` records. The legacy collector
returns a ``HistoryData`` dataclass; the lane decomposes it into the
controlled-vocabulary kinds defined in
``polar.organization_review_agent.taxonomy``.
"""

from __future__ import annotations

from typing import ClassVar

from polar.organization.repository import OrganizationRepository
from polar.organization_review.collectors.history import collect_history_data
from polar.organization_review.repository import OrganizationReviewRepository

from ..schemas import LaneFacts, RaisedSignal, Severity, SignalKind
from .base import LaneRunContext, LaneRunResult


class HistoryLane:
    """Inspects the admin user's prior orgs + block status."""

    name: ClassVar[str] = "history"

    async def is_enabled(self, ctx: LaneRunContext) -> bool:
        # History is cheap and always relevant — no skip conditions.
        return True

    async def run(self, ctx: LaneRunContext) -> LaneRunResult:
        org_repo = OrganizationRepository.from_session(ctx.session)
        review_repo = OrganizationReviewRepository.from_session(ctx.session)

        admin = await org_repo.get_admin_user(ctx.organization)
        admin_user = (
            await review_repo.get_user_by_id(admin.id) if admin else None
        )
        other_orgs = (
            await review_repo.get_other_organizations_for_user(
                admin.id, ctx.organization.id
            )
            if admin is not None
            else []
        )
        history = collect_history_data(admin_user, other_orgs)

        facts = LaneFacts(
            name=self.name,
            payload={
                "admin_user_email": history.user_email,
                "admin_user_blocked_at": (
                    history.user_blocked_at.isoformat()
                    if history.user_blocked_at
                    else None
                ),
                "prior_organization_count": len(history.prior_organizations),
                "has_prior_denials": history.has_prior_denials,
                "has_blocked_orgs": history.has_blocked_orgs,
                "prior_organizations": [
                    {
                        "slug": p.slug,
                        "status": p.status,
                        "review_verdict": p.review_verdict,
                        "appeal_decision": p.appeal_decision,
                        "is_blocked": p.is_blocked,
                    }
                    for p in history.prior_organizations
                ],
            },
        )

        signals: list[RaisedSignal] = []

        # Admin user has been blocked on the platform — strongest signal
        # in this lane. HIGH severity, no overridable nuance.
        if admin_user is not None and admin_user.blocked_at is not None:
            signals.append(
                RaisedSignal(
                    kind=SignalKind.USER_BLOCKED,
                    severity=Severity.HIGH,
                    summary=(
                        f"Admin user {admin_user.email} was blocked at "
                        f"{admin_user.blocked_at.isoformat()}."
                    ),
                    evidence={
                        "user_id": str(admin_user.id),
                        "blocked_at": admin_user.blocked_at.isoformat(),
                    },
                )
            )

        # Other organizations owned by this user were blocked. HIGH
        # severity — coordinated abuse pattern.
        if history.has_blocked_orgs:
            blocked = [
                p for p in history.prior_organizations if p.is_blocked
            ]
            signals.append(
                RaisedSignal(
                    kind=SignalKind.PRIOR_BLOCKS_PRESENT,
                    severity=Severity.HIGH,
                    summary=(
                        f"Admin owns {len(blocked)} previously-blocked "
                        "organization(s) on the platform."
                    ),
                    evidence={
                        "blocked_org_slugs": [p.slug for p in blocked],
                    },
                )
            )

        # Other organizations owned by this user reached DENIED status.
        # MEDIUM severity — pattern of rejections, but appealable.
        if history.has_prior_denials:
            denied = [
                p
                for p in history.prior_organizations
                if p.status == "denied"
            ]
            signals.append(
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.MEDIUM,
                    summary=(
                        f"Admin owns {len(denied)} previously-denied "
                        "organization(s); review carefully for repeat-"
                        "offender pattern."
                    ),
                    evidence={
                        "denied_org_slugs": [p.slug for p in denied],
                    },
                )
            )

        return LaneRunResult(facts=facts, signals=signals)


history_lane = HistoryLane()


__all__ = ["HistoryLane", "history_lane"]
