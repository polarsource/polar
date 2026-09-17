"""Fill the Void development organization with a realistic demo dataset.

Mirrors the dashboard's frontend fixtures: four configuration versions in a
lineage, twelve customers with agent and service identities, subscriptions
across three plans, thirty days of usage events, and three pricing scenarios.
Everything goes through the same services `void push` and the SDK use, so
the data is indistinguishable from a real integration. Events are inserted
pending; the Void worker (`dev void`) delivers them to Tinybird and folds the
reducers.
"""

import argparse
import asyncio
import random
from copy import deepcopy
from datetime import timedelta
from typing import Any

import dramatiq
from sqlalchemy import delete, select, update

import polar.tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.authz.dependencies import AuthzContext
from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Organization,
    User,
    VoidActivity,
    VoidActivitySpan,
    VoidBillingIdentity,
    VoidDeployment,
    VoidEntitlement,
    VoidEvent,
    VoidMeter,
    VoidProduct,
    VoidReducer,
    VoidReducerBucket,
    VoidReducerDependency,
    VoidReducerJob,
    VoidScenario,
    VoidSense,
    VoidSenseObservation,
    VoidSubscription,
)
from polar.postgres import AsyncSession, create_async_engine
from polar.redis import create_redis
from polar.user.service import user as user_service
from polar.void.customer.schemas import CustomerCreate
from polar.void.customer.service import customer as customer_service
from polar.void.deploy.repository import DeployRepository
from polar.void.deploy.schemas import DeployCreate
from polar.void.deploy.service import deploy as deploy_service
from polar.void.development.service import ORGANIZATION_ID, ORGANIZATION_SLUG
from polar.void.development.service import development as development_service
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import event as event_service
from polar.void.identity.schemas import IdentityCreate
from polar.void.identity.service import identity as identity_service
from polar.void.product.service import product as product_service
from polar.void.scenario.schemas import ScenarioCreate, ScenarioPatch
from polar.void.scenario.service import scenario as scenario_service
from polar.void.subscription.schemas import SubscriptionCreate
from polar.void.subscription.service import subscription as subscription_service
from polar.worker import JobQueueManager

USER_EMAIL = "void@polar.sh"
SEED = 20260910
DAYS = 30
EVENT_BATCH = 1_000

# name, plan or None, relative usage weight, days since subscription start,
# canceled days ago or None
ROOTS: list[tuple[str, str | None, float, int, int | None]] = [
    ("Northwind Labs", "scale", 1.0, 190, None),
    ("Halcyon Robotics", "scale", 0.72, 160, None),
    ("Aperture Analytics", "scale", 0.45, 120, None),
    ("Brightline Media", "team", 0.35, 200, None),
    ("Sable Systems", "team", 0.23, 95, None),
    ("Orbital Foods", "team", 0.18, 70, None),
    ("Meridian Health", "team", 0.13, 45, None),
    ("Kestrel Games", "team", 0.09, 5, None),
    ("Tidewater Finance", "starter", 0.0, 150, 40),
    ("Lumen Studio", None, 0.0, 0, None),
    ("Fairweather Co", "starter", 0.0, 60, 12),
    ("Pinecrest Logistics", "starter", 0.03, 30, None),
]

NOTES = {
    "northwind-labs": "Enterprise pilot, invoiced quarterly",
    "halcyon-robotics": "Migrated from legacy metering in v2",
}

# child name, kind; the first six roots get children in this order
CHILDREN: list[tuple[str, str]] = [
    ("deploy-bot", "agent"),
    ("support-agent", "agent"),
    ("nightly-indexer", "service"),
    ("billing-service", "service"),
    ("research-agent", "agent"),
]

MODELS = ["gpt-5", "claude-sonnet-5", "claude-opus-5"]
TOOLS = ["search", "code_exec", "browser", "file_read"]


def slugify(name: str) -> str:
    return name.lower().replace(" ", "-")


def _reducer(slug: str, event_name: str, aggregation: dict[str, Any]) -> dict[str, Any]:
    return {
        "slug": slug,
        "filter": {
            "conjunction": "and",
            "clauses": [{"property": "name", "operator": "eq", "value": event_name}],
        },
        "aggregation": aggregation,
    }


