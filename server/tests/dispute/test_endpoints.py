import uuid
from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.models import Customer, Dispute, Organization, Product, UserOrganization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_dispute,
    create_dispute_case,
    create_order,
    create_payment,
)
from tests.fixtures.stripe import build_stripe_dispute


@pytest_asyncio.fixture
async def dispute_organization_second(
    save_fixture: SaveFixture,
    product_organization_second: Product,
    customer_organization_second: Customer,
) -> Dispute:
    order = await create_order(
        save_fixture,
        product=product_organization_second,
        customer=customer_organization_second,
    )
    payment = await create_payment(
        save_fixture,
        customer_organization_second.organization,
        order=order,
    )
    return await create_dispute(save_fixture, order, payment)


@pytest_asyncio.fixture
async def dispute(
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> Dispute:
    order = await create_order(save_fixture, product=product, customer=customer)
    payment = await create_payment(save_fixture, customer.organization, order=order)
    return await create_dispute(save_fixture, order, payment)


@pytest.mark.asyncio
class TestListDisputes:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/disputes/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_does_not_see_other_organization_disputes(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        dispute_organization_second: Dispute,
    ) -> None:
        response = await client.get("/v1/disputes/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth
    async def test_user_sees_own_dispute_with_customer(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        dispute: Dispute,
        customer: Customer,
    ) -> None:
        response = await client.get("/v1/disputes/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        item = json["items"][0]
        assert item["id"] == str(dispute.id)
        assert item["customer"]["id"] == str(customer.id)
        assert item["customer"]["email"] == customer.email


@pytest.mark.asyncio
class TestGetDispute:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/disputes/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_dispute(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        dispute_organization_second: Dispute,
    ) -> None:
        response = await client.get(f"/v1/disputes/{dispute_organization_second.id}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_case_id_present_when_case_exists(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)

        response = await client.get(f"/v1/disputes/{case.dispute_id}")

        assert response.status_code == 200
        assert response.json()["case_id"] == str(case.id)

    @pytest.mark.auth
    async def test_case_id_null_without_case(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer, product=product)
        payment = await create_payment(save_fixture, organization, order=order)
        dispute = await create_dispute(save_fixture, order, payment)

        response = await client.get(f"/v1/disputes/{dispute.id}")

        assert response.status_code == 200
        assert response.json()["case_id"] is None

    @pytest.mark.auth
    async def test_user_gets_own_dispute_with_customer(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        dispute: Dispute,
        customer: Customer,
    ) -> None:
        response = await client.get(f"/v1/disputes/{dispute.id}")

        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(dispute.id)
        assert json["customer"]["id"] == str(customer.id)
        assert json["customer"]["email"] == customer.email

    @pytest.mark.auth
    @pytest.mark.parametrize(
        ("disputes_enabled", "due_in", "expected_due_in", "expected_past_due"),
        [
            (False, timedelta(days=10), timedelta(days=10), False),
            (True, timedelta(days=10), timedelta(days=7), False),
            (True, timedelta(days=1), timedelta(days=-2), True),
        ],
    )
    async def test_evidence_due_by_leaves_review_margin(
        self,
        disputes_enabled: bool,
        due_in: timedelta,
        expected_due_in: timedelta,
        expected_past_due: bool,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {"disputes_enabled": disputes_enabled}
        await save_fixture(organization)
        now = utc_now()
        order = await create_order(save_fixture, customer=customer, product=product)
        payment = await create_payment(save_fixture, organization, order=order)
        dispute = await create_dispute(
            save_fixture, order, payment, evidence_due_by=now + due_in
        )

        response = await client.get(f"/v1/disputes/{dispute.id}")

        assert response.status_code == 200
        json = response.json()
        assert datetime.fromisoformat(json["evidence_due_by"]) == now + expected_due_in
        assert json["past_due"] is expected_past_due


@pytest.mark.asyncio
class TestAcceptDispute:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(f"/v1/disputes/{uuid.uuid4()}/accept")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_accept(
        self,
        client: AsyncClient,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        # Stub the processor call and the loss side-effects; let the rest run.
        mocker.patch("polar.dispute.service.dispute_transaction_service.create_dispute")
        mocker.patch(
            "polar.dispute.service.benefit_grant_service.enqueue_benefits_grants"
        )
        close_mock = mocker.patch("polar.dispute.service.stripe_service.close_dispute")
        close_mock.return_value = build_stripe_dispute(
            status="lost", balance_transactions=[]
        )

        response = await client.post(f"/v1/disputes/{case.dispute_id}/accept")

        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(case.dispute_id)
        assert json["status"] == "lost"
        # The `case_id` column-property must serialize (regression: it was expired
        # by the status UPDATE and lazily loaded mid-serialization).
        assert json["case_id"] == str(case.id)
        close_mock.assert_awaited_once()
