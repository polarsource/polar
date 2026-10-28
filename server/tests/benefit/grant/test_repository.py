import pytest

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.strategies import BenefitActionRequiredError
from polar.models import BenefitGrant, Customer, Order, Organization, Payment, Product
from polar.models.benefit import BenefitType
from polar.models.dispute import DisputeStatus
from polar.models.refund import RefundStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_dispute,
    create_order,
    create_refund,
)


async def _create_pending_grant(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    product: Product,
) -> tuple[BenefitGrant, Order]:
    benefit = await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.github_repository,
        properties={
            "repository_owner": "polarsource",
            "repository_name": "polar",
            "permission": "pull",
        },
    )
    order = await create_order(save_fixture, customer=customer, product=product)
    grant = BenefitGrant(order=order, customer=customer, benefit=benefit)
    grant.set_grant_failed(BenefitActionRequiredError("Connect GitHub"))
    await save_fixture(grant)
    return grant, order


async def _list_errored(
    session: AsyncSession, customer: Customer
) -> list[BenefitGrant]:
    repository = BenefitGrantRepository.from_session(session)
    return list(
        await repository.list_errored_by_customer_and_benefit_type(
            customer,
            BenefitType.github_repository,
            BenefitActionRequiredError.__name__,
        )
    )


@pytest.mark.anyio
class TestListErroredByCustomerAndBenefitType:
    async def test_pending_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        grant, _ = await _create_pending_grant(
            save_fixture, organization, customer, product
        )

        assert await _list_errored(session, customer) == [grant]

    async def test_refund_without_revoke_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        payment: Payment,
    ) -> None:
        grant, order = await _create_pending_grant(
            save_fixture, organization, customer, product
        )
        await create_refund(save_fixture, order, payment)

        assert await _list_errored(session, customer) == [grant]

    async def test_refund_with_revoke_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        payment: Payment,
    ) -> None:
        _, order = await _create_pending_grant(
            save_fixture, organization, customer, product
        )
        refund = await create_refund(save_fixture, order, payment)
        refund.revoke_benefits = True
        await save_fixture(refund)

        assert await _list_errored(session, customer) == []

    async def test_failed_refund_with_revoke_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        payment: Payment,
    ) -> None:
        grant, order = await _create_pending_grant(
            save_fixture, organization, customer, product
        )
        refund = await create_refund(
            save_fixture, order, payment, status=RefundStatus.failed
        )
        refund.revoke_benefits = True
        await save_fixture(refund)

        assert await _list_errored(session, customer) == [grant]

    async def test_closed_dispute(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        payment: Payment,
    ) -> None:
        _, order = await _create_pending_grant(
            save_fixture, organization, customer, product
        )
        await create_dispute(save_fixture, order, payment, status=DisputeStatus.lost)

        assert await _list_errored(session, customer) == []
