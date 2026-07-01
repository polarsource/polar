"""Orchestrates the modular seed components from a spec.

A spec looks like:
    {"slug": "acme-test", "owner": "admin@polar.sh",
     "components": {"products": "mix", "customers": true}}

`describe()` exposes the available components/variants (consumed by `dev seed2`),
and `build()` resolves dependencies, topologically orders the selected
components, and runs them against a freshly created org + owner.
"""

from __future__ import annotations

import contextlib
from typing import Any

import dramatiq
from sqlalchemy import select

import polar.tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.enums import PayoutAccountType
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models.organization import Organization, OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.models.payout_account import PayoutAccount
from polar.models.user import IdentityVerificationStatus, User
from polar.organization.schemas import OrganizationCreate
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, create_async_engine
from polar.redis import create_redis
from polar.user.repository import UserRepository
from polar.user.service import user as user_service
from polar.worker import JobQueueManager

from scripts.seeds.base import SeedComponent, SeedContext, SeedError
from scripts.seeds.registry import COMPONENTS, COMPONENTS_BY_KEY

DEFAULT_OWNER = "admin@polar.sh"


def describe() -> list[dict[str, Any]]:
    return [
        {
            "key": component.key,
            "label": component.label,
            "default_on": component.default_on,
            "requires": list(component.requires),
            "variants": [
                {"key": variant.key, "label": variant.label}
                for variant in component.variants
            ],
        }
        for component in COMPONENTS
    ]


def _resolve(components: dict[str, Any]) -> list[tuple[SeedComponent, str | None]]:
    chosen: dict[str, str | None] = {}
    for key, value in components.items():
        if not value or key not in COMPONENTS_BY_KEY:
            continue
        chosen[key] = value if isinstance(value, str) else None

    pending = list(chosen)
    while pending:
        component = COMPONENTS_BY_KEY[pending.pop()]
        for dependency in component.requires:
            if dependency not in chosen:
                chosen[dependency] = None
                pending.append(dependency)

    ordered: list[str] = []

    def visit(key: str) -> None:
        if key in ordered:
            return
        for dependency in COMPONENTS_BY_KEY[key].requires:
            if dependency in chosen:
                visit(dependency)
        ordered.append(key)

    for component in COMPONENTS:
        if component.key in chosen:
            visit(component.key)

    plan: list[tuple[SeedComponent, str | None]] = []
    for key in ordered:
        component = COMPONENTS_BY_KEY[key]
        variant = chosen[key]
        if variant is None and component.variants:
            variant = component.variants[0].key
        plan.append((component, variant))
    return plan


async def _attach_payout_account(
    session: AsyncSession, organization: Organization, owner: User
) -> None:
    payout_account = PayoutAccount(
        type=PayoutAccountType.stripe,
        admin=owner,
        stripe_id=f"acct_seed_{organization.slug}",
        country="US",
        currency="usd",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
    )
    session.add(payout_account)
    await session.flush()
    organization.payout_account = payout_account
    session.add(organization)


async def _org_exists(session: AsyncSession, slug: str) -> bool:
    result = await session.execute(
        select(Organization.id).where(Organization.slug == slug)
    )
    return result.first() is not None


async def _ensure_org_and_owner(
    session: AsyncSession, slug: str, owner_email: str
) -> tuple[Organization, User, AuthSubject[User]]:
    owner, _created = await user_service.get_by_email_or_create(
        session=session, email=owner_email
    )
    await UserRepository.from_session(session).update(
        owner,
        update_dict={
            "is_admin": True,
            "identity_verification_status": IdentityVerificationStatus.verified,
            "identity_verification_id": f"vs_{slug}_test",
        },
    )

    auth_subject = AuthSubject(subject=owner, scopes=set(), session=None)

    organization = await organization_service.create(
        session=session,
        create_schema=OrganizationCreate(name=slug.replace("-", " ").title(), slug=slug),
        auth_subject=auth_subject,
    )
    organization.email = f"{slug}@polar.sh"
    organization.bio = f"Seeded organization: {organization.name}"
    organization.set_status(OrganizationStatus.ACTIVE)
    organization.details_submitted_at = utc_now()
    organization.initially_reviewed_at = utc_now()
    session.add(organization)

    session.add(
        OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=0.0,
            violated_sections=[],
            reason="Seed data - automatically approved",
            timed_out=False,
            model_used="seed",
            validated_at=utc_now(),
            organization_details_snapshot={},
        )
    )

    await _attach_payout_account(session, organization, owner)
    return organization, owner, auth_subject


@contextlib.asynccontextmanager
async def _open_session():
    redis = create_redis("app")
    async with JobQueueManager.open(dramatiq.get_broker(), redis):
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session:
            yield session, redis


async def _seed_org(
    session: AsyncSession,
    redis: Any,
    slug: str,
    owner_email: str,
    skip_tinybird: bool,
    components: dict[str, Any],
) -> dict[str, Any]:
    if await _org_exists(session, slug):
        raise SeedError(f"Organization '{slug}' already exists — choose a new slug.")
    organization, owner, auth_subject = await _ensure_org_and_owner(
        session, slug, owner_email
    )
    ctx = SeedContext(
        session=session,
        redis=redis,
        organization=organization,
        owner=owner,
        auth_subject=auth_subject,
        skip_tinybird=skip_tinybird,
    )
    summary = [
        await component.build(ctx, variant)
        for component, variant in _resolve(components)
    ]
    return {"slug": slug, "owner": owner.email, "summary": summary}


async def build(spec: dict[str, Any]) -> dict[str, Any]:
    async with _open_session() as (session, redis):
        result = await _seed_org(
            session,
            redis,
            spec["slug"],
            spec.get("owner") or DEFAULT_OWNER,
            bool(spec.get("skip_tinybird")),
            spec.get("components", {}),
        )
        await session.commit()
    return result


def _scenario_components(key: str) -> dict[str, Any]:
    from scripts.seeds.presets.scenarios import SCENARIOS_BY_KEY

    scenario = SCENARIOS_BY_KEY.get(key)
    if scenario is None:
        raise SeedError(
            f"Unknown scenario '{key}'. Try: {', '.join(SCENARIOS_BY_KEY)}"
        )
    components = scenario["components"]
    if components is None:
        return {
            component.key: (component.variants[0].key if component.variants else True)
            for component in COMPONENTS
        }
    return components


async def build_scenario(
    key: str, slug: str, owner: str, *, skip_tinybird: bool = False
) -> dict[str, Any]:
    return await build(
        {
            "slug": slug,
            "owner": owner,
            "skip_tinybird": skip_tinybird,
            "components": _scenario_components(key),
        }
    )


async def build_demo(
    specs: list[dict[str, Any]],
    *,
    skip_tinybird: bool = False,
    include_polar_self: bool = True,
) -> dict[str, Any]:
    from scripts.seeds.presets.polar_self import seed_polar_self

    async with _open_session() as (session, redis):
        orgs = [
            await _seed_org(
                session,
                redis,
                spec["slug"],
                spec.get("owner") or DEFAULT_OWNER,
                skip_tinybird,
                spec.get("components", {}),
            )
            for spec in specs
        ]
        env = await seed_polar_self(session, redis) if include_polar_self else {}
        await session.commit()
    return {"orgs": orgs, "env": env}
