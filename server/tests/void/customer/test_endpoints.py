from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.auth.scope import Scope
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Member,
    Organization,
    VoidBillingIdentity,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer
from tests.void.test_endpoints import TOKEN, create_token

PATH = "/v1/void/customers"
BODY = {"external_id": "acme", "email": "billing@example.com", "name": "Acme"}
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest_asyncio.fixture
async def customer_client(
    void_client: AsyncClient, save_fixture: SaveFixture, organization: Organization
) -> AsyncClient:
    await create_token(
        save_fixture,
        organization,
        scopes={Scope.void_write, Scope.customers_read, Scope.customers_write},
    )
    void_client.headers.update(HEADERS)
    return void_client


@pytest.mark.asyncio
class TestCustomerAuthentication:
    @pytest.mark.parametrize("method", ["get", "post"])
    async def test_requires_native_scope(
        self,
        method: str,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.request(method, PATH, headers=HEADERS, json=BODY)
        assert response.status_code == 403

    async def test_read_token_cannot_bind(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(
            save_fixture,
            organization,
            scopes={Scope.void_read, Scope.customers_read, Scope.customers_write},
        )
        response = await void_client.post(PATH, headers=HEADERS, json=BODY)
        assert response.status_code == 403

    async def test_native_scope_cannot_bypass_void(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.customers_read})
        response = await void_client.get(PATH, headers=HEADERS)
        assert response.status_code == 403


@pytest.mark.asyncio
class TestCreate:
    async def test_creates_native_customer_and_root_identity(
        self, customer_client: AsyncClient, session: AsyncSession
    ) -> None:
        response = await customer_client.post(PATH, json=BODY)
        assert response.status_code == 201, response.text
        data = response.json()
        assert data.items() >= BODY.items()
        native = (
            await session.execute(
                select(Customer)
                .where(Customer.id == UUID(data["id"]))
                .options(
                    selectinload(Customer.root_identity),
                )
            )
        ).scalar_one()
        assert native.external_id == "acme"
        assert native.root_identity is not None
        assert native.root_identity_id == native.root_identity.id
        assert native.root_identity.external_id == "acme"
        assert native.root_identity.parent_id is None
        assert native.root_identity.organization_id == native.organization_id
        owner = (await session.execute(select(Member))).scalar_one()
        assert owner.customer_id == native.id
        assert owner.email == BODY["email"]

    async def test_native_customer_creation_does_not_create_root(
        self, customer_client: AsyncClient, session: AsyncSession
    ) -> None:
        response = await customer_client.post("/v1/customers/", json=BODY)
        assert response.status_code == 201, response.text
        native = await session.get(Customer, UUID(response.json()["id"]))
        assert native is not None
        assert native.root_identity_id is None
        assert (await session.scalars(select(VoidBillingIdentity))).all() == []

    async def test_reuses_existing_root(
        self,
        customer_client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        root = VoidBillingIdentity(organization=organization, external_id="acme")
        await save_fixture(root)
        root_id = root.id
        response = await customer_client.post(PATH, json=BODY)
        assert response.status_code == 201, response.text
        native = await session.get(Customer, UUID(response.json()["id"]))
        assert native is not None
        assert native.root_identity_id == root_id
        assert len((await session.scalars(select(VoidBillingIdentity))).all()) == 1

    async def test_reuses_native_customer_and_preserves_contact_details(
        self,
        customer_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        native = await create_customer(
            save_fixture,
            organization=organization,
            external_id="acme",
            email="original@example.com",
            name="Original",
        )
        response = await customer_client.post(PATH, json=BODY)
        assert response.status_code == 201, response.text
        assert response.json()["id"] == str(native.id)
        assert response.json()["email"] == "original@example.com"
        assert response.json()["name"] == "Original"

    async def test_preserves_absent_native_email(
        self,
        customer_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        native = Customer(organization=organization, external_id="acme", email=None)
        await save_fixture(native)
        response = await customer_client.post(PATH, json=BODY)
        assert response.status_code == 201, response.text
        assert response.json()["id"] == str(native.id)
        assert response.json()["email"] is None

    async def test_explicit_customer_can_establish_missing_external_id(
        self, customer_client: AsyncClient, customer: Customer
    ) -> None:
        response = await customer_client.post(
            PATH, json={**BODY, "customer_id": str(customer.id)}
        )
        assert response.status_code == 201, response.text
        assert response.json()["id"] == str(customer.id)
        assert response.json()["external_id"] == "acme"
        assert response.json()["email"] == customer.email

    async def test_does_not_merge_by_email_and_rolls_back_root(
        self,
        customer_client: AsyncClient,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        response = await customer_client.post(
            PATH, json={**BODY, "email": customer.email}
        )
        assert response.status_code == 409, response.text
        assert (
            await session.execute(select(VoidBillingIdentity))
        ).scalars().all() == []
        native = await session.get(Customer, customer.id)
        assert native is not None
        assert native.external_id is None
        assert native.root_identity_id is None

    async def test_repeated_binding_conflicts(
        self, customer_client: AsyncClient
    ) -> None:
        first = await customer_client.post(PATH, json=BODY)
        assert first.status_code == 201, first.text
        second = await customer_client.post(PATH, json=BODY)
        assert second.status_code == 409

    async def test_different_existing_external_id_conflicts(
        self,
        customer_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        native = await create_customer(
            save_fixture, organization=organization, external_id="other"
        )
        response = await customer_client.post(
            PATH, json={**BODY, "customer_id": str(native.id)}
        )
        assert response.status_code == 409

    async def test_contradictory_ids_conflict(
        self,
        customer_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        await create_customer(
            save_fixture,
            organization=organization,
            external_id="acme",
            email="other@example.com",
        )
        response = await customer_client.post(
            PATH, json={**BODY, "customer_id": str(customer.id)}
        )
        assert response.status_code == 409

    @pytest.mark.parametrize("deleted", [False, True])
    async def test_unknown_or_deleted_native_customer_not_found(
        self,
        deleted: bool,
        customer_client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        identifier = uuid4()
        if deleted:
            customer.deleted_at = utc_now()
            await save_fixture(customer)
            identifier = customer.id
        response = await customer_client.post(
            PATH, json={**BODY, "customer_id": str(identifier)}
        )
        assert response.status_code == 404

    async def test_other_organization_customer_not_found(
        self,
        customer_client: AsyncClient,
        save_fixture: SaveFixture,
        organization_second: Organization,
    ) -> None:
        native = await create_customer(save_fixture, organization=organization_second)
        response = await customer_client.post(
            PATH, json={**BODY, "customer_id": str(native.id)}
        )
        assert response.status_code == 404

    async def test_child_identity_cannot_be_owned(
        self,
        customer_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        root = VoidBillingIdentity(organization=organization, external_id="root")
        child = VoidBillingIdentity(
            organization=organization, external_id="acme", parent=root
        )
        await save_fixture(root)
        await save_fixture(child)
        response = await customer_client.post(PATH, json=BODY)
        assert response.status_code == 409

    async def test_deleted_root_cannot_be_revived(
        self,
        customer_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        root = VoidBillingIdentity(
            organization=organization, external_id="acme", deleted_at=utc_now()
        )
        await save_fixture(root)
        response = await customer_client.post(PATH, json=BODY)
        assert response.status_code == 409


@pytest.mark.asyncio
class TestRead:
    async def test_only_bound_customers_are_visible(
        self, customer_client: AsyncClient, customer: Customer
    ) -> None:
        assert (await customer_client.get(PATH)).json() == []
        response = await customer_client.post(PATH, json=BODY)
        assert response.status_code == 201, response.text
        listed = await customer_client.get(PATH)
        fetched = await customer_client.get(f"{PATH}/acme")
        assert listed.status_code == 200
        assert fetched.status_code == 200
        assert listed.json() == [fetched.json()]
        assert fetched.json()["id"] == response.json()["id"]

    async def test_root_external_id_survives_native_change_and_email_can_clear(
        self,
        customer_client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        created = await customer_client.post(PATH, json=BODY)
        assert created.status_code == 201, created.text
        native = await session.get(Customer, UUID(created.json()["id"]))
        assert native is not None
        native.external_id = "native-changed"
        native.email = None
        await save_fixture(native)
        fetched = await customer_client.get(f"{PATH}/acme")
        assert fetched.status_code == 200, fetched.text
        assert fetched.json()["external_id"] == "acme"
        assert fetched.json()["email"] is None
        assert fetched.json()["id"] == created.json()["id"]
        assert (await customer_client.get(f"{PATH}/native-changed")).status_code == 404
        rebound = await customer_client.post(
            PATH,
            json={
                **BODY,
                "external_id": "native-changed",
                "customer_id": created.json()["id"],
            },
        )
        assert rebound.status_code == 409

    @pytest.mark.parametrize("deleted_model", [Customer, VoidBillingIdentity])
    async def test_deleted_records_are_hidden(
        self,
        deleted_model: type[Customer | VoidBillingIdentity],
        customer_client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        created = await customer_client.post(PATH, json=BODY)
        assert created.status_code == 201, created.text
        statement = select(deleted_model)
        if deleted_model is Customer:
            statement = statement.where(Customer.id == UUID(created.json()["id"]))
        record = (await session.execute(statement)).scalar_one()
        record.deleted_at = utc_now()
        await save_fixture(record)
        assert (await customer_client.get(PATH)).json() == []
        assert (await customer_client.get(f"{PATH}/acme")).status_code == 404
        assert (await customer_client.post(PATH, json=BODY)).status_code == 409

    async def test_other_organization_bindings_are_hidden(
        self,
        customer_client: AsyncClient,
        save_fixture: SaveFixture,
        organization_second: Organization,
    ) -> None:
        native = await create_customer(
            save_fixture, organization=organization_second, external_id="other"
        )
        root = VoidBillingIdentity(
            organization=organization_second, external_id="other"
        )
        await save_fixture(root)
        native.root_identity = root
        await save_fixture(native)
        assert (await customer_client.get(PATH)).json() == []
        assert (await customer_client.get(f"{PATH}/other")).status_code == 404
