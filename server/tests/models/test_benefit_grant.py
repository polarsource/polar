import pytest
from sqlalchemy.exc import IntegrityError

from polar.kit.utils import utc_now
from polar.models import Benefit, BenefitGrant, Customer, Member, Product, Subscription
from polar.models.benefit_grant import BenefitGrantScope
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest.mark.anyio
class TestBenefitGrantConstraints:
    @pytest.mark.parametrize("failed", [False, True])
    @pytest.mark.parametrize("with_member", [False, True])
    async def test_active_manual_grant_is_unique(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        customer: Customer,
        member_owner: Member,
        failed: bool,
        with_member: bool,
    ) -> None:
        member = member_owner if with_member else None
        grant = BenefitGrant(
            benefit=benefit_organization,
            customer=customer,
            member=member,
            manually_granted_at=utc_now(),
        )
        if failed:
            grant.set_grant_failed(ValueError("Fulfillment failed"))
        await save_fixture(grant)

        with pytest.raises(
            IntegrityError, match="ix_benefit_grants_active_manual_unique"
        ):
            async with session.begin_nested():
                await save_fixture(
                    BenefitGrant(
                        benefit=benefit_organization,
                        customer=customer,
                        member=member,
                        manually_granted_at=utc_now(),
                    )
                )

    async def test_manual_grants_can_coexist_for_different_members(
        self,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        customer: Customer,
        member_owner: Member,
        member_second: Member,
    ) -> None:
        for member in (None, member_owner, member_second):
            await save_fixture(
                BenefitGrant(
                    benefit=benefit_organization,
                    customer=customer,
                    member=member,
                    manually_granted_at=utc_now(),
                )
            )

    @pytest.mark.parametrize("deleted", [False, True])
    async def test_replacement_manual_grant(
        self,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        customer: Customer,
        deleted: bool,
    ) -> None:
        original = BenefitGrant(
            benefit=benefit_organization,
            customer=customer,
            manually_granted_at=utc_now(),
        )
        await save_fixture(original)
        if deleted:
            original.set_deleted_at()
        else:
            original.manually_revoked_at = utc_now()
        await save_fixture(original)

        await save_fixture(
            BenefitGrant(
                benefit=benefit_organization,
                customer=customer,
                manually_granted_at=utc_now(),
            )
        )

    @pytest.mark.parametrize("purchase_scope", ["order", "subscription"])
    async def test_suppressed_purchase_grant_stays_unique(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        customer: Customer,
        product: Product,
        subscription: Subscription,
        purchase_scope: str,
    ) -> None:
        scope: BenefitGrantScope
        if purchase_scope == "order":
            scope = {
                "order": await create_order(
                    save_fixture, customer=customer, product=product
                )
            }
        else:
            scope = {"subscription": subscription}
        await save_fixture(
            BenefitGrant(
                benefit=benefit_organization,
                customer=customer,
                manually_revoked_at=utc_now(),
                **scope,
            )
        )

        with pytest.raises(
            IntegrityError, match="ix_benefit_grants_non_manual_scope_unique"
        ):
            async with session.begin_nested():
                await save_fixture(
                    BenefitGrant(
                        benefit=benefit_organization, customer=customer, **scope
                    )
                )

    async def test_manual_grant_cannot_have_purchase_scope(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        with pytest.raises(IntegrityError, match="benefit_grants_manual_scope_check"):
            async with session.begin_nested():
                await save_fixture(
                    BenefitGrant(
                        benefit=benefit_organization,
                        customer=customer,
                        subscription=subscription,
                        manually_granted_at=utc_now(),
                    )
                )
