"""Enable payments for a local development organization."""

import asyncio

import dramatiq
import typer
from sqlalchemy import select

import polar.tasks  # noqa: F401
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models.organization import Organization, OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.models.user import IdentityVerificationStatus
from polar.models.user_organization import UserOrganization
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.user.repository import UserRepository
from polar.worker import JobQueueManager

cli = typer.Typer()


@cli.command()
def enable_payments(slug: str) -> None:
    async def run() -> None:
        redis = create_redis("app")
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine("script")
            sessionmaker = create_async_sessionmaker(engine)
            async with sessionmaker() as session:
                org_result = await session.execute(
                    select(Organization).where(Organization.slug == slug)
                )
                organization = org_result.scalar_one_or_none()
                if organization is None:
                    typer.echo(f"Organization with slug '{slug}' not found.")
                    raise typer.Exit(code=1)

                user_result = await session.execute(
                    select(UserOrganization.user_id).where(
                        UserOrganization.organization_id == organization.id
                    )
                )
                user_id = user_result.scalar_one_or_none()
                if user_id is None:
                    typer.echo(f"No user found for organization '{slug}'.")
                    raise typer.Exit(code=1)

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
                typer.echo(f"Verified identity for user {user.email}")

                if not organization.details:
                    organization.details = {
                        "about": "Dev organization",
                        "product_description": "Development and testing products.",
                        "previous_annual_revenue": 0,
                        "switching": False,
                        "switching_from": None,
                    }
                    typer.echo("Set organization details.")

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
                typer.echo(f"Payments enabled for '{organization.name}' ({slug}).")

    asyncio.run(run())


if __name__ == "__main__":
    cli()
