"""Seed an admin user + organization + v2 agent run, returning a session token.

Used by the Playwright e2e spec to skip the OAuth login flow. Prints
the cookie token to stdout so the test harness can plug it into
``page.context.add_cookies()``.

Idempotent: re-running upserts a stable admin (email derived from a
fixed slug) and creates a fresh run row + session token each time.
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from polar.auth.scope import Scope
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.kit.db.postgres import (
    create_async_engine,
    create_async_sessionmaker,
)
from polar.models import (
    Account,
    Organization,
    OrganizationReviewAgentRun,
    User,
    UserOrganization,
)
from polar.models.account import Account as _Account
from polar.models.organization import OrganizationStatus
from polar.models.organization_review_agent_run import AgentRunStatus


ADMIN_EMAIL = "e2e-admin@polar.test"
ORG_SLUG = "e2e-merchant"


async def main() -> None:
    engine = create_async_engine(
        dsn=settings.get_postgres_dsn("asyncpg"),
        application_name="e2e-seed",
        pool_size=5,
        pool_recycle=3600,
    )
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        # Admin user (upsert by email).
        statement = select(User).where(User.email == ADMIN_EMAIL)
        result = await session.execute(statement)
        user = result.unique().scalar_one_or_none()
        if user is None:
            user = User(
                email=ADMIN_EMAIL,
                email_verified=True,
                is_admin=True,
                avatar_url=None,
            )
            session.add(user)
            await session.flush()
        elif not user.is_admin:
            user.is_admin = True
            await session.flush()

        # Organization (upsert by slug).
        statement = select(Organization).where(Organization.slug == ORG_SLUG)
        result = await session.execute(statement)
        organization = result.unique().scalar_one_or_none()
        if organization is None:
            # The Organization model requires an Account FK; create a
            # minimal one for the merchant.
            account = Account(currency="usd", admin_id=user.id)
            session.add(account)
            await session.flush()

            organization = Organization(
                name="E2E Merchant",
                slug=ORG_SLUG,
                status=OrganizationStatus.REVIEW,
                website="https://e2e-merchant.test",
                email="contact@e2e-merchant.test",
                details_submitted_at=None,
                account_id=account.id,
                customer_invoice_prefix="E2EMERCHANT",
                avatar_url=None,
            )
            session.add(organization)
            await session.flush()

            # Link admin user to org.
            uo = UserOrganization(
                organization_id=organization.id,
                user_id=user.id,
            )
            session.add(uo)
            await session.flush()

        # A v2 agent run in AWAITING_HUMAN with a DENY verdict so the
        # commit form renders + the disagreement strip has content.
        run = OrganizationReviewAgentRun(
            organization_id=organization.id,
            context="submission",
            triggered_by="e2e_seed",
            status=AgentRunStatus.AWAITING_HUMAN,
            current_node="await_deny_confirm",
            org_snapshot={
                "id": str(organization.id),
                "name": organization.name,
                "slug": organization.slug,
                "website": organization.website,
                "status": organization.status.value,
                "details": None,
                "socials": None,
            },
            final_report={
                "verdict": "deny",
                "summary": "E2E seed: simulated DENY for backoffice flow test.",
                "merchant_summary": (
                    "We weren't able to approve your account at this time."
                ),
                "violated_sections": [],
                "decisive_signal_kinds": ["user_blocked"],
                "recommended_action": (
                    "Review the seeded signal before committing."
                ),
            },
        )
        session.add(run)
        await session.flush()

        # Session cookie for the admin user.
        token, _ = await auth_service._create_user_session(
            session,
            user,
            user_agent="playwright-e2e",
            scopes=[Scope.web_read, Scope.web_write],
        )
        await session.commit()

        # Print the values the e2e harness needs.
        print(f"COOKIE_NAME={settings.USER_SESSION_COOKIE_KEY}")
        print(f"COOKIE_VALUE={token}")
        print(f"COOKIE_DOMAIN={settings.USER_SESSION_COOKIE_DOMAIN}")
        print(f"ADMIN_USER_ID={user.id}")
        print(f"ORG_ID={organization.id}")
        print(f"RUN_ID={run.id}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        import traceback

        traceback.print_exc(file=sys.stderr)
        print(f"SEED_FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
