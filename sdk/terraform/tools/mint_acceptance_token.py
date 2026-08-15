"""Mint an organization access token for the Terraform provider acceptance tests.

Organization access tokens are only creatable from the Polar dashboard: the
`/v1/organization-access-tokens/` endpoints are private and reject organization
tokens, so acceptance-test automation cannot bootstrap itself over the API. This
script runs inside the server's own environment instead and reuses the server's
services, repositories and token crypto:

    cd server && uv run python ../sdk/terraform/tools/mint_acceptance_token.py

It idempotently ensures a user, an organization able to authenticate
(`api_access` capability, see `Organization.can_authenticate`) and a token with
every scope the provider needs, then prints the token — and nothing else — on
stdout, so it can be captured directly:

    export POLAR_ACCESS_TOKEN=$(cd server && uv run python \\
        ../sdk/terraform/tools/mint_acceptance_token.py)

The token itself is not idempotent: only its hash is stored, so a previous run's
token cannot be recovered. Every run mints a fresh token and revokes the ones it
minted before (matched on the comment), keeping the organization from
accumulating live credentials.
"""

import argparse
import asyncio
import contextlib
import pathlib
import sys

# The script lives outside the server package, so Python puts its own directory
# on sys.path rather than the server's. Add the server root explicitly, which
# also lets the script run from anywhere.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3] / "server"))

import dramatiq  # noqa: E402

import polar.tasks  # noqa: E402, F401  (registers every dramatiq actor)
from polar import logging as polar_logging  # noqa: E402
from polar.auth.models import AuthSubject  # noqa: E402
from polar.auth.scope import Scope  # noqa: E402
from polar.config import settings  # noqa: E402
from polar.kit.crypto import generate_token_hash_pair  # noqa: E402
from polar.kit.db.postgres import create_async_sessionmaker  # noqa: E402
from polar.kit.utils import utc_now  # noqa: E402
from polar.models import Organization, OrganizationAccessToken, User  # noqa: E402
from polar.models.organization import OrganizationStatus  # noqa: E402
from polar.organization.repository import OrganizationRepository  # noqa: E402
from polar.organization.schemas import OrganizationCreate  # noqa: E402
from polar.organization.service import organization as organization_service  # noqa: E402
from polar.organization_access_token.repository import (  # noqa: E402
    OrganizationAccessTokenRepository,
)
from polar.organization_access_token.service import TOKEN_PREFIX  # noqa: E402
from polar.postgres import AsyncSession, create_async_engine  # noqa: E402
from polar.redis import create_redis  # noqa: E402
from polar.user.service import user as user_service  # noqa: E402
from polar.worker import JobQueueManager  # noqa: E402

DEFAULT_EMAIL = "terraform-acceptance@polar.sh"
DEFAULT_SLUG = "terraform-acceptance"
DEFAULT_COMMENT = "terraform-provider-acceptance-tests"

# Every scope the provider's resources need: meters, products, benefits,
# discounts, custom fields and webhook endpoints, plus the organization and
# checkout link scopes the roadmap resources will use.
SCOPES: list[Scope] = [
    Scope.organizations_read,
    Scope.organizations_write,
    Scope.products_read,
    Scope.products_write,
    Scope.benefits_read,
    Scope.benefits_write,
    Scope.meters_read,
    Scope.meters_write,
    Scope.discounts_read,
    Scope.discounts_write,
    Scope.custom_fields_read,
    Scope.custom_fields_write,
    Scope.checkout_links_read,
    Scope.checkout_links_write,
    Scope.webhooks_read,
    Scope.webhooks_write,
]


def log(message: str) -> None:
    """Report progress on stderr, keeping stdout to the token alone."""
    print(message, file=sys.stderr)


async def ensure_user(session: AsyncSession, email: str) -> User:
    user, created = await user_service.get_by_email_or_create(session, email)
    log(f"{'created' if created else 'reusing'} user {email}")
    return user