def _product(
    slug: str,
    name: str,
    description: str,
    amount: str,
    included_output_tokens: int,
    meters: list[str],
    entitlements: list[str],
) -> dict[str, Any]:
    return {
        "slug": slug,
        "name": name,
        "description": description,
        "price": {
            "type": "recurring",
            "interval": "month",
            "amount": amount,
            "currency": "usd",
        },
        "meters": [
            {
                "slug": "output_tokens",
                "included": included_output_tokens,
                "limit": "soft",
            },
            *[{"slug": meter, "included": 0, "limit": "soft"} for meter in meters],
        ],
        "entitlements": entitlements,
    }


def configuration_v1() -> dict[str, Any]:
    """Two plans, token and tool-call metering."""
    return {
        "checksum": "demo:v1",
        "reducers": [
            _reducer(
                "output_tokens",
                "llm.completion",
                {"func": "sum", "property": "output_tokens"},
            ),
            _reducer(
                "input_tokens",
                "llm.completion",
                {"func": "sum", "property": "input_tokens"},
            ),
            _reducer("tool_calls", "tool.call", {"func": "count"}),
        ],
        "meters": [
            {
                "slug": "output_tokens",
                "reducer": "output_tokens",
                "unit_amount": "0.0006",
            },
            {
                "slug": "input_tokens",
                "reducer": "input_tokens",
                "unit_amount": "0.00015",
            },
            {"slug": "tool_calls", "reducer": "tool_calls", "unit_amount": "0.04"},
        ],
        "entitlements": [
            {"slug": "api-access", "name": "API access"},
            {"slug": "analytics", "name": "Usage analytics"},
        ],
        "products": [
            _product(
                "starter",
                "Starter",
                "Pay as you go for individuals.",
                "19",
                0,
                ["input_tokens", "tool_calls"],
                ["api-access"],
            ),
            _product(
                "team",
                "Team",
                "Shared workspace with 5k output tokens included.",
                "99",
                5_000,
                ["input_tokens", "tool_calls"],
                ["api-access", "analytics"],
            ),
        ],
    }


def configuration_v2() -> dict[str, Any]:
    """Adds the Scale plan and priority support."""
    config = deepcopy(configuration_v1())
    config["checksum"] = "demo:v2"
    config["entitlements"].append(
        {"slug": "priority-support", "name": "Priority support"}
    )
    config["products"].append(
        _product(
            "scale",
            "Scale",
            "For production agents, 25k output tokens included.",
            "499",
            25_000,
            ["input_tokens", "tool_calls"],
            ["api-access", "analytics", "priority-support"],
        )
    )
    return config


def configuration_v3() -> dict[str, Any]:
    """Adds sandbox minutes, reprices output tokens, and deploys agent senses."""
    config = deepcopy(configuration_v2())
    config["checksum"] = "demo:v3"
    config["reducers"].append(
        _reducer(
            "sandbox_minutes", "sandbox.stopped", {"func": "sum", "property": "minutes"}
        )
    )
    config["meters"].append(
        {"slug": "sandbox_minutes", "reducer": "sandbox_minutes", "unit_amount": "0.02"}
    )
    for meter in config["meters"]:
        if meter["slug"] == "output_tokens":
            meter["unit_amount"] = "0.0008"
    config["entitlements"].append({"slug": "sandbox", "name": "Sandboxes"})
    for product in config["products"]:
        if product["slug"] in ("team", "scale"):
            product["meters"].append(
                {"slug": "sandbox_minutes", "included": 0, "limit": "soft"}
            )
            product["entitlements"].append("sandbox")
    config["activities"] = [
        {
            "slug": "agent",
            "event": "llm.completion",
            "group_by": "call_id",
            "run_by": "call_id",
        }
    ]
    config["senses"] = [
        {
            "slug": "retry-storm",
            "activity": "agent",
            "when": "most recent spend is retries or loops, not progress",
            "over": {"type": "window", "amount": 1, "unit": "hour"},
        },
        {
            "slug": "human-in-the-loop",
            "activity": "agent",
            "when": "this run now needs a person",
            "over": {"type": "run"},
        },
    ]
    return config


