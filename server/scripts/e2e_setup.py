"""Prepare a local organization for the Playwright E2E tests.

Driven by `dev e2e setup`, which picks the organization and stores the output.
The tests create their own products and checkouts with the token minted here.
"""

import asyncio

import dramatiq
import typer
from sqlalchemy import select

import polar.tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.auth.permission import ROLE_PERMISSIONS, OrganizationPermission
from polar.auth.scope import Scope
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization, OrganizationAccessToken, User, UserOrganization
from polar.organization_access_token.schemas import (
    AvailableScope,
    OrganizationAccessTokenCreate,
)
from polar.organization_access_token.service import (
    organization_access_token as organization_access_token_service,
)
from polar.postgres import AsyncSession, create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager

TOKEN_COMMENT = "E2E tests (dev e2e setup)"
TOKEN_SCOPES = [
    Scope.products_read,
    Scope.products_write,
    Scope.checkouts_read,
    Scope.checkouts_write,
    Scope.orders_read,
    Scope.subscriptions_read,
    Scope.subscriptions_write,
]

cli = typer.Typer()


@cli.command(name="list-orgs")
def list_orgs() -> None:
    """Print `slug<TAB>name` for every organization that can take a checkout."""

    async def run() -> None:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session:
            organizations = await session.execute(
                select(Organization.slug, Organization.name)
                .where(Organization.can_authenticate)
                .order_by(Organization.slug)
            )
            for slug, name in organizations.all():
                typer.echo(f"{slug}\t{name}")

    asyncio.run(run())


async def _get_organization(session: AsyncSession, slug: str) -> Organization:
    organization = (
        (await session.execute(select(Organization).where(Organization.slug == slug)))
        .unique()
        .scalar_one_or_none()
    )
    if organization is None:
        typer.echo(f"Organization '{slug}' not found.", err=True)
        raise typer.Exit(1)
    if not organization.can_authenticate:
        typer.echo(
            f"Organization '{slug}' cannot take payments. "
            f"Run `dev enable-payments {slug}` first.",
            err=True,
        )
        raise typer.Exit(1)
    return organization


MANAGING_ROLES = [
    role
    for role, permissions in ROLE_PERMISSIONS.items()
    if OrganizationPermission.organization_manage in permissions
]


async def _get_manager(session: AsyncSession, organization: Organization) -> User:
    user = (
        (
            await session.execute(
                select(User)
                .join(UserOrganization, UserOrganization.user_id == User.id)
                .where(
                    UserOrganization.organization_id == organization.id,
                    UserOrganization.role.in_(MANAGING_ROLES),
                    UserOrganization.deleted_at.is_(None),
                )
                .limit(1)
            )
        )
        .unique()
        .scalar_one_or_none()
    )
    if user is None:
        typer.echo(
            f"Organization '{organization.slug}' has no admin or owner to mint a token as.",
            err=True,
        )
        raise typer.Exit(1)
    return user


async def _mint_token(
    session: AsyncSession, organization: Organization, user: User
) -> str:
    auth_subject = AuthSubject(subject=user, scopes=set(TOKEN_SCOPES), session=None)
    previous = (
        (
            await session.execute(
                select(OrganizationAccessToken).where(
                    OrganizationAccessToken.organization_id == organization.id,
                    OrganizationAccessToken.comment == TOKEN_COMMENT,
                    OrganizationAccessToken.deleted_at.is_(None),
                )
            )
        )
        .unique()
        .scalars()
        .all()
    )
    for stale in previous:
        await organization_access_token_service.delete(session, auth_subject, stale)
    _, token = await organization_access_token_service.create(
        session,
        auth_subject,
        OrganizationAccessTokenCreate(
            organization_id=organization.id,
            comment=TOKEN_COMMENT,
            scopes=[AvailableScope(scope.value) for scope in TOKEN_SCOPES],
        ),
    )
    return token


@cli.command()
def setup(org: str = typer.Option(..., "--org", help="Organization slug")) -> None:
    """Mint an organization token for the E2E tests and allow repeated trials."""

    async def run() -> None:
        redis = create_redis("app")
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine("script")
            sessionmaker = create_async_sessionmaker(engine)
            async with sessionmaker() as session:
                organization = await _get_organization(session, org)
                user = await _get_manager(session, organization)
                token = await _mint_token(session, organization, user)
                organization.subscription_settings = {
                    **organization.subscription_settings,
                    "prevent_trial_abuse": False,
                }
                session.add(organization)
                await session.commit()

                typer.echo(f"ORGANIZATION_SLUG={organization.slug}")
                typer.echo(f"E2E_ORG_TOKEN={token}")

    asyncio.run(run())


if __name__ == "__main__":
    cli()
