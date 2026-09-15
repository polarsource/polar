import argparse
import asyncio
from datetime import timedelta
from uuid import UUID

from polar.auth.scope import Scope
from polar.config import settings
from polar.kit.crypto import generate_token_hash_pair
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import OrganizationAccessToken
from polar.organization.repository import OrganizationRepository
from polar.organization_access_token.repository import OrganizationAccessTokenRepository
from polar.organization_access_token.service import TOKEN_PREFIX
from polar.postgres import AsyncSession, create_async_engine


async def generate_void_token(session: AsyncSession, organization: str) -> str:
    if not (settings.is_development() or settings.is_testing()):
        raise ValueError("Void tokens can only be issued in development or testing")
    if not settings.VOID_ENABLED:
        raise ValueError("Void must be enabled before issuing a token")

    repository = OrganizationRepository.from_session(session)
    try:
        organization_id = UUID(organization)
    except ValueError:
        resolved_organization = await repository.get_by_slug(organization)
    else:
        resolved_organization = await repository.get_by_id(organization_id)
    if resolved_organization is None:
        raise ValueError("Organization not found")
    if resolved_organization.id not in settings.VOID_ORGANIZATION_IDS:
        raise ValueError("Organization is not allowlisted for Void")
    if not resolved_organization.can_authenticate:
        raise ValueError("Organization cannot authenticate")

    token, token_hash = generate_token_hash_pair(
        secret=settings.SECRET, prefix=TOKEN_PREFIX
    )
    token_repository = OrganizationAccessTokenRepository.from_session(session)
    await token_repository.create(
        OrganizationAccessToken(
            organization=resolved_organization,
            token=token_hash,
            scope=f"{Scope.void_read} {Scope.void_write}",
            expires_at=utc_now() + timedelta(hours=24),
            comment="Void local development",
        ),
        flush=True,
    )
    return token


async def run(organization: str) -> str:
    engine = create_async_engine("script")
    try:
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session, session.begin():
            return await generate_void_token(session, organization)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Issue a 24-hour Void organization token for local development"
    )
    parser.add_argument("organization", help="Existing organization UUID or slug")
    arguments = parser.parse_args()
    try:
        token = asyncio.run(run(arguments.organization))
    except ValueError as error:
        parser.error(str(error))
    print(token)


if __name__ == "__main__":
    main()
