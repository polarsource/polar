import dramatiq
import typer
from sqlalchemy import exists, select

from polar import tasks  # noqa: F401
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization, OrganizationDomain
from polar.models.organization import OrganizationStatus
from polar.organization_domain.service import (
    organization_domain as organization_domain_service,
)
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager

from .helper import configure_script_logging, typer_async

cli = typer.Typer()

configure_script_logging()


@cli.command()
@typer_async
async def backfill_payment_method_domains(
    dry_run: bool = typer.Option(False, help="List the domains without registering"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    statement = (
        select(Organization)
        .where(
            Organization.deleted_at.is_(None),
            Organization.status == OrganizationStatus.ACTIVE,
            exists().where(
                OrganizationDomain.organization_id == Organization.id,
                OrganizationDomain.verified_at.is_not(None),
                OrganizationDomain.deleted_at.is_(None),
            ),
        )
        .order_by(Organization.created_at)
    )

    try:
        async with JobQueueManager.open(dramatiq.get_broker(), redis) as manager:
            async with sessionmaker() as session:
                organizations = (await session.scalars(statement)).all()
                for organization in organizations:
                    domains = (
                        await organization_domain_service.get_payment_method_domains(
                            session, organization
                        )
                    )
                    typer.echo(f"{organization.slug}: {', '.join(domains) or '-'}")
                    if not dry_run:
                        await (
                            organization_domain_service.register_payment_method_domains(
                                session, organization
                            )
                        )
            await manager.flush(dramatiq.get_broker(), redis)
    finally:
        await engine.dispose()
        await redis.close()


if __name__ == "__main__":
    cli()
