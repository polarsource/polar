from decimal import Decimal
from uuid import uuid4

import pytest
import pytest_asyncio
from pydantic import ValidationError

from polar.exceptions import ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import Organization, VoidEntitlement, VoidMeter
from polar.postgres import AsyncSession
from polar.void.entitlement.schemas import EntitlementCreate
from polar.void.entitlement.service import EntitlementSlugTaken
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.meter.schemas import MeterCreate
from polar.void.meter.service import meter as meter_service
from polar.void.product.schemas import ProductCreate, to_schema
from polar.void.product.service import ProductInvalid, latest_products, same_definition
from polar.void.product.service import product as product_service
from polar.void.reducer.exceptions import InvalidReducer
from polar.void.reducer.schemas import ReducerCreate
from polar.void.reducer.service import reducer as reducer_service


@pytest_asyncio.fixture
async def meter(session: AsyncSession, organization: Organization) -> VoidMeter:
    usage = await reducer_service.create(
        session,
        organization.id,
        ReducerCreate.model_validate(
            {
                "slug": "usage",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "count"},
            }
        ),
    )
    credits = await reducer_service.create(
        session,
        organization.id,
        ReducerCreate.model_validate(
            {
                "slug": "credits",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "sum", "property": "metadata.amount"},
            }
        ),
    )
    return await meter_service.create(
        session,
        organization.id,
        MeterCreate(
            slug="requests",
            name="Requests",
            usage_reducer_id=usage.id,
            credit_reducer_id=credits.id,
            unit_amount=Decimal("0.01"),
        ),
    )


def product_definition(meter: VoidMeter, **changes: object) -> ProductCreate:
    return ProductCreate.model_validate(
        {
            "slug": "pro",
            "name": "Pro",
            "price": {
                "type": "recurring",
                "interval": "month",
                "amount": "10",
                "currency": "usd",
            },
            "meter_ids": [meter.id],
            "meter_terms": {"requests": {"included": 100}},
            **changes,
        }
    )


@pytest.mark.asyncio
class TestMeterDefinitions:
    async def test_generations_are_scoped_by_variant_and_branch(
        self,
        session: AsyncSession,
        organization: Organization,
        meter: VoidMeter,
    ) -> None:
        original = MeterCreate.model_validate(meter, from_attributes=True)
        second = await meter_service.create(
            session,
            organization.id,
            original.model_copy(update={"unit_amount": Decimal("0.02")}),
        )
        variant = await meter_service.create(
            session,
            organization.id,
            original.model_copy(update={"variant_id": "a" * 64}),
        )
        branch = await meter_service.create(
            session, organization.id, original.model_copy(update={"branch_id": uuid4()})
        )
        assert [
            meter.generation_id,
            second.generation_id,
            variant.generation_id,
            branch.generation_id,
        ] == [1, 2, 1, 1]
        assert meter.unit_amount == Decimal("0.01")
        second.deleted_at = utc_now()
        await session.flush()
        third = await meter_service.create(session, organization.id, original)
        assert third.generation_id == 3
        assert second.id not in {
            m.id for m in await meter_service.list(session, organization.id)
        }
        with pytest.raises(ResourceNotFound):
            await meter_service.get(session, organization.id, second.id)

    async def test_reducers_must_be_active_same_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        meter: VoidMeter,
    ) -> None:
        original = MeterCreate.model_validate(meter, from_attributes=True)
        with pytest.raises(ResourceNotFound):
            await meter_service.create(session, organization_second.id, original)
        credit = await reducer_service.get(
            session, organization.id, meter.credit_reducer_id
        )
        credit.deleted_at = utc_now()
        await session.flush()
        with pytest.raises(ResourceNotFound):
            await meter_service.create(session, organization.id, original)

    async def test_rejects_nonadditive_credit_and_derived_usage(
        self,
        session: AsyncSession,
        organization: Organization,
        meter: VoidMeter,
    ) -> None:
        original = MeterCreate.model_validate(meter, from_attributes=True)
        with pytest.raises(InvalidReducer, match="additive"):
            await meter_service.create(
                session,
                organization.id,
                original.model_copy(
                    update={"credit_reducer_id": meter.usage_reducer_id}
                ),
            )
        derived = await reducer_service.create(
            session,
            organization.id,
            ReducerCreate.model_validate(
                {
                    "slug": "derived",
                    "aggregation": {
                        "func": "derive",
                        "inputs": {"used": "usage"},
                        "expression": "$used * 2",
                    },
                }
            ),
        )
        with pytest.raises(InvalidReducer, match="metrics only"):
            await meter_service.create(
                session,
                organization.id,
                original.model_copy(update={"usage_reducer_id": derived.id}),
            )
        records = await reducer_service.create(
            session,
            organization.id,
            ReducerCreate.model_validate(
                {
                    "slug": "record",
                    "filter": {"conjunction": "and", "clauses": []},
                    "aggregation": {"func": "last"},
                }
            ),
        )
        with pytest.raises(InvalidReducer, match="scalar"):
            await meter_service.create(
                session,
                organization.id,
                original.model_copy(update={"usage_reducer_id": records.id}),
            )


