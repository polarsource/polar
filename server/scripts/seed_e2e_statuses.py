"""Seed a spread of v2 agent runs across every status + verdict.

Builds (or reuses) the admin + org from seed_e2e_admin, then creates
one run per interesting (status, verdict, current_node) combination so
the backoffice screenshots cover the full UI surface. Also seeds a
signal_history row mix (pending / approved / discarded / retired) on
one AWAITING_HUMAN run so the Signals card renders all chip states.

Prints COOKIE_* + a RUN_<LABEL>=<id> line per seeded run.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import timedelta

from sqlalchemy import select

from polar.auth.scope import Scope
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.kit.db.postgres import (
    create_async_engine,
    create_async_sessionmaker,
)
from polar.kit.utils import utc_now
from polar.models import (
    Account,
    Organization,
    OrganizationReviewAgentRun,
    OrganizationReviewSignalHistory,
    User,
    UserOrganization,
)
from polar.models.organization import OrganizationStatus
from polar.models.organization_review_agent_run import AgentRunStatus
from polar.models.organization_review_signal_history import SignalResolution

ADMIN_EMAIL = "e2e-admin@polar-e2e.com"
ORG_SLUG = "e2e-merchant"


def _report(verdict: str, summary: str, merchant: str = "") -> dict:
    return {
        "verdict": verdict,
        "summary": summary,
        "merchant_summary": merchant,
        "violated_sections": [],
        "decisive_signal_kinds": (
            ["user_blocked"] if verdict == "deny" else []
        ),
        "recommended_action": (
            "Review the signal evidence before committing."
            if verdict != "approve"
            else "Activate the organization."
        ),
    }


async def main() -> None:
    engine = create_async_engine(
        dsn=settings.get_postgres_dsn("asyncpg"),
        application_name="e2e-seed-statuses",
        pool_size=5,
        pool_recycle=3600,
    )
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        # Admin user.
        user = (
            await session.execute(
                select(User).where(User.email == ADMIN_EMAIL)
            )
        ).unique().scalar_one_or_none()
        if user is None:
            user = User(
                email=ADMIN_EMAIL, email_verified=True, is_admin=True
            )
            session.add(user)
            await session.flush()
        elif not user.is_admin:
            user.is_admin = True
            await session.flush()

        # Organization.
        organization = (
            await session.execute(
                select(Organization).where(Organization.slug == ORG_SLUG)
            )
        ).unique().scalar_one_or_none()
        if organization is None:
            account = Account(currency="usd", admin_id=user.id)
            session.add(account)
            await session.flush()
            organization = Organization(
                name="E2E Merchant",
                slug=ORG_SLUG,
                status=OrganizationStatus.REVIEW,
                website="https://e2e-merchant.example.org",
                email="contact@polar-e2e.com",
                account_id=account.id,
                customer_invoice_prefix="E2EMERCHANT",
                avatar_url=None,
            )
            session.add(organization)
            await session.flush()
            session.add(
                UserOrganization(
                    organization_id=organization.id, user_id=user.id
                )
            )
            await session.flush()

        # Set merchant details + backfill facets (Slice 8) so the
        # facets card has data.
        organization.details = {
            "selling_categories": ["Software / SaaS", "Education"],
            "pricing_models": ["Subscription", "Usage-based"],
            "product_description": "Analytics tooling for teams.",
        }
        await session.flush()
        from polar.organization_review_agent.service import (
            organization_review_agent_service as _svc,
        )

        await _svc.backfill_facets_from_details(session, organization)

        now = utc_now()
        seeded: dict[str, str] = {}

        def add_run(
            label: str,
            *,
            status: AgentRunStatus,
            triggered_by: str,
            context: str = "submission",
            current_node: str | None = None,
            final_report: dict | None = None,
            owner: bool = False,
            due_at=None,
            on_timeout: str | None = None,
        ) -> OrganizationReviewAgentRun:
            run = OrganizationReviewAgentRun(
                organization_id=organization.id,
                context=context,
                triggered_by=triggered_by,
                status=status,
                current_node=current_node,
                final_report=final_report,
                owner_user_id=user.id if owner else None,
                due_at=due_at,
                on_timeout=on_timeout,
                org_snapshot={
                    "id": str(organization.id),
                    "name": organization.name,
                    "slug": organization.slug,
                    "website": organization.website,
                    "status": "review",
                    "created_at": (now - timedelta(days=15)).isoformat(),
                },
                started_at=now if status != AgentRunStatus.PENDING else None,
                completed_at=(
                    now
                    if status
                    in (
                        AgentRunStatus.COMPLETED,
                        AgentRunStatus.FAILED,
                        AgentRunStatus.CANCELLED,
                    )
                    else None
                ),
                events=[
                    {
                        "kind": "node_entered",
                        "node": "triage",
                        "at": now.isoformat(),
                    },
                    {
                        "kind": "node_completed",
                        "node": "decide",
                        "at": now.isoformat(),
                    },
                ],
                llm_calls=[
                    {
                        "agent": "decide",
                        "model": "gpt-5.2",
                        "input_tokens": 1840,
                        "output_tokens": 320,
                        "cost_usd": 0.0123,
                        "duration_ms": 2400,
                    }
                ],
                usage={
                    "total_input_tokens": 1840,
                    "total_output_tokens": 320,
                    "total_cost_usd": 0.0123,
                },
            )
            session.add(run)
            seeded[label] = run
            return run

        # PENDING (shadow, not yet executed)
        add_run(
            "PENDING",
            status=AgentRunStatus.PENDING,
            triggered_by="shadow",
        )
        # RUNNING (mid-investigate)
        add_run(
            "RUNNING",
            status=AgentRunStatus.RUNNING,
            triggered_by="shadow",
            current_node="investigate",
        )
        # COMPLETED + APPROVE
        add_run(
            "COMPLETED_APPROVE",
            status=AgentRunStatus.COMPLETED,
            triggered_by="shadow",
            final_report=_report(
                "approve", "No concerning signals across enabled lanes."
            ),
        )
        # AWAITING_HUMAN + DENY (deny-confirm)
        awaiting_deny = add_run(
            "AWAITING_DENY",
            status=AgentRunStatus.AWAITING_HUMAN,
            triggered_by="shadow",
            current_node="await_deny_confirm",
            final_report=_report(
                "deny",
                "High-severity signals raised: user_blocked.",
                "We weren't able to approve your account at this time. "
                "If you believe this was a mistake, please file an appeal.",
            ),
            owner=True,
        )
        # AWAITING_HUMAN + NEEDS_HUMAN (medium signals)
        add_run(
            "AWAITING_NEEDS_HUMAN",
            status=AgentRunStatus.AWAITING_HUMAN,
            triggered_by="shadow",
            context="threshold",
            current_node="await_human_review",
            final_report=_report(
                "needs_human",
                "Medium-severity signals raised: prior_denials_present.",
            ),
        )
        # AWAITING_HUMAN parked for merchant (SLA armed)
        add_run(
            "AWAITING_PARKED",
            status=AgentRunStatus.AWAITING_HUMAN,
            triggered_by="shadow",
            context="appeal",
            current_node="await_deny_confirm",
            final_report=_report(
                "deny",
                "Awaiting merchant clarification on payout setup.",
                "We need a little more information to approve your account.",
            ),
            owner=True,
            due_at=now + timedelta(days=5),
            on_timeout="escalate",
        )
        # FAILED
        add_run(
            "FAILED",
            status=AgentRunStatus.FAILED,
            triggered_by="shadow",
            current_node=None,
        )
        # CANCELLED
        add_run(
            "CANCELLED",
            status=AgentRunStatus.CANCELLED,
            triggered_by="operator:e2e",
            context="manual",
        )
        # PATTERN_MATCH parent
        add_run(
            "PATTERN_MATCH",
            status=AgentRunStatus.AWAITING_HUMAN,
            triggered_by="pattern_detector",
            context="pattern_match",
            current_node="await_human_review",
            final_report=None,
        )

        await session.flush()

        # Signal history rows on the AWAITING_DENY run — one per chip
        # state so the Signals card renders pending/approved/discarded/
        # retired.
        sig_specs = [
            ("user_blocked", "high", SignalResolution.PENDING, None, None),
            (
                "prior_denials_present",
                "medium",
                SignalResolution.APPROVED,
                "confirmed with payouts team",
                None,
            ),
            (
                "high_refund_rate",
                "medium",
                SignalResolution.DISCARDED,
                "false positive — seasonal returns",
                None,
            ),
            (
                "high_dispute_rate",
                "high",
                SignalResolution.APPROVED,
                "confirmed via Stripe dashboard",
                now,  # retired
            ),
        ]
        for kind, sev, resolution, reason, retired_at in sig_specs:
            row = OrganizationReviewSignalHistory(
                organization_id=organization.id,
                agent_run_id=awaiting_deny.id,
                kind=kind,
                severity=sev,
                summary=f"{kind} detected on this organization.",
                evidence={"example": True, "kind": kind},
                resolution=resolution,
                reviewer_reason=reason,
                reviewed_by_user_id=(
                    user.id
                    if resolution != SignalResolution.PENDING
                    else None
                ),
                reviewed_at=(
                    now
                    if resolution != SignalResolution.PENDING
                    else None
                ),
                retired_at=retired_at,
            )
            session.add(row)
        await session.flush()

        token, _ = await auth_service._create_user_session(
            session,
            user,
            user_agent="playwright-e2e",
            scopes=[Scope.web_read, Scope.web_write],
        )
        await session.commit()

        print(f"COOKIE_NAME={settings.USER_SESSION_COOKIE_KEY}")
        print(f"COOKIE_VALUE={token}")
        print(f"COOKIE_DOMAIN={settings.USER_SESSION_COOKIE_DOMAIN}")
        print(f"ORG_ID={organization.id}")
        for label, run in seeded.items():
            print(f"RUN_{label}={run.id}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        import traceback

        traceback.print_exc(file=sys.stderr)
        print(f"SEED_FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
