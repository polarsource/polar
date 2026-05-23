"""Run the v2 graph end-to-end against real org rows (local DB).

Unlike the screenshot seed (which hand-writes final_reports), this
drives the actual execute_run actor: Triage -> Investigate (real
lanes hitting the DB) -> Decide (heuristic + memory weighting) ->
signal_history persistence -> status finalisation.

Builds three scenarios so each verdict path is exercised by the real
code:
  * CLEAN   -> brand-new org, no signals            -> APPROVE
  * BLOCKED -> admin user blocked_at set            -> DENY (history lane)
  * PRIORS  -> a sibling org in DENIED status        -> NEEDS_HUMAN
               (prior_denials_present, MEDIUM)

Prints the resulting (status, verdict, signal kinds) per run so the
output is the proof. No mocks: the graph reads/writes the local
Postgres exactly as it would in production.
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from polar.config import settings
from polar.kit.db.postgres import (
    create_async_engine,
    create_async_sessionmaker,
)
from polar.kit.utils import utc_now
from polar.models import Account, Organization, User, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.models.organization_review_agent_run import (
    AgentRunStatus,
    OrganizationReviewAgentRun,
)
from polar.organization_review_agent.graph import execute_graph
from polar.organization_review_agent.signal_history_repository import (
    OrganizationReviewSignalHistoryRepository,
)


async def _mk_org(session, slug, admin_email, *, blocked=False) -> tuple:
    user = (
        await session.execute(select(User).where(User.email == admin_email))
    ).unique().scalar_one_or_none()
    if user is None:
        user = User(email=admin_email, email_verified=True)
        session.add(user)
        await session.flush()
    if blocked:
        user.blocked_at = utc_now()
    await session.flush()

    org = (
        await session.execute(
            select(Organization).where(Organization.slug == slug)
        )
    ).unique().scalar_one_or_none()
    if org is None:
        account = Account(currency="usd", admin_id=user.id)
        session.add(account)
        await session.flush()
        org = Organization(
            name=slug,
            slug=slug,
            status=OrganizationStatus.REVIEW,
            website=f"https://{slug}.test",
            email=admin_email,
            account_id=account.id,
            customer_invoice_prefix=slug.upper().replace("-", "")[:10],
            avatar_url=None,
        )
        session.add(org)
        await session.flush()
        session.add(
            UserOrganization(organization_id=org.id, user_id=user.id)
        )
        await session.flush()
    return org, user


async def _run_graph_for(session, org) -> OrganizationReviewAgentRun:
    run = OrganizationReviewAgentRun(
        organization_id=org.id,
        context="submission",
        triggered_by="graph_e2e",
        status=AgentRunStatus.RUNNING,
        started_at=utc_now(),
        org_snapshot={
            "id": str(org.id),
            "slug": org.slug,
            "status": "review",
            "created_at": (utc_now()).isoformat(),
        },
    )
    session.add(run)
    await session.flush()
    # The real driver: no mocks, hits the DB through every lane.
    await execute_graph(session, run, org)
    await session.flush()
    return run


async def main() -> None:
    engine = create_async_engine(
        dsn=settings.get_postgres_dsn("asyncpg"),
        application_name="graph-e2e",
        pool_size=5,
        pool_recycle=3600,
    )
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        # CLEAN
        clean_org, _ = await _mk_org(
            session, "graph-e2e-clean", "graph-clean@polar.test"
        )
        # BLOCKED admin
        blocked_org, _ = await _mk_org(
            session,
            "graph-e2e-blocked",
            "graph-blocked@polar.test",
            blocked=True,
        )
        # PRIORS: same admin owns a DENIED sibling org
        priors_admin = "graph-priors@polar.test"
        priors_org, priors_user = await _mk_org(
            session, "graph-e2e-priors", priors_admin
        )
        sibling = (
            await session.execute(
                select(Organization).where(
                    Organization.slug == "graph-e2e-priors-sibling"
                )
            )
        ).unique().scalar_one_or_none()
        if sibling is None:
            sib_account = Account(currency="usd", admin_id=priors_user.id)
            session.add(sib_account)
            await session.flush()
            sibling = Organization(
                name="graph-e2e-priors-sibling",
                slug="graph-e2e-priors-sibling",
                status=OrganizationStatus.DENIED,
                email=priors_admin,
                account_id=sib_account.id,
                customer_invoice_prefix="GE2EPRIORS",
                avatar_url=None,
            )
            session.add(sibling)
            await session.flush()
            session.add(
                UserOrganization(
                    organization_id=sibling.id, user_id=priors_user.id
                )
            )
            await session.flush()

        results = []
        for label, org in (
            ("CLEAN", clean_org),
            ("BLOCKED", blocked_org),
            ("PRIORS", priors_org),
        ):
            run = await _run_graph_for(session, org)
            history_repo = (
                OrganizationReviewSignalHistoryRepository.from_session(
                    session
                )
            )
            sigs = await history_repo.list_for_run(run.id)
            verdict = (
                run.final_report.get("verdict")
                if run.final_report
                else None
            )
            results.append(
                (
                    label,
                    run.id,
                    run.status.value
                    if hasattr(run.status, "value")
                    else run.status,
                    verdict,
                    [(s.kind, s.severity) for s in sigs],
                )
            )

        await session.commit()

        print("\n=== v2 graph e2e results (real code path, local DB) ===")
        for label, run_id, status, verdict, sigs in results:
            print(f"\n[{label}] run_id={run_id}")
            print(f"  status : {status}")
            print(f"  verdict: {verdict}")
            print(f"  signals: {sigs or '(none)'}")
        print("\nRUN_CLEAN=" + str(results[0][1]))
        print("RUN_BLOCKED=" + str(results[1][1]))
        print("RUN_PRIORS=" + str(results[2][1]))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        import traceback

        traceback.print_exc(file=sys.stderr)
        print(f"GRAPH_E2E_FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
