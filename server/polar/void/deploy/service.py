import json
import uuid
from collections.abc import Sequence
from decimal import Decimal

from polar.kit.utils import utc_now
from polar.models import VoidDeployment as Deployment
from polar.models import VoidMeter as Meter
from polar.models import VoidReducer as Reducer
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.entitlement.schemas import EntitlementCreate
from polar.void.entitlement.service import classify as entitlement_action
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.meter.repository import MeterRepository
from polar.void.meter.schemas import MeterCreate
from polar.void.meter.service import meter as meter_service
from polar.void.organization.service import organization as organization_service
from polar.void.product.repository import ProductRepository
from polar.void.product.schemas import MeterTerms, ProductCreate
from polar.void.product.service import ProductInvalid, latest_products, same_definition
from polar.void.product.service import product as product_service
from polar.void.reducer.aggregation import PropertyAggregation
from polar.void.reducer.derived import ReducerSource, validate_inputs
from polar.void.reducer.exceptions import InvalidReducer
from polar.void.reducer.filter import (
    Filter,
    FilterClause,
    FilterConjunction,
    FilterOperator,
)
from polar.void.reducer.schemas import ReducerCreate
from polar.void.reducer.service import reducer as reducer_service

from .exceptions import DeploymentConflict, InvalidDeployment
from .repository import DeployRepository
from .schemas import (
    Action,
    Deploy,
    DeployCreate,
    DeployEntry,
    DeployMeter,
    DeployProduct,
)

CREDITS_SUFFIX = "-credits"


def _by_slug(reducers: Sequence[Reducer]) -> dict[str, Reducer]:
    return {reducer.slug: reducer for reducer in reducers}


def _latest_meters(
    meters: Sequence[Meter], version_id: str | None = None
) -> dict[str, Meter]:
    latest: dict[str, Meter] = {}
    for meter in meters:
        if meter.branch_id is not None or meter.version_id != version_id:
            continue
        current = latest.get(meter.slug)
        if current is None or meter.generation_id > current.generation_id:
            latest[meter.slug] = meter
    return latest


def _same_reducer(wanted: ReducerCreate, current: Reducer) -> bool:
    return (
        json.dumps(current.map, sort_keys=True)
        == json.dumps(wanted.map, sort_keys=True)
        and (current.filter.model_dump(mode="json") if current.filter else None)
        == (wanted.filter.model_dump(mode="json") if wanted.filter else None)
        and current.aggregation.model_dump(mode="json")
        == wanted.aggregation.model_dump(mode="json")
    )


def _same_meter(
    wanted: DeployMeter,
    current: Meter,
    usage_reducer_id: uuid.UUID,
    credit_reducer_id: uuid.UUID,
) -> bool:
    return (
        current.usage_reducer_id == usage_reducer_id
        and current.credit_reducer_id == credit_reducer_id
        and Decimal(current.unit_amount) == wanted.unit_amount
        and current.currency == wanted.currency
    )


def _credits_slug(reducer: str) -> str:
    return f"{reducer}{CREDITS_SUFFIX}"


def _credits_create(meter_slug: str, reducer: str) -> ReducerCreate:
    return ReducerCreate(
        slug=_credits_slug(reducer),
        filter=Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(
                    property="name",
                    operator=FilterOperator.eq,
                    value="credit.granted",
                ),
                FilterClause(
                    property="meter",
                    operator=FilterOperator.eq,
                    value=meter_slug,
                ),
            ],
        ),
        aggregation=PropertyAggregation(func="sum", property="amount"),
    )


