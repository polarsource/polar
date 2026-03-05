"""Enable payments for a local development organization."""

from pathlib import Path

import typer
from shared import SERVER_DIR, run_command

SCRIPT_PATH = Path(__file__).resolve()


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command("enable-payments")
    def enable_payments(
        slug: str = typer.Argument(..., help="Organization slug to enable payments for"),
    ) -> None:
        """Enable payments for an organization (dev only).

        Creates a fake Stripe account, verifies the admin user's identity,
        sets organization details, and marks the organization as ACTIVE.
        """
        result = run_command(
            ["uv", "run", "python", str(SCRIPT_PATH), slug],
            cwd=SERVER_DIR,
            capture=False,
        )
        if result and result.returncode != 0:
            raise typer.Exit(result.returncode)


if __name__ == "__main__":
    import asyncio

    import dramatiq
    import typer as _typer
    from sqlalchemy import select

    import polar.tasks  # noqa: F401
    from polar.enums import AccountType
    from polar.kit.db.postgres import create_async_sessionmaker
    from polar.kit.utils import utc_now
    from polar.models.account import Account
    from polar.models.organization import Organization, OrganizationStatus
    from polar.models.organization_review import OrganizationReview
    from polar.models.user import IdentityVerificationStatus
    from polar.models.user_organization import UserOrganization
    from polar.postgres import create_async_engine
    from polar.redis import create_redis
    from polar.user.repository import UserRepository
    from polar.worker import JobQueueManager

    _cli = _typer.Typer()

    @_cli.command()
    def _enable_payments(slug: str) -> None:
        async def run() -> None:
            redis = create_redis("app")
            async with JobQueueManager.open(dramatiq.get_broker(), redis):
                engine = create_async_engine("script")
                sessionmaker = create_async_sessionmaker(engine)
                async with sessionmaker() as session:
                    result = await session.execute(
                        select(Organization).where(Organization.slug == slug)
                    )
                    organization = result.scalar_one_or_none()
                    if organization is None:
                        _typer.echo(f"Organization with slug '{slug}' not found.")
                        raise _typer.Exit(code=1)

                    result = await session.execute(
                        select(UserOrganization.user_id).where(
                            UserOrganization.organization_id == organization.id
                        )
                    )
                    user_id = result.scalar_one_or_none()
                    if user_id is None:
                        _typer.echo(f"No user found for organization '{slug}'.")
                        raise _typer.Exit(code=1)

                    user_repository = UserRepository.from_session(session)
                    user = await user_repository.get_by_id(user_id)
                    assert user is not None
                    await user_repository.update(
                        user,
                        update_dict={
                            "identity_verification_status": IdentityVerificationStatus.verified,
                            "identity_verification_id": f"vs_{slug}_dev",
                        },
                    )
                    _typer.echo(f"Verified identity for user {user.email}")

                    if organization.account_id is not None:
                        _typer.echo(
                            "Organization already has an account, skipping account creation."
                        )
                    else:
                        account = Account(
                            account_type=AccountType.stripe,
                            admin_id=user.id,
                            stripe_id=f"acct_{slug}_dev",
                            country="US",
                            currency="USD",
                            is_details_submitted=True,
                            is_charges_enabled=True,
                            is_payouts_enabled=True,
                            status=Account.Status.ACTIVE,
                            email=user.email,
                            processor_fees_applicable=True,
                        )
                        session.add(account)
                        await session.flush()
                        organization.account_id = account.id
                        _typer.echo(f"Created account {account.stripe_id}")

                    if not organization.details:
                        organization.details = {  # type: ignore
                            "about": "Dev organization",
                            "product_description": "Development and testing products.",
                            "intended_use": "Development and testing.",
                            "customer_acquisition": ["website"],
                            "future_annual_revenue": 0,
                            "previous_annual_revenue": 0,
                            "switching": False,
                            "switching_from": None,
                        }
                        _typer.echo("Set organization details.")

                    organization.details_submitted_at = utc_now()
                    organization.status = OrganizationStatus.ACTIVE
                    organization.initially_reviewed_at = utc_now()
                    session.add(organization)

                    organization_review = OrganizationReview(
                        organization_id=organization.id,
                        verdict=OrganizationReview.Verdict.PASS,
                        risk_score=0.0,
                        violated_sections=[],
                        reason="Dev script - automatically approved",
                        timed_out=False,
                        model_used="dev",
                        validated_at=utc_now(),
                        organization_details_snapshot=organization.details or {},
                    )
                    session.add(organization_review)

                    await session.commit()
                    _typer.echo(
                        f"Payments enabled for '{organization.name}' ({slug})."
                    )

        asyncio.run(run())

    _cli()
