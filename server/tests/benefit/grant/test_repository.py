import pytest

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.strategies import BenefitActionRequiredError
from polar.kit.utils import utc_now
from polar.models import BenefitGrant, Customer, Member, Organization, Payment, Product
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_order,
    create_order_with_seats,
    create_product,
    create_refund,
    set_product_benefits,
)


@pytest.fixture
async def pending_grant(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    product: Product,
) -> BenefitGrant:
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
    return grant


@pytest.mark.anyio
class TestListErroredByCustomerAndBenefitType:
    async def test_manually_suppressed_grant_is_skipped_for_oauth_recovery(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        member_owner: Member,
        pending_grant: BenefitGrant,
    ) -> None:
        pending_grant.member = member_owner
        pending_grant.manually_revoked_at = utc_now()
        await save_fixture(pending_grant)

        repository = BenefitGrantRepository.from_session(session)
        assert not await repository.list_errored_by_customer_and_benefit_type(
            customer, BenefitType.github_repository, BenefitActionRequiredError.__name__
        )
        assert not await repository.list_errored_by_member_and_benefit_type(
            member_owner,
            BenefitType.github_repository,
            BenefitActionRequiredError.__name__,
        )

    @pytest.mark.parametrize("revoke_benefits", [False, True])
    async def test_refunded_order(
        self,
        revoke_benefits: bool,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        payment: Payment,
        pending_grant: BenefitGrant,
    ) -> None:
        assert pending_grant.order is not None
        refund = await create_refund(save_fixture, pending_grant.order, payment)
        refund.revoke_benefits = revoke_benefits
        await save_fixture(refund)

        repository = BenefitGrantRepository.from_session(session)
        grants = await repository.list_errored_by_customer_and_benefit_type(
            customer,
            BenefitType.github_repository,
            BenefitActionRequiredError.__name__,
        )

        assert list(grants) == ([] if revoke_benefits else [pending_grant])


@pytest.mark.anyio
class TestIsScopeActive:
    @pytest.mark.parametrize(
        ("with_member", "expected"), [(False, True), (True, False)]
    )
    async def test_seat_based_order_without_claimed_seat(
        self,
        with_member: bool,
        expected: bool,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        member: Member,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[("seat", 1000, "usd")],
        )
        order = await create_order_with_seats(
            save_fixture, product=product, customer=customer, seats=3
        )
        benefit = await create_benefit(save_fixture, organization=organization)
        await set_product_benefits(save_fixture, product=product, benefits=[benefit])
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit,
            member=member if with_member else None,
            order=order,
        )

        repository = BenefitGrantRepository.from_session(session)

        assert await repository.is_scope_active(grant) is expected