class DeployService:
    async def deploy(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        create_schema: DeployCreate,
    ) -> Deploy:
        """Reconcile one compiled config against the organization's resources.

        Runs under a per-organization lock so two deploys cannot interleave.
        Reducers are unique by slug. Meters are versioned: a changed one is
        created again and the server bumps its generation. Nothing is ever
        deleted; what the config no longer names is reported as an orphan.
        """
        await organization_service.lock(session, organization_id)
        async with session.begin_nested():
            return await self._reconcile(session, organization_id, create_schema)

    @staticmethod
    def _validate(config: DeployCreate, current_reducers: dict[str, Reducer]) -> None:
        for kind in ("reducers", "meters", "entitlements", "products"):
            definitions = getattr(config, kind)
            if len({definition.slug for definition in definitions}) != len(definitions):
                raise InvalidDeployment(
                    f"{kind.capitalize()} slugs must be unique within a deploy"
                )
        reducers = {definition.slug: definition for definition in config.reducers}
        sources: dict[str, ReducerSource] = {**current_reducers, **reducers}
        for wanted in config.reducers:
            if wanted.aggregation.func == "derive":
                validate_inputs(wanted.aggregation.inputs, sources)
        implicit_credits: dict[str, str] = {}
        for meter in config.meters:
            usage = reducers.get(meter.reducer)
            if usage is None or usage.aggregation.type != "scalar":
                raise InvalidReducer(
                    f"Meter {meter.slug!r} requires a scalar reducer in this deploy"
                )
            if usage.aggregation.func == "derive":
                raise InvalidReducer("Derived reducers are available for metrics only")
            if meter.credit_reducer is not None:
                credit = reducers.get(meter.credit_reducer)
                if credit is None or credit.aggregation.func != "sum":
                    raise InvalidReducer(
                        f"Meter {meter.slug!r} credit reducer must be a sum reducer in this deploy"
                    )
            else:
                slug = _credits_slug(meter.reducer)
                previous = implicit_credits.setdefault(slug, meter.slug)
                if previous != meter.slug:
                    raise InvalidDeployment(
                        "Meters sharing a usage reducer must declare explicit credit reducers"
                    )
                expected = _credits_create(meter.slug, meter.reducer)
                configured_credit = reducers.get(slug)
                if (
                    configured_credit is not None
                    and configured_credit.model_dump() != expected.model_dump()
                ):
                    raise DeploymentConflict(
                        f"Automatic credit reducer {slug!r} conflicts with the deployed definition"
                    )
                existing_credit = current_reducers.get(slug)
                if existing_credit is not None and not _same_reducer(
                    expected, existing_credit
                ):
                    raise DeploymentConflict(
                        f"Automatic credit reducer {slug!r} exists with a different definition"
                    )
            if len(meter.slug) < 3:
                raise InvalidDeployment(
                    "Meter slugs must have at least three characters for their display name"
                )
        meters = {definition.slug: definition for definition in config.meters}
        entitlements = {definition.slug for definition in config.entitlements}
        for product in config.products:
            slugs = [
                entry if isinstance(entry, str) else entry.slug
                for entry in product.meters
            ]
            if len(set(slugs)) != len(slugs) or len(set(product.entitlements)) != len(
                product.entitlements
            ):
                raise ProductInvalid(
                    f"Product {product.slug!r} has duplicate references"
                )
            if product.price.type == "one_time" and slugs:
                raise ProductInvalid(
                    f"Product {product.slug!r} is one-time and cannot carry meters"
                )
            for slug in slugs:
                product_meter = meters.get(slug)
                if product_meter is None:
                    raise ProductInvalid(
                        f"Product {product.slug!r} bills meter {slug!r}, which is not in this deploy"
                    )
                if product_meter.currency != product.price.currency:
                    raise ProductInvalid(
                        f"Meter {slug!r} and product {product.slug!r} must use the same currency"
                    )
            if set(product.entitlements) - entitlements:
                raise ProductInvalid(
                    f"Product {product.slug!r} grants an entitlement which is not in this deploy"
                )

    async def _reconcile(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        create_schema: DeployCreate,
    ) -> Deploy:
        apply = not create_schema.dry_run
        current_reducers = _by_slug(
            await reducer_service.list(session, organization_id)
        )
        current_meters = _latest_meters(
            await meter_service.list(session, organization_id), create_schema.version_id
        )
        self._validate(create_schema, current_reducers)
        reserved = await DeployRepository.from_session(session).reserved_slugs(
            organization_id,
            {item.slug for item in create_schema.reducers}
            | {
                item.credit_reducer or _credits_slug(item.reducer)
                for item in create_schema.meters
            },
            {item.slug for item in create_schema.entitlements},
        )
        if reserved:
            kind, slug = min(reserved)
            raise DeploymentConflict(f"Deleted {kind} slug {slug!r} is reserved")
        entries: list[DeployEntry] = []
        reducer_ids: dict[str, uuid.UUID | None] = {}
        meter_ids: dict[str, uuid.UUID | None] = {}

        for wanted in sorted(
            create_schema.reducers, key=lambda r: r.aggregation.func == "derive"
        ):
            current = current_reducers.get(wanted.slug)
            if current is not None and _same_reducer(wanted, current):
                entries.append(
                    DeployEntry(
                        reason=None,
                        price_preview=None,
                        kind="reducer",
                        key=wanted.slug,
                        action="unchanged",
                        id=current.id,
                    )
                )
                reducer_ids[wanted.slug] = current.id
                continue
            if current is not None:
                raise DeploymentConflict(
                    f"reducer {wanted.slug!r} exists with a different "
                    "filter, map or aggregation"
                )
            created_id: uuid.UUID | None = None
            if apply:
                created = await reducer_service.create(
                    session,
                    organization_id,
                    ReducerCreate(
                        slug=wanted.slug,
                        filter=wanted.filter,
                        aggregation=wanted.aggregation,
                        map=wanted.map,
                    ),
                )
                created_id = created.id
            entries.append(
                DeployEntry(
                    reason=None,
                    price_preview=None,
                    kind="reducer",
                    key=wanted.slug,
                    action="create",
                    id=created_id,
                )
            )
            reducer_ids[wanted.slug] = created_id

        credits_slugs = {
            meter.credit_reducer or _credits_slug(meter.reducer)
            for meter in create_schema.meters
        }
        wanted_slugs = {
            reducer.slug for reducer in create_schema.reducers
        } | credits_slugs
        wanted_slugs.update(
            slug
            for r in create_schema.reducers
            if r.aggregation.func == "derive"
            for slug in r.aggregation.inputs.values()
        )
        for slug, current in current_reducers.items():
            if slug not in wanted_slugs and slug != "void-identity-entitlements":
                entries.append(
                    DeployEntry(
                        reason=None,
                        price_preview=None,
                        kind="reducer",
                        key=slug,
                        action="orphan",
                        id=current.id,
                    )
                )

        for wanted_meter in create_schema.meters:
            usage_reducer_id = reducer_ids[wanted_meter.reducer]
            credit_slug = wanted_meter.credit_reducer or _credits_slug(
                wanted_meter.reducer
            )
            credit_reducer_id = reducer_ids.get(credit_slug)
            if wanted_meter.credit_reducer is None and credit_slug not in reducer_ids:
                existing_credit = current_reducers.get(credit_slug)
                if existing_credit is not None:
                    credit_reducer_id = existing_credit.id
                    reducer_ids[credit_slug] = existing_credit.id
                else:
                    created_credit_id: uuid.UUID | None = None
                    if apply:
                        created_credit = await reducer_service.create(
                            session,
                            organization_id,
                            _credits_create(wanted_meter.slug, wanted_meter.reducer),
                        )
                        created_credit_id = created_credit.id
                    entries.append(
                        DeployEntry(
                            reason=None,
                            price_preview=None,
                            kind="reducer",
                            key=credit_slug,
                            action="create",
                            id=created_credit_id,
                        )
                    )
                    credit_reducer_id = created_credit_id
                    reducer_ids[credit_slug] = created_credit_id
            current_meter = current_meters.get(wanted_meter.slug)
            if (
                current_meter is not None
                and usage_reducer_id is not None
                and credit_reducer_id is not None
                and _same_meter(
                    wanted_meter,
                    current_meter,
                    usage_reducer_id,
                    credit_reducer_id,
                )
            ):
                entries.append(
                    DeployEntry(
                        reason=None,
                        price_preview=None,
                        kind="meter",
                        key=wanted_meter.slug,
                        action="unchanged",
                        id=current_meter.id,
                    )
                )
                meter_ids[wanted_meter.slug] = current_meter.id
                continue
            next_generation = await MeterRepository.from_session(
                session
            ).next_generation(
                organization_id, wanted_meter.slug, create_schema.version_id, None
            )
            meter_id: uuid.UUID | None = None
            if apply:
                assert usage_reducer_id is not None
                assert credit_reducer_id is not None
                created_meter = await meter_service.create(
                    session,
                    organization_id,
                    MeterCreate(
                        name=current_meter.name
                        if current_meter is not None
                        else wanted_meter.slug,
                        slug=wanted_meter.slug,
                        version_id=create_schema.version_id,
                        usage_reducer_id=usage_reducer_id,
                        credit_reducer_id=credit_reducer_id,
                        unit_amount=wanted_meter.unit_amount,
                        currency=wanted_meter.currency,
                    ),
                )
                meter_id = created_meter.id
            action: Action = "create" if current_meter is None else "replace"
            reason = (
                None
                if current_meter is None
                else f"generation {current_meter.generation_id} -> {next_generation}"
            )
            entries.append(
                DeployEntry(
                    price_preview=None,
                    kind="meter",
                    key=wanted_meter.slug,
                    action=action,
                    reason=reason,
                    id=meter_id,
                )
            )
            meter_ids[wanted_meter.slug] = meter_id
        wanted_meter_slugs = {meter.slug for meter in create_schema.meters}
        for slug, current_meter in current_meters.items():
            if slug not in wanted_meter_slugs:
                entries.append(
                    DeployEntry(
                        reason=None,
                        price_preview=None,
                        kind="meter",
                        key=slug,
                        action="orphan",
                        id=current_meter.id,
                    )
                )

        entries += await self._deploy_entitlements_and_products(
            session, organization_id, create_schema, meter_ids, apply
        )

        if not apply:
            return Deploy(
                version_id=create_schema.version_id,
                checksum=create_schema.checksum,
                id=None,
                applied=False,
                entries=entries,
                created_at=utc_now(),
            )
        deployment = Deployment(
            version_id=create_schema.version_id,
            checksum=create_schema.checksum,
            entries=[entry.model_dump(mode="json") for entry in entries],
            organization=await organization_service.lock(session, organization_id),
        )
        session.add(deployment)
        await session.flush()
        return Deploy(
            version_id=deployment.version_id,
            id=deployment.id,
            checksum=deployment.checksum,
            applied=True,
            entries=entries,
            created_at=deployment.created_at,
        )

    async def _deploy_entitlements_and_products(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        create_schema: DeployCreate,
        meter_ids: dict[str, uuid.UUID | None],
        apply: bool,
    ) -> list[DeployEntry]:
        """Entitlements upsert by slug. Products are versioned like meters: a
        changed definition inserts the next generation, and one the config no
        longer names is archived so nothing new is sold under it."""
        entries: list[DeployEntry] = []
        current_entitlements = {
            e.slug: e for e in await entitlement_service.list(session, organization_id)
        }
        entitlement_ids: dict[str, uuid.UUID | None] = {}
        entitlement_id: uuid.UUID | None
        action: Action
        for wanted in create_schema.entitlements:
            body = EntitlementCreate(
                slug=wanted.slug,
                name=wanted.name,
                description=wanted.description,
            )
            current = current_entitlements.get(wanted.slug)
            if apply:
                row, action = await entitlement_service.upsert(
                    session, organization_id, body
                )
                entitlement_id = row.id
            else:
                action = entitlement_action(current, body)
                entitlement_id = current.id if current is not None else None
            entitlement_ids[wanted.slug] = entitlement_id
            entries.append(
                DeployEntry(
                    reason=None,
                    price_preview=None,
                    kind="entitlement",
                    key=wanted.slug,
                    action=action,
                    id=entitlement_id,
                )
            )
        wanted_entitlements = {e.slug for e in create_schema.entitlements}
        for slug, current in current_entitlements.items():
            if slug not in wanted_entitlements:
                entries.append(
                    DeployEntry(
                        reason=None,
                        price_preview=None,
                        kind="entitlement",
                        key=slug,
                        action="orphan",
                        id=current.id,
                    )
                )

        current_products = latest_products(
            await product_service.list(session, organization_id),
            create_schema.version_id,
        )
        for wanted_product in create_schema.products:
            create = self._product_create(wanted_product, meter_ids, entitlement_ids)
            if create is not None:
                create.version_id = create_schema.version_id
            current_product = current_products.get(wanted_product.slug)
            if (
                current_product is not None
                and current_product.archived_at is None
                and create is not None
                and same_definition(create, current_product)
            ):
                entries.append(
                    DeployEntry(
                        reason=None,
                        price_preview=None,
                        kind="product",
                        key=wanted_product.slug,
                        action="unchanged",
                        id=current_product.id,
                    )
                )
                continue
            next_generation = await ProductRepository.from_session(
                session
            ).next_generation(
                organization_id, wanted_product.slug, create_schema.version_id
            )
            product_id: uuid.UUID | None = None
            if apply:
                assert create is not None
                created = await product_service.create(session, organization_id, create)
                product_id = created.id
            if current_product is None:
                action, reason = "create", None
            else:
                action = "replace"
                reason = (
                    f"generation {current_product.generation_id} -> {next_generation}"
                )
                if current_product.archived_at is not None:
                    reason += " (was archived)"
            entries.append(
                DeployEntry(
                    price_preview=None,
                    kind="product",
                    key=wanted_product.slug,
                    action=action,
                    reason=reason,
                    id=product_id,
                )
            )
        wanted_products = {p.slug for p in create_schema.products}
        for slug, current_product in current_products.items():
            if slug in wanted_products or current_product.archived_at is not None:
                continue
            if apply:
                await product_service.archive(session, current_product)
            entries.append(
                DeployEntry(
                    price_preview=None,
                    kind="product",
                    key=slug,
                    action="orphan",
                    reason="archived; existing subscriptions keep this generation",
                    id=current_product.id,
                )
            )
        return entries

    @staticmethod
    def _product_create(
        wanted: DeployProduct,
        meter_ids: dict[str, uuid.UUID | None],
        entitlement_ids: dict[str, uuid.UUID | None],
    ) -> ProductCreate | None:
        """None on a dry run whose referenced meters or entitlements do not
        exist yet; the plan then reports a create without an id."""
        slugs = [
            entry if isinstance(entry, str) else entry.slug for entry in wanted.meters
        ]
        for slug in slugs:
            if slug not in meter_ids:
                raise ProductInvalid(
                    f"Product {wanted.slug!r} bills meter {slug!r}, "
                    "which is not in this deploy"
                )
        for slug in wanted.entitlements:
            if slug not in entitlement_ids:
                raise ProductInvalid(
                    f"Product {wanted.slug!r} grants entitlement {slug!r}, "
                    "which is not in this deploy"
                )
        meters = [meter_ids[slug] for slug in slugs]
        entitlements = [entitlement_ids[slug] for slug in wanted.entitlements]
        if any(i is None for i in meters) or any(i is None for i in entitlements):
            return None
        return ProductCreate(
            slug=wanted.slug,
            name=wanted.name,
            description=wanted.description,
            price=wanted.price,
            meter_ids=[i for i in meters if i is not None],
            meter_terms={
                entry.slug: MeterTerms.model_validate(
                    entry.model_dump(exclude={"slug"})
                )
                for entry in wanted.meters
                if not isinstance(entry, str)
            },
            entitlement_ids=[i for i in entitlements if i is not None],
        )

    async def latest(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        version_id: str | None = None,
    ) -> Deployment | None:
        return await DeployRepository.from_session(session).latest(
            organization_id, version_id
        )


deploy = DeployService()
