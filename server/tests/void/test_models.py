from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, InvalidRequestError
from sqlalchemy.orm import selectinload

from polar.models import (
    Customer,
    Meter,
    Model,
    Organization,
    Product,
    Subscription,
    VoidBillingIdentity,
    VoidDeployment,
    VoidEntitlement,
    VoidMeter,
    VoidProduct,
    VoidReducer,
    VoidReducerBucket,
    VoidReducerDependency,
    VoidReducerJob,
    VoidSubscription,
)
from polar.postgres import AsyncSession
from polar.void.reducer.aggregation import (
    CountAggregation,
    DerivedAggregation,
    PropertyAggregation,
    RecordAggregation,
)
from polar.void.reducer.filter import (
    Filter,
    FilterClause,
    FilterConjunction,
    FilterOperator,
)
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def void_reducer(
    save_fixture: SaveFixture, organization: Organization
) -> VoidReducer:
    reducer = VoidReducer(
        organization=organization, slug="requests", aggregation=CountAggregation()
    )
    await save_fixture(reducer)
    return reducer


@pytest_asyncio.fixture
async def void_identity(
    save_fixture: SaveFixture, organization: Organization
) -> VoidBillingIdentity:
    identity = VoidBillingIdentity(organization=organization, external_id="acme")
    await save_fixture(identity)
    return identity


VERSION = "a" * 64


def create_meter(
    organization: Organization,
    reducer: VoidReducer,
    *,
    version: str = VERSION,
) -> VoidMeter:
    return VoidMeter(
        organization=organization,
        name="Requests",
        slug="requests",
        version_id=version,
        usage_reducer=reducer,
        credit_reducer=reducer,
        unit_amount=Decimal("0.123456789012"),
        currency="usd",
    )


def create_product(
    organization: Organization, *, version: str = VERSION
) -> VoidProduct:
    return VoidProduct(
        organization=organization,
        name="Pro",
        slug="pro",
        version_id=version,
        price_type="recurring",
        interval="month",
        amount=Decimal("1234567890123.123456"),
        currency="usd",
    )


@pytest.mark.asyncio
class TestOrganizationKeys:
    @pytest.mark.parametrize(
        "create_resource",
        [
            pytest.param(
                lambda organization: VoidBillingIdentity(
                    organization=organization, external_id="shared"
                ),
                id="billing-identity",
            ),
            pytest.param(
                lambda organization: VoidReducer(
                    organization=organization,
                    slug="shared",
                    aggregation=CountAggregation(),
                ),
                id="reducer",
            ),
            pytest.param(
                lambda organization: VoidEntitlement(
                    organization=organization, slug="shared", name="Shared"
                ),
                id="entitlement",
            ),
        ],
    )
    async def test_keys_are_unique_within_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        create_resource: Callable[[Organization], Model],
    ) -> None:
        await save_fixture(create_resource(organization))
        await save_fixture(create_resource(organization_second))
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                await save_fixture(create_resource(organization))

    async def test_one_active_deployment_per_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        def deployment(
            owner: Organization, status: str, version: str
        ) -> VoidDeployment:
            return VoidDeployment(
                organization=owner,
                checksum="checksum",
                version_id=version,
                status=status,
                entries=[],
            )

        await save_fixture(deployment(organization, "active", "a" * 64))
        await save_fixture(deployment(organization, "archived", "b" * 64))
        await save_fixture(deployment(organization, "draft", "c" * 64))
        await save_fixture(deployment(organization_second, "active", "a" * 64))
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                await save_fixture(deployment(organization, "active", "d" * 64))


@pytest.mark.asyncio
class TestVersionKeys:
    async def test_meter_slug_is_unique_within_a_version(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        void_reducer: VoidReducer,
    ) -> None:
        await save_fixture(create_meter(organization, void_reducer))
        await save_fixture(create_meter(organization, void_reducer, version="b" * 64))
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                await save_fixture(create_meter(organization, void_reducer))

    async def test_product_slug_is_unique_within_a_version(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await save_fixture(create_product(organization))
        await save_fixture(create_product(organization, version="b" * 64))
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                await save_fixture(create_product(organization))

    async def test_bucket_without_identity_is_unique(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        void_reducer: VoidReducer,
    ) -> None:
        bucket_start = datetime(2026, 9, 1, tzinfo=UTC)
        for identity_id in [None, "acme"]:
            await save_fixture(
                VoidReducerBucket(
                    organization=organization,
                    reducer=void_reducer,
                    external_identity_id=identity_id,
                    bucket_start=bucket_start,
                    value=1,
                )
            )
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                await save_fixture(
                    VoidReducerBucket(
                        organization=organization,
                        reducer=void_reducer,
                        external_identity_id=None,
                        bucket_start=bucket_start,
                        value=2,
                    )
                )


@pytest.mark.asyncio
class TestCustomerRootIdentity:
    async def test_root_can_only_be_owned_once(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        customer_second: Customer,
        void_identity: VoidBillingIdentity,
    ) -> None:
        customer.root_identity = void_identity
        await save_fixture(customer)
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                customer_second.root_identity = void_identity
                await save_fixture(customer_second)

    async def test_root_must_belong_to_customer_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization_second: Organization,
    ) -> None:
        root = VoidBillingIdentity(organization=organization_second, external_id="root")
        await save_fixture(root)
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                customer.root_identity = root
                await save_fixture(customer)