@pytest.mark.asyncio
class TestEntitlementDefinitions:
    async def test_upsert_display_fields_and_reserve_deleted_slug(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        definition = EntitlementCreate(slug="export")
        original, action = await entitlement_service.upsert(
            session, organization.id, definition
        )
        assert action == "create"
        assert original.name == "export"
        unchanged, action = await entitlement_service.upsert(
            session, organization.id, definition
        )
        assert action == "unchanged"
        changed, action = await entitlement_service.upsert(
            session,
            organization.id,
            EntitlementCreate(
                slug="export", name="Export data", description="CSV export"
            ),
        )
        assert action == "update"
        assert changed.id == unchanged.id == original.id
        assert changed.description == "CSV export"
        assert await entitlement_service.list(session, organization_second.id) == []
        with pytest.raises(ResourceNotFound):
            await entitlement_service.get(session, organization_second.id, changed.id)
        changed.deleted_at = utc_now()
        await session.flush()
        with pytest.raises(EntitlementSlugTaken):
            await entitlement_service.upsert(session, organization.id, definition)
        with pytest.raises(ResourceNotFound):
            await entitlement_service.get(session, organization.id, changed.id)
        assert (
            await entitlement_service.get_by_slug(session, organization.id, "export")
            is None
        )


@pytest.mark.asyncio
class TestProductDefinitions:
    async def test_new_generation_keeps_previous_terms_and_only_archives_its_variant(
        self,
        session: AsyncSession,
        organization: Organization,
        meter: VoidMeter,
    ) -> None:
        entitlement, _ = await entitlement_service.upsert(
            session, organization.id, EntitlementCreate(slug="export")
        )
        definition = product_definition(meter, entitlement_ids=[entitlement.id])
        first = await product_service.create(session, organization.id, definition)
        assert same_definition(definition, first)
        variant = await product_service.create(
            session,
            organization.id,
            definition.model_copy(update={"variant_id": "b" * 64}),
        )
        second_definition = product_definition(
            meter,
            entitlement_ids=[entitlement.id],
            name="New pro",
            meter_terms={"requests": {"included": 200}},
        )
        second = await product_service.create(
            session, organization.id, second_definition
        )
        assert (first.generation_id, variant.generation_id, second.generation_id) == (
            1,
            1,
            2,
        )
        assert first.archived_at is not None
        assert variant.archived_at is second.archived_at is None
        assert first.meter_terms["requests"]["included"] == 100
        assert second.meter_terms["requests"]["included"] == 200
        rows = await product_service.list(session, organization.id)
        assert latest_products(rows)["pro"].id == second.id
        assert latest_products(rows, "b" * 64)["pro"].id == variant.id
        session.expunge_all()
        loaded = await product_service.get(session, organization.id, first.id)
        payload = to_schema(loaded)
        assert payload.meters[0].id == meter.id
        assert payload.entitlements[0].id == entitlement.id
        assert payload.price.amount == Decimal(10)
        active = await product_service.list(
            session, organization.id, include_archived=False
        )
        assert {p.id for p in active} == {variant.id, second.id}

    @pytest.mark.parametrize("resource", ["meter", "entitlement"])
    async def test_rejects_foreign_and_deleted_array_references(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        meter: VoidMeter,
        resource: str,
    ) -> None:
        entitlement, _ = await entitlement_service.upsert(
            session, organization_second.id, EntitlementCreate(slug="foreign")
        )
        removed: VoidMeter | VoidEntitlement
        if resource == "meter":
            definition = product_definition(meter)
            target_org = organization_second.id
            removed = meter
        else:
            definition = product_definition(meter, entitlement_ids=[entitlement.id])
            target_org = organization.id
            removed = entitlement
        with pytest.raises(ResourceNotFound):
            await product_service.create(session, target_org, definition)
        removed.deleted_at = utc_now()
        await session.flush()
        definition = product_definition(
            meter,
            meter_ids=[] if resource == "entitlement" else [meter.id],
            meter_terms={},
            entitlement_ids=[entitlement.id] if resource == "entitlement" else [],
        )
        with pytest.raises(ResourceNotFound):
            await product_service.create(session, removed.organization_id, definition)

    @pytest.mark.parametrize(
        ("changes", "message"),
        [
            (
                {"price": {"type": "one_time", "amount": "1", "currency": "usd"}},
                "one-time",
            ),
            (
                {
                    "price": {
                        "type": "recurring",
                        "interval": "month",
                        "amount": "1",
                        "currency": "eur",
                    }
                },
                "bills in",
            ),
            ({"meter_terms": {"unknown": {}}}, "must refer"),
        ],
    )
    async def test_rejects_inconsistent_billing_terms(
        self,
        session: AsyncSession,
        organization: Organization,
        meter: VoidMeter,
        changes: dict[str, object],
        message: str,
    ) -> None:
        with pytest.raises(ProductInvalid, match=message):
            await product_service.create(
                session, organization.id, product_definition(meter, **changes)
            )
        assert await product_service.list(session, organization.id) == []


class TestMonetaryPrecision:
    @pytest.mark.parametrize("amount", ["0.0000000000001", "100000"])
    def test_meter_amount_must_fit_storage(self, amount: str) -> None:
        with pytest.raises(ValidationError):
            MeterCreate(
                slug="requests",
                name="Requests",
                usage_reducer_id=uuid4(),
                credit_reducer_id=uuid4(),
                unit_amount=Decimal(amount),
            )

    @pytest.mark.parametrize("amount", ["0.0000001", "10000000000000"])
    def test_product_amount_must_fit_storage(self, amount: str) -> None:
        with pytest.raises(ValidationError):
            ProductCreate.model_validate(
                {
                    "slug": "pro",
                    "name": "Pro",
                    "price": {"type": "one_time", "amount": amount, "currency": "usd"},
                }
            )