# (name, patch); the first one is promoted and becomes v4
SCENARIOS: list[tuple[str, dict[str, Any]]] = [
    (
        "Usage-first",
        {
            "products": {
                "team": {
                    "price": {
                        "type": "recurring",
                        "interval": "month",
                        "amount": "129",
                        "currency": "usd",
                    }
                }
            },
            "meters": {"output_tokens": {"unit_amount": "0.0012"}},
        },
    ),
    (
        "Enterprise uplift",
        {
            "products": {
                "scale": {
                    "price": {
                        "type": "recurring",
                        "interval": "month",
                        "amount": "599",
                        "currency": "usd",
                    }
                }
            },
            "meters": {},
        },
    ),
    (
        "Free Starter",
        {
            "products": {
                "starter": {
                    "price": {
                        "type": "recurring",
                        "interval": "month",
                        "amount": "0",
                        "currency": "usd",
                    }
                }
            },
            "meters": {},
        },
    ),
]


class DemoSeeder:
    def __init__(self, session: AsyncSession, organization: Organization) -> None:
        self.session = session
        self.organization = organization
        self.now = utc_now()
        self.random = random.Random(SEED)

    async def is_seeded(self) -> bool:
        deployment = await DeployRepository.from_session(self.session).by_version(
            self.organization.id,
            DeployCreate.model_validate(configuration_v3()).version_id,
        )
        return deployment is not None

    async def reset(self) -> None:
        """Hard-delete the organization's Void rows. Tinybird keeps its copies."""
        organization_id = self.organization.id
        await self.session.execute(
            update(Customer)
            .where(Customer.organization_id == organization_id)
            .values(root_identity_id=None)
        )
        for model in (
            VoidEvent,
            VoidSubscription,
            VoidScenario,
            VoidReducerJob,
            VoidReducerDependency,
            VoidReducerBucket,
            VoidSenseObservation,
            VoidSense,
            VoidActivitySpan,
            VoidActivity,
            VoidProduct,
            VoidMeter,
            VoidDeployment,
            VoidEntitlement,
            VoidReducer,
        ):
            await self.session.execute(
                delete(model).where(model.organization_id == organization_id)
            )
        # Children before roots: the parent FK is not cascading.
        await self.session.execute(
            delete(VoidBillingIdentity).where(
                VoidBillingIdentity.organization_id == organization_id,
                VoidBillingIdentity.parent_id.is_not(None),
            )
        )
        await self.session.execute(
            delete(VoidBillingIdentity).where(
                VoidBillingIdentity.organization_id == organization_id
            )
        )
        # Polar customers stay; unbound above, they are re-bound by external id.
        await self.session.flush()

    async def deploy_versions(self) -> str:
        """v1 → v2 → v3, each activated in turn, backdated like the fixtures."""
        for config, age in (
            (configuration_v1(), timedelta(days=23)),
            (configuration_v2(), timedelta(days=9)),
            (configuration_v3(), timedelta(days=2)),
        ):
            create_schema = DeployCreate.model_validate({**config, "activate": True})
            deploy = await deploy_service.deploy(
                self.session, self.organization.id, create_schema
            )
            await self.session.execute(
                update(VoidDeployment)
                .where(VoidDeployment.id == deploy.id)
                .values(created_at=self.now - age)
            )
            # Meters and products inherit the version's age so their pages
            # read as history too.
            for model in (VoidMeter, VoidProduct):
                await self.session.execute(
                    update(model)
                    .where(
                        model.organization_id == self.organization.id,
                        model.version_id == deploy.version_id,
                    )
                    .values(created_at=self.now - age)
                )
            await self.session.flush()
        return create_schema.version_id

    async def create_identities(self, auth: AuthzContext[User]) -> dict[str, list[str]]:
        """Bind every root to a Polar customer; give the first six children.

        Returns the external ids that emit events for each root.
        """
        emitters: dict[str, list[str]] = {}
        for index, (name, _, _, _, _) in enumerate(ROOTS):
            slug = slugify(name)
            await customer_service.create(
                self.session,
                auth,
                CustomerCreate(
                    external_id=slug,
                    email=f"void-demo+{slug}@polar.sh",
                    name=name,
                ),
            )
            root = await identity_service.get(self.session, self.organization.id, slug)
            root.metadata_ = {
                **root.metadata_,
                **({"note": NOTES[slug]} if slug in NOTES else {}),
            }
            children: list[str] = []
            if index < 6:
                count = 5 - index if index < 3 else 2
                for child_name, kind in CHILDREN[:count]:
                    external_id = f"{slug}/{child_name}"
                    await identity_service.ensure(
                        self.session,
                        self.organization,
                        IdentityCreate(
                            external_id=external_id,
                            parent_external_id=slug,
                            metadata={"kind": kind, "name": child_name},
                        ),
                    )
                    children.append(external_id)
            emitters[slug] = children or [slug]
        await self.session.flush()
        return emitters

    async def seed_senses(
        self, version_id: str, emitters: dict[str, list[str]]
    ) -> int:
        """Latest noul per identity, as if Jev had judged the labeled mix."""
        senses = {
            sense.slug: sense
            for sense in await self.session.scalars(
                select(VoidSense).where(
                    VoidSense.organization_id == self.organization.id,
                    VoidSense.version_id == version_id,
                    VoidSense.deleted_at.is_(None),
                )
            )
        }
        storm = senses.get("retry-storm")
        hitl = senses.get("human-in-the-loop")
        if storm is None:
            return 0
        count = 0
        for root, children in emitters.items():
            identities = [root, *[child for child in children if child != root]]
            for identity in identities:
                noul = round(self.random.uniform(0.16, 0.91), 2)
                self.session.add(
                    VoidSenseObservation(
                        sense_id=storm.id,
                        version_id=version_id,
                        organization_id=self.organization.id,
                        external_identity_id=identity,
                        external_root_id=root,
                        run_key="",
                        noul=noul,
                        state_hash=f"seed:{identity}:retry-storm",
                        span_count=4 + self.random.randrange(8),
                        cost=round(self.random.uniform(0.04, 0.4), 3),
                        evaluated_at=self.now,
                    )
                )
                count += 1
                if hitl is None or identity == root:
                    continue
                self.session.add(
                    VoidSenseObservation(
                        sense_id=hitl.id,
                        version_id=version_id,
                        organization_id=self.organization.id,
                        external_identity_id=identity,
                        external_root_id=root,
                        run_key=f"run_{identity}",
                        noul=0.82 if identity.endswith("deploy-bot") else 0.24,
                        state_hash=f"seed:{identity}:human-in-the-loop",
                        span_count=2 + self.random.randrange(4),
                        cost=round(self.random.uniform(0.02, 0.18), 3),
                        evaluated_at=self.now,
                    )
                )
                count += 1
        await self.session.flush()
        return count

    async def create_subscriptions(self, version_id: str) -> None:
        products = {
            product.slug: product.id
            for product in await product_service.list(
                self.session, self.organization.id
            )
            if product.version_id == version_id
        }
        for name, plan, _, started_days, canceled_days in ROOTS:
            if plan is None:
                continue
            await subscription_service.create(
                self.session,
                self.organization.id,
                SubscriptionCreate(
                    product_id=products[plan],
                    external_identity_id=slugify(name),
                    starts_at=self.now - timedelta(days=started_days, hours=3),
                    ends_at=(
                        self.now - timedelta(days=canceled_days, hours=1)
                        if canceled_days is not None
                        else None
                    ),
                ),
            )

    def _events_for(
        self, root_slug: str, emitters: list[str], weight: float
    ) -> list[EventCreate]:
        """Thirty days of usage, heavier on weekdays, scaled by the root's weight."""
        events: list[EventCreate] = []
        if weight == 0:
            return events
        rng = self.random
        start = self.now - timedelta(days=DAYS)
        for day in range(DAYS):
            day_start = start + timedelta(days=day)
            weekday_factor = 0.55 if day_start.weekday() >= 5 else 1.0
            completions = int(rng.gauss(90, 18) * weight * weekday_factor)
            for _ in range(max(completions, 0)):
                emitter = rng.choice(emitters)
                at = day_start + timedelta(seconds=rng.uniform(6 * 3600, 22 * 3600))
                input_tokens = int(rng.lognormvariate(6.8, 0.6))
                output_tokens = int(rng.lognormvariate(6.2, 0.7))
                events.append(
                    EventCreate(
                        name="llm.completion",
                        external_id=f"{root_slug}:{day}:{len(events)}",
                        external_identity_id=emitter,
                        timestamp=at,
                        metadata={
                            "model": rng.choice(MODELS),
                            "input_tokens": input_tokens,
                            "output_tokens": output_tokens,
                        },
                    )
                )
                if rng.random() < 0.35:
                    events.append(
                        EventCreate(
                            name="tool.call",
                            external_id=f"{root_slug}:{day}:{len(events)}",
                            external_identity_id=emitter,
                            timestamp=at + timedelta(seconds=rng.uniform(1, 40)),
                            metadata={"tool": rng.choice(TOOLS)},
                        )
                    )
            sandboxes = int(rng.gauss(4, 1.5) * weight * weekday_factor)
            for _ in range(max(sandboxes, 0)):
                emitter = rng.choice(emitters)
                at = day_start + timedelta(seconds=rng.uniform(7 * 3600, 20 * 3600))
                minutes = round(rng.lognormvariate(3.0, 0.5), 1)
                sandbox_id = f"sbx_{rng.randrange(10**8):08d}"
                events.append(
                    EventCreate(
                        name="sandbox.started",
                        external_id=f"{root_slug}:{day}:{len(events)}",
                        external_identity_id=emitter,
                        timestamp=at,
                        metadata={"sandbox_id": sandbox_id},
                    )
                )
                events.append(
                    EventCreate(
                        name="sandbox.stopped",
                        external_id=f"{root_slug}:{day}:{len(events)}",
                        external_identity_id=emitter,
                        timestamp=at + timedelta(minutes=minutes),
                        metadata={"sandbox_id": sandbox_id, "minutes": minutes},
                    )
                )
        return events

    async def ingest_events(self, emitters: dict[str, list[str]]) -> int:
        saved = 0
        for name, _, weight, _, _ in ROOTS:
            slug = slugify(name)
            events = self._events_for(slug, emitters[slug], weight)
            for offset in range(0, len(events), EVENT_BATCH):
                count, _ = await event_service.ingest(
                    self.session,
                    self.organization.id,
                    events[offset : offset + EVENT_BATCH],
                    EventSource.user,
                )
                saved += count
        return saved

    async def create_scenarios(self, base_version_id: str) -> None:
        for index, (name, patch) in enumerate(SCENARIOS):
            scenario = await scenario_service.create(
                self.session,
                self.organization.id,
                ScenarioCreate(
                    name=name,
                    base_version_id=base_version_id,
                    patch=ScenarioPatch.model_validate(patch),
                ),
            )
            if index == 0:
                await scenario_service.promote(
                    self.session, self.organization.id, scenario.id
                )

    async def run(self) -> dict[str, int]:
        user = await self.session.scalar(select(User).where(User.email == USER_EMAIL))
        if user is None:
            raise RuntimeError(
                f"{USER_EMAIL} does not exist; run `dev seed` or `task void_seed` first"
            )
        auth: AuthzContext[User] = AuthzContext(
            organization=self.organization,
            auth_subject=AuthSubject(user, set(Scope), None),
        )
        version_id = await self.deploy_versions()
        emitters = await self.create_identities(auth)
        senses = await self.seed_senses(version_id, emitters)
        await self.create_subscriptions(version_id)
        events = await self.ingest_events(emitters)
        await self.create_scenarios(version_id)
        return {
            "versions": 4,
            "identities": len(ROOTS)
            + sum(len(e) for slug, e in emitters.items() if e != [slug]),
            "subscriptions": sum(1 for root in ROOTS if root[1] is not None),
            "events": events,
            "senses": senses,
            "scenarios": len(SCENARIOS),
        }