@pytest.mark.asyncio
class TestForeignKeys:
    async def test_meter_cannot_use_another_organizations_reducer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization_second: Organization,
        void_reducer: VoidReducer,
    ) -> None:
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                await save_fixture(create_meter(organization_second, void_reducer))

    async def test_identity_cannot_use_another_organizations_parent(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization_second: Organization,
        void_identity: VoidBillingIdentity,
    ) -> None:
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                await save_fixture(
                    VoidBillingIdentity(
                        organization=organization_second,
                        external_id="child",
                        parent=void_identity,
                    )
                )

    async def test_subscription_requires_a_void_product(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        void_identity: VoidBillingIdentity,
    ) -> None:
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                await save_fixture(
                    VoidSubscription(
                        organization=organization,
                        product_id=product.id,
                        billing_identity=void_identity,
                        status="active",
                        started_at=datetime(2026, 9, 1, tzinfo=UTC),
                    )
                )


@pytest.mark.asyncio
class TestPersistence:
    @pytest.mark.parametrize(
        "aggregation",
        [
            CountAggregation(),
            PropertyAggregation(func="sum", property="metadata.tokens"),
            RecordAggregation(func="last"),
            DerivedAggregation(
                inputs={"requests": "requests"}, expression="$requests * 2"
            ),
        ],
    )
    async def test_reducer_roundtrips_typed_json(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        aggregation: CountAggregation
        | PropertyAggregation
        | RecordAggregation
        | DerivedAggregation,
    ) -> None:
        filter = Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(
                    property="name", operator=FilterOperator.eq, value="usage"
                ),
                Filter(
                    conjunction=FilterConjunction.or_,
                    clauses=[
                        FilterClause(
                            property="metadata.tokens",
                            operator=FilterOperator.gt,
                            value=0,
                        ),
                        FilterClause(
                            property="metadata.billable",
                            operator=FilterOperator.eq,
                            value=True,
                        ),
                    ],
                ),
            ],
        )
        reducer = VoidReducer(
            organization=organization,
            slug="typed-json",
            aggregation=aggregation,
            filter=filter,
            map={"tokens": {"expression": "value * 2"}},
        )
        await save_fixture(reducer)
        await session.refresh(reducer)
        assert reducer.aggregation == aggregation
        assert reducer.filter == filter
        assert reducer.map == {"tokens": {"expression": "value * 2"}}

    async def test_void_graph_coexists_with_polar_billing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        meter: Meter,
        subscription: Subscription,
        void_reducer: VoidReducer,
        void_identity: VoidBillingIdentity,
    ) -> None:
        void_meter = create_meter(organization, void_reducer)
        entitlement = VoidEntitlement(
            organization=organization, slug="exports", name="Exports"
        )
        await save_fixture(void_meter)
        await save_fixture(entitlement)
        void_product = create_product(organization)
        void_product.meter_ids = [void_meter.id]
        void_product.entitlement_ids = [entitlement.id]
        void_product.meter_terms = {
            str(void_meter.id): {"included": 100, "limit": None}
        }
        await save_fixture(void_product)
        customer.root_identity = void_identity
        await save_fixture(customer)
        started_at = datetime(2026, 9, 1, tzinfo=UTC)
        void_subscription = VoidSubscription(
            organization=organization,
            product=void_product,
            billing_identity=void_identity,
            status="active",
            started_at=started_at,
        )
        await save_fixture(void_subscription)
        derived_reducer = VoidReducer(
            organization=organization,
            slug="double-requests",
            aggregation=DerivedAggregation(
                inputs={"source": void_reducer.slug}, expression="$source * 2"
            ),
        )
        await save_fixture(derived_reducer)
        await save_fixture(
            VoidReducerDependency(
                organization=organization,
                reducer=derived_reducer,
                input_name="source",
                source_reducer=void_reducer,
            )
        )
        await save_fixture(
            VoidReducerJob(
                organization=organization,
                reducer=derived_reducer,
                bucket_start=started_at,
            )
        )
        deployment = VoidDeployment(
            organization=organization,
            checksum="config-checksum",
            version_id=VERSION,
            status="draft",
            entries=[{"resource": "product", "id": str(void_product.id)}],
        )
        await save_fixture(deployment)
        await session.refresh(deployment)
        assert deployment.entries == [
            {"resource": "product", "id": str(void_product.id)}
        ]
        await session.refresh(void_meter)
        assert void_meter.unit_amount == Decimal("0.123456789012")
        await session.refresh(void_product)
        assert void_product.amount == Decimal("1234567890123.123456")
        assert void_product.meter_terms == {
            str(void_meter.id): {"included": 100, "limit": None}
        }
        with pytest.raises(InvalidRequestError, match="lazy='raise'"):
            _ = void_product.meters
        loaded_product = await session.scalar(
            select(VoidProduct)
            .where(VoidProduct.id == void_product.id)
            .options(
                selectinload(VoidProduct.meters), selectinload(VoidProduct.entitlements)
            )
        )
        assert loaded_product is not None
        assert [item.id for item in loaded_product.meters] == [void_meter.id]
        assert [item.id for item in loaded_product.entitlements] == [entitlement.id]
        await session.refresh(void_subscription)
        with pytest.raises(InvalidRequestError, match="lazy='raise'"):
            _ = void_subscription.product
        assert await session.get(Product, product.id) is product
        assert await session.get(Meter, meter.id) is meter
        assert await session.get(Subscription, subscription.id) is subscription
        assert await session.get(Customer, customer.id) is customer