async def ensure_organization(
    session: AsyncSession, user: User, slug: str
) -> Organization:
    repository = OrganizationRepository.from_session(session)
    organization = await repository.get_by_slug(slug)
    if organization is None:
        organization = await organization_service.create(
            session=session,
            create_schema=OrganizationCreate(name=slug.replace("-", " ").title(), slug=slug),
            auth_subject=AuthSubject(subject=user, scopes=set(), session=None),
        )
        log(f"created organization {slug}")
    else:
        log(f"reusing organization {slug}")

    # can_authenticate requires the api_access capability, which every status
    # but BLOCKED grants. ACTIVE additionally unblocks checkout payments, so the
    # acceptance suite exercises the same code paths a real merchant hits.
    if organization.status != OrganizationStatus.ACTIVE:
        organization.set_status(OrganizationStatus.ACTIVE)
        organization.details_submitted_at = utc_now()
        organization.initially_reviewed_at = utc_now()
        session.add(organization)
        await session.flush()
        log("promoted organization to ACTIVE")

    if not organization.can_authenticate:
        raise RuntimeError(
            f"organization {slug} cannot authenticate: capabilities="
            f"{organization.capabilities}"
        )
    return organization


async def revoke_previous_tokens(
    session: AsyncSession, organization: Organization, comment: str
) -> int:
    repository = OrganizationAccessTokenRepository.from_session(session)
    statement = repository.get_base_statement().where(
        OrganizationAccessToken.organization_id == organization.id,
        OrganizationAccessToken.comment == comment,
    )
    previous = await repository.get_all(statement)
    for token in previous:
        await repository.soft_delete(token)
    return len(previous)


async def mint_token(
    session: AsyncSession, organization: Organization, comment: str
) -> str:
    revoked = await revoke_previous_tokens(session, organization, comment)
    if revoked:
        log(f"revoked {revoked} previously minted token(s)")

    token, token_hash = generate_token_hash_pair(
        secret=settings.SECRET, prefix=TOKEN_PREFIX
    )
    repository = OrganizationAccessTokenRepository.from_session(session)
    await repository.create(
        OrganizationAccessToken(
            token=token_hash,
            scope=" ".join(scope.value for scope in SCOPES),
            expires_at=None,
            comment=comment,
            organization_id=organization.id,
        ),
        flush=True,
    )
    log(f"minted token with {len(SCOPES)} scopes for organization {organization.slug}")
    return token


async def run(email: str, slug: str, comment: str) -> str:
    redis = create_redis("app")
    try:
        # Organization creation enqueues jobs (polar-self customer, review),
        # which needs an open job queue even though no worker consumes them.
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine("script")
            try:
                sessionmaker = create_async_sessionmaker(engine)
                async with sessionmaker() as session:
                    user = await ensure_user(session, email)
                    organization = await ensure_organization(session, user, slug)
                    token = await mint_token(session, organization, comment)
                    await session.commit()
                    return token
            finally:
                await engine.dispose()
    finally:
        await redis.aclose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--email",
        default=DEFAULT_EMAIL,
        help=f"Email of the owning user (default: {DEFAULT_EMAIL}).",
    )
    parser.add_argument(
        "--slug",
        default=DEFAULT_SLUG,
        help=f"Slug of the organization to manage (default: {DEFAULT_SLUG}).",
    )
    parser.add_argument(
        "--comment",
        default=DEFAULT_COMMENT,
        help="Comment stored on the token; previous tokens carrying it are revoked "
        f"(default: {DEFAULT_COMMENT}).",
    )
    arguments = parser.parse_args()

    # The token is the script's output, so nothing else may reach stdout:
    # `POLAR_ACCESS_TOKEN=$(...)` has to capture the token and only the token.
    # Configuring the server's logging routes structlog through stdlib handlers,
    # which write to stderr instead of structlog's default stdout; redirecting
    # stdout on top of that catches anything else that tries to print.
    polar_logging.configure()
    with contextlib.redirect_stdout(sys.stderr):
        token = asyncio.run(run(arguments.email, arguments.slug, arguments.comment))
    print(token)


if __name__ == "__main__":
    main()