async def run(reset: bool) -> dict[str, int] | None:
    if not settings.is_development():
        raise ValueError("The Void demo seed only runs with POLAR_ENV=development")
    engine = create_async_engine("script")
    redis = create_redis("app")
    try:
        sessionmaker = create_async_sessionmaker(engine)
        async with (
            JobQueueManager.open(dramatiq.get_broker(), redis),
            sessionmaker() as session,
            session.begin(),
        ):
            organization, _ = await development_service.seed(session)
            await user_service.get_by_email_or_create(session=session, email=USER_EMAIL)
            seeder = DemoSeeder(session, organization)
            if reset:
                await seeder.reset()
            elif await seeder.is_seeded():
                return None
            return await seeder.run()
    finally:
        await redis.close()
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description=f"Seed {ORGANIZATION_SLUG} ({ORGANIZATION_ID}) with demo data"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete the organization's Void data first and seed again",
    )
    arguments = parser.parse_args()
    try:
        counts = asyncio.run(run(arguments.reset))
    except (ValueError, RuntimeError) as error:
        parser.error(str(error))
    if counts is None:
        print(f"{ORGANIZATION_SLUG} already has demo data; pass --reset to rebuild it.")
        return
    summary = ", ".join(f"{value} {key}" for key, value in counts.items())
    print(f"Seeded {ORGANIZATION_SLUG}: {summary}. Run `dev void` to fold usage.")


if __name__ == "__main__":
    main()
