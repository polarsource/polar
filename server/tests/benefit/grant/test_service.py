import typing
from typing import Any, cast
from unittest.mock import MagicMock, call
from uuid import uuid4

import dramatiq
import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject, is_organization
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.grant.schemas import BenefitGrantCreate, BenefitGrantCreateExternal
from polar.benefit.grant.service import BenefitGrantAlreadyExists
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.benefit.strategies import BenefitActionRequiredError, BenefitServiceProtocol
from polar.benefit.strategies.base.properties import BenefitGrantProperties
from polar.benefit.strategies.base.service import BenefitRetriableError
from polar.benefit.tasks import benefit_grant, benefit_revoke
from polar.config import settings
from polar.exceptions import NotPermitted, PolarRequestValidationError, ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    Member,
    Organization,
    Product,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrantScope
from polar.models.catalog import Catalog, CatalogStatus
from polar.models.member import MemberRole
from polar.models.user_organization import OrganizationRole
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_customer,
    create_member,
    create_order,
    create_subscription,
    set_product_benefits,
)


@pytest.fixture(autouse=True)
def benefit_strategy_mock(mocker: MockerFixture) -> MagicMock:
    strategy_mock = MagicMock(spec=BenefitServiceProtocol)
    strategy_mock.should_revoke_individually = False
    strategy_mock.grant.return_value = {}
    strategy_mock.revoke.return_value = {}
    strategy_mock.cycle.return_value = {}
    mock = mocker.patch("polar.benefit.grant.service.get_benefit_strategy")
    mock.return_value = strategy_mock
    return strategy_mock


@pytest.mark.anyio
class TestCreate:
    async def test_creates_pending_grant_for_owner_and_rejects_duplicate(
        self,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        member_owner: Member,
        benefit_organization: Benefit,
        mocker: MockerFixture,
    ) -> None:
        auth_subject = AuthSubject(organization, set(), None)
        create = BenefitGrantCreate(
            customer_id=customer.id, benefit_id=benefit_organization.id
        )
        enqueue = mocker.patch("polar.benefit.grant.service.enqueue_job")

        grant = await benefit_grant_service.create(session, auth_subject, create)

        assert grant.member_id == member_owner.id
        assert grant.scope == {}
        assert grant.manually_granted_at is not None
        assert grant.granted_at is None
        assert grant.revoked_at is None

        with pytest.raises(BenefitGrantAlreadyExists):
            await benefit_grant_service.create(
                session,
                auth_subject,
                create.model_copy(update={"member_id": member_owner.id}),
            )
        enqueue.assert_called_once_with(
            "benefit.grant",
            customer_id=customer.id,
            benefit_id=benefit_organization.id,
            benefit_grant_id=grant.id,
        )

    @pytest.mark.auth(AuthSubjectFixture(), AuthSubjectFixture(subject="organization"))
    @pytest.mark.parametrize("explicit_member", [False, True])
    async def test_external_ids(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        member_owner: Member,
        organization: Organization,
        user_organization: UserOrganization,
        auth_subject: AuthSubject[User | Organization],
        explicit_member: bool,
    ) -> None:
        customer.external_id = "customer_1"
        benefit_organization.external_id = "benefit_1"
        await save_fixture(customer)
        await save_fixture(benefit_organization)
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="another-member@example.com",
            external_id="member_1",
        )
        await create_benefit(
            save_fixture,
            organization=organization,
            external_id="benefit_1",
            is_current=False,
        )
        grant = await benefit_grant_service.create(
            session,
            auth_subject,
            BenefitGrantCreateExternal(
                external_customer_id="customer_1",
                external_benefit_id="benefit_1",
                external_member_id="member_1" if explicit_member else None,
                organization_id=None
                if is_organization(auth_subject)
                else organization.id,
            ),
        )

        assert grant.customer_id == customer.id
        assert grant.benefit_id == benefit_organization.id
        assert grant.member_id == (member.id if explicit_member else member_owner.id)

    async def test_different_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        benefit_organization: Benefit,
        member_owner: Member,
    ) -> None:
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="another-member@example.com",
        )
        auth_subject = AuthSubject(organization, set(), None)
        create = BenefitGrantCreate(
            customer_id=customer.id, benefit_id=benefit_organization.id
        )

        first = await benefit_grant_service.create(session, auth_subject, create)
        second = await benefit_grant_service.create(
            session, auth_subject, create.model_copy(update={"member_id": member.id})
        )

        assert first.id != second.id
        assert second.member_id == member.id

    @pytest.mark.parametrize(
        "resource", ["customer", "benefit", "member", "same_org_member"]
    )
    async def test_rejects_references_outside_organization_or_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        customer_second: Customer,
        customer_organization_second: Customer,
        organization: Organization,
        organization_second: Organization,
        benefit_organization: Benefit,
        resource: str,
    ) -> None:
        payload = {
            "customer_id": customer.id,
            "benefit_id": benefit_organization.id,
        }
        if resource == "customer":
            field = "customer_id"
            payload[field] = customer_organization_second.id
        elif resource == "benefit":
            benefit = await create_benefit(
                save_fixture, organization=organization_second
            )
            field = "benefit_id"
            payload[field] = benefit.id
        else:
            member = await create_member(
                save_fixture,
                customer=customer_second
                if resource == "same_org_member"
                else customer_organization_second,
                organization=organization
                if resource == "same_org_member"
                else organization_second,
            )
            field = "member_id"
            payload[field] = member.id
        with pytest.raises(PolarRequestValidationError) as exc:
            await benefit_grant_service.create(
                session,
                AuthSubject(organization, set(), None),
                BenefitGrantCreate(**payload),
            )
        assert exc.value.errors()[0]["loc"] == ("body", field)

    @pytest.mark.parametrize("resource", ["customer", "member"])
    async def test_deleted_recipient(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        benefit_organization: Benefit,
        member_owner: Member,
        resource: str,
    ) -> None:
        recipient = customer if resource == "customer" else member_owner
        recipient.set_deleted_at()
        await save_fixture(recipient)
        with pytest.raises(PolarRequestValidationError) as exc:
            await benefit_grant_service.create(
                session,
                AuthSubject(organization, set(), None),
                BenefitGrantCreate(
                    customer_id=customer.id,
                    benefit_id=benefit_organization.id,
                    member_id=member_owner.id,
                ),
            )
        assert exc.value.errors()[0]["loc"] == ("body", f"{resource}_id")

    @pytest.mark.parametrize("unavailable", ["deleted", "draft", "meter_credit"])
    async def test_unavailable_benefit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        benefit_organization: Benefit,
        unavailable: str,
    ) -> None:
        if unavailable == "deleted":
            benefit_organization.set_deleted_at()
        elif unavailable == "draft":
            catalog = Catalog(organization=organization, status=CatalogStatus.draft)
            await save_fixture(catalog)
            benefit_organization.catalog = catalog
            benefit_organization.is_current = False
        else:
            benefit_organization.type = BenefitType.meter_credit
        await save_fixture(benefit_organization)
        with pytest.raises(PolarRequestValidationError) as exc:
            await benefit_grant_service.create(
                session,
                AuthSubject(organization, set(), None),
                BenefitGrantCreate(
                    customer_id=customer.id, benefit_id=benefit_organization.id
                ),
            )
        error = exc.value.errors()[0]
        assert error["loc"] == ("body", "benefit_id")
        if unavailable == "meter_credit":
            assert error["msg"] == "Meter-credit benefits cannot be granted manually."

    @pytest.mark.auth
    async def test_finance_role_rejected(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
        auth_subject: AuthSubject[User],
    ) -> None:
        user_organization.role = OrganizationRole.finance
        await save_fixture(user_organization)
        with pytest.raises(NotPermitted):
            await benefit_grant_service.create(
                session,
                auth_subject,
                BenefitGrantCreate(
                    customer_id=customer.id, benefit_id=benefit_organization.id
                ),
            )
        grant = await create_benefit_grant(
            save_fixture, customer, benefit_organization, member=None
        )
        with pytest.raises(NotPermitted):
            await benefit_grant_service.revoke(session, auth_subject, grant.id)

    async def test_external_ids_scoped_to_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer_organization_second: Customer,
        benefit_organization: Benefit,
    ) -> None:
        customer_organization_second.external_id = "other_customer"
        benefit_organization.external_id = "benefit_1"
        await save_fixture(customer_organization_second)
        await save_fixture(benefit_organization)
        with pytest.raises(PolarRequestValidationError) as exc:
            await benefit_grant_service.create(
                session,
                AuthSubject(organization, set(), None),
                BenefitGrantCreateExternal(
                    external_customer_id="other_customer",
                    external_benefit_id="benefit_1",
                ),
            )
        assert exc.value.errors()[0]["loc"] == ("body", "external_customer_id")


@pytest.mark.anyio
class TestRevoke:
    @pytest.mark.parametrize(
        "source", ["manual", "order", "subscription", "meter_credit"]
    )
    async def test_revoke_is_repeatable(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        benefit_organization: Benefit,
        product: Product,
        subscription: Subscription,
        source: str,
    ) -> None:
        if source == "meter_credit":
            benefit_organization.type = BenefitType.meter_credit
            await save_fixture(benefit_organization)
        scope: BenefitGrantScope = {}
        if source == "order":
            scope["order"] = await create_order(
                save_fixture, customer=customer, product=product
            )
        elif source in ("subscription", "meter_credit"):
            scope["subscription"] = subscription
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            member=None,
            **scope,
        )
        if source == "manual":
            grant.manually_granted_at = utc_now()
            await save_fixture(grant)
        original_scope = grant.scope
        enqueue = mocker.patch("polar.benefit.grant.service.enqueue_job")
        auth_subject = AuthSubject(organization, set(), None)

        suppressed = await benefit_grant_service.revoke(session, auth_subject, grant.id)
        timestamp = suppressed.manually_revoked_at
        assert timestamp is not None
        assert suppressed.is_granted
        assert suppressed.scope == original_scope
        assert suppressed.revoked_at is None

        repeated = await benefit_grant_service.revoke(session, auth_subject, grant.id)
        assert repeated.manually_revoked_at == timestamp
        assert (
            enqueue.call_args_list
            == [
                call(
                    "benefit.revoke",
                    customer_id=customer.id,
                    benefit_id=benefit_organization.id,
                    benefit_grant_id=grant.id,
                )
            ]
            * 2
        )

    async def test_regrant_and_stale_fulfillment(
        self,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        benefit_organization: Benefit,
        member_owner: Member,
    ) -> None:
        auth_subject = AuthSubject(organization, set(), None)
        create = BenefitGrantCreate(
            customer_id=customer.id, benefit_id=benefit_organization.id
        )
        original = await benefit_grant_service.create(session, auth_subject, create)
        old_id = original.id
        await benefit_grant_service.revoke(session, auth_subject, old_id)
        replacement = await benefit_grant_service.create(session, auth_subject, create)
        new_id = replacement.id
        assert new_id != old_id

        await benefit_grant(
            customer.id, benefit_organization.id, benefit_grant_id=new_id
        )
        await benefit_grant(
            customer.id, benefit_organization.id, benefit_grant_id=old_id
        )
        await benefit_revoke(
            customer.id, benefit_organization.id, benefit_grant_id=old_id
        )
        session.expunge_all()
        repository = BenefitGrantRepository.from_session(session)
        old = await repository.get_by_id(old_id)
        new = await repository.get_by_id(new_id)
        assert old is not None
        assert old.is_revoked
        assert old.manually_revoked_at is not None
        assert new is not None
        assert new.is_granted

    async def test_missing_or_inaccessible(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer_organization_second: Customer,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        benefit = await create_benefit(save_fixture, organization=organization_second)
        grant = await create_benefit_grant(
            save_fixture, customer_organization_second, benefit, member=None
        )
        for grant_id in (grant.id, uuid4()):
            with pytest.raises(ResourceNotFound):
                await benefit_grant_service.revoke(
                    session, AuthSubject(organization, set(), None), grant_id
                )


@pytest.mark.anyio
class TestGrantBenefit:
    async def test_manually_revoked_purchase_is_not_regranted(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        subscription: Subscription,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=False,
            subscription=subscription,
            member=None,
        )
        manually_revoked_at = utc_now()
        grant.manually_revoked_at = manually_revoked_at
        await save_fixture(grant)

        retry = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert retry.id == grant.id
        assert retry.is_revoked
        assert retry.manually_revoked_at == manually_revoked_at
        benefit_strategy_mock.grant.assert_not_awaited()

    async def test_not_existing_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        benefit_strategy_mock.grant.return_value = {"external_id": "abc"}

        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert grant.subscription_id == subscription.id
        assert grant.customer == customer
        assert grant.benefit_id == benefit_organization.id
        assert grant.is_granted
        assert cast(Any, grant.properties) == {"external_id": "abc"}
        benefit_strategy_mock.grant.assert_called_once()

    async def test_existing_grant_not_granted(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        benefit_strategy_mock.grant.assert_called_once()

    async def test_existing_grant_already_granted(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        grant.set_granted()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        benefit_strategy_mock.grant.assert_not_called()

    async def test_action_required_error(
        self,
        session: AsyncSession,
        redis: Redis,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        error_message = "Action required error message"
        benefit_strategy_mock.grant.side_effect = BenefitActionRequiredError(
            error_message
        )

        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert not grant.is_granted
        assert grant.error is not None
        assert grant.error["message"] == error_message
        assert grant.error["type"] == "BenefitActionRequiredError"
        assert "timestamp" in grant.error

    async def test_action_required_error_with_grant_properties(
        self,
        session: AsyncSession,
        redis: Redis,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        error_message = "Action required error message"
        grant_properties = cast(BenefitGrantProperties, {"external_id": "abc"})
        benefit_strategy_mock.grant.side_effect = BenefitActionRequiredError(
            error_message, grant_properties=grant_properties
        )

        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert not grant.is_granted
        assert cast(Any, grant.properties) == {"external_id": "abc"}
        assert grant.error is not None
        assert grant.error["message"] == error_message
        assert grant.error["type"] == "BenefitActionRequiredError"

    async def test_revoked_grant_action_required_error(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        grant.set_revoked()
        await save_fixture(grant)

        error_message = "Action required error message"
        benefit_strategy_mock.grant.side_effect = BenefitActionRequiredError(
            error_message
        )

        updated_grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert grant.error is not None
        assert grant.error["message"] == error_message
        assert grant.error["type"] == "BenefitActionRequiredError"
        assert grant.granted_at is None
        assert grant.revoked_at is None

    async def test_default_properties_value(
        self,
        session: AsyncSession,
        redis: Redis,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        benefit_strategy_mock.grant.side_effect = (
            lambda customer, benefit, properties, **kwargs: properties
        )

        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert grant.properties == {}


@pytest.mark.anyio
class TestRevokeBenefit:
    async def test_manually_revoked_purchase_still_revokes_access(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        subscription: Subscription,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
            member=None,
        )
        manually_revoked_at = utc_now()
        grant.manually_revoked_at = manually_revoked_at
        await save_fixture(grant)

        revoked = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, grant=grant
        )

        assert revoked.is_revoked
        assert revoked.manually_revoked_at == manually_revoked_at
        benefit_strategy_mock.revoke.assert_awaited_once()

    async def test_revoking_pending_suppressed_purchase_preserves_other_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        subscription: Subscription,
        product: Product,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        pending = BenefitGrant(
            customer=customer,
            benefit=benefit_organization,
            subscription=subscription,
            manually_revoked_at=utc_now(),
            properties={"granted_account_id": "123"},
        )
        pending.set_grant_failed(BenefitActionRequiredError("Reconnect account"))
        await save_fixture(pending)

        other_subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        active = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=other_subscription,
        )

        revoked = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert revoked.id == pending.id
        assert revoked.is_revoked
        assert active.is_granted
        benefit_strategy_mock.revoke.assert_not_awaited()

    async def test_not_existing_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert grant.subscription_id == subscription.id
        assert grant.benefit_id == benefit_organization.id
        assert grant.is_revoked
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_existing_grant_not_revoked(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        benefit_strategy_mock.revoke.return_value = {"message": "ok"}

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            properties={"external_id": "abc"},
            member=None,
        )
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        assert cast(Any, updated_grant.properties) == {"message": "ok"}
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_existing_grant_already_revoked(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        grant.set_revoked()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        benefit_strategy_mock.revoke.assert_not_called()

    async def test_several_benefit_grants(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
        product: Product,
    ) -> None:
        first_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            subscription=subscription,
            member=None,
        )
        first_grant.set_granted()
        await save_fixture(first_grant)

        second_subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        second_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            subscription=second_subscription,
            member=None,
        )
        second_grant.set_granted()
        await save_fixture(second_grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == first_grant.id
        assert updated_grant.is_revoked
        benefit_strategy_mock.revoke.assert_not_called()

    async def test_suppressed_overlapping_grant_does_not_keep_provider_access(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
        product: Product,
    ) -> None:
        order = await create_order(save_fixture, customer=customer, product=product)
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
            member=None,
        )
        other_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            order=order,
            member=None,
        )
        for suppressed in (grant, other_grant):
            suppressed.manually_revoked_at = utc_now()
            await save_fixture(suppressed)

        revoked = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, grant=grant
        )

        assert revoked.is_revoked
        assert other_grant.is_granted
        benefit_strategy_mock.revoke.assert_awaited_once()

    async def test_several_benefit_grants_should_individual_revoke(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
        product: Product,
    ) -> None:
        benefit_strategy_mock.should_revoke_individually = True
        benefit_strategy_mock.revoke.return_value = {"message": "ok"}

        first_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            subscription=subscription,
            member=None,
        )
        first_grant.set_granted()
        await save_fixture(first_grant)

        second_subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        second_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            subscription=second_subscription,
            member=None,
        )
        second_grant.set_granted()
        await save_fixture(second_grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == first_grant.id
        assert updated_grant.is_revoked
        assert cast(Any, updated_grant.properties) == {"message": "ok"}
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_action_required_error(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        error_message = "Revoke action required error message"
        benefit_strategy_mock.revoke.side_effect = BenefitActionRequiredError(
            error_message
        )

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            properties={"external_id": "abc"},
            member=None,
        )
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        # In revoke_benefit, we don't set the error field when BenefitActionRequiredError is raised
        # This is because we always want to mark the grant as revoked, regardless of errors
        benefit_strategy_mock.revoke.assert_called_once()


@pytest.mark.anyio
class TestEnqueueBenefitsGrants:
    async def test_grant_skips_manually_revoked_purchase(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        product: Product,
        subscription: Subscription,
        mocker: MockerFixture,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=False,
            subscription=subscription,
            member=None,
        )
        grant.manually_revoked_at = utc_now()
        await save_fixture(grant)
        await set_product_benefits(
            save_fixture, product=product, benefits=[benefit_organization]
        )
        enqueue = mocker.patch("polar.benefit.grant.service.enqueue_job")

        await benefit_grant_service.enqueue_benefits_grants(
            session, "grant", customer, product, subscription=subscription
        )

        enqueue.assert_not_called()

    async def test_grant_no_existing_grants(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """All benefits are enqueued when there are no existing grants."""
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "grant", customer, product, subscription=subscription
        )

        enqueue_job_mock.assert_called_once()
        call_args = enqueue_job_mock.call_args
        assert call_args[0][0] == "benefit.enqueue_grants"
        assert call_args[1]["customer_id"] == customer.id
        assert set(call_args[1]["grant_benefit_ids"]) == {b.id for b in benefits}
        assert call_args[1]["subscription_id"] == subscription.id

    async def test_grant_skips_already_granted_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """Already granted benefits are not re-enqueued."""
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefits[0],
            member=None,
        )
        grant.set_granted()
        await save_fixture(grant)

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "grant", customer, product, subscription=subscription
        )

        call_args = enqueue_job_mock.call_args
        assert call_args[0][0] == "benefit.enqueue_grants"
        grant_benefit_ids = call_args[1]["grant_benefit_ids"]
        assert benefits[0].id not in grant_benefit_ids
        assert set(grant_benefit_ids) == {b.id for b in benefits[1:]}

    async def test_grant_skips_errored_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """Benefits with BenefitActionRequiredError are not re-enqueued."""
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefits[0],
            member=None,
        )
        grant.set_grant_failed(BenefitActionRequiredError("Connect GitHub"))
        await save_fixture(grant)

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "grant", customer, product, subscription=subscription
        )

        call_args = enqueue_job_mock.call_args
        assert call_args[0][0] == "benefit.enqueue_grants"
        grant_benefit_ids = call_args[1]["grant_benefit_ids"]
        assert benefits[0].id not in grant_benefit_ids
        assert set(grant_benefit_ids) == {b.id for b in benefits[1:]}

    async def test_grant_reenqueues_revoked_previously_errored_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """Revoked grants clear their error, so a benefit that previously failed
        with BenefitActionRequiredError is re-enqueued after revocation."""
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefits[0],
            member=None,
        )
        grant.set_grant_failed(BenefitActionRequiredError("Connect GitHub"))
        grant.set_revoked()
        await save_fixture(grant)

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "grant", customer, product, subscription=subscription
        )

        call_args = enqueue_job_mock.call_args
        assert call_args[0][0] == "benefit.enqueue_grants"
        grant_benefit_ids = call_args[1]["grant_benefit_ids"]
        assert set(grant_benefit_ids) == {b.id for b in benefits}

    async def test_revoke_only_granted_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """Only granted benefits are revoked via a group with callback."""
        group_mock = mocker.patch("polar.benefit.grant.service.group")
        broker_mock = mocker.patch("polar.benefit.grant.service.dramatiq.get_broker")

        revoke_actor = MagicMock()
        enqueue_grants_actor = MagicMock()
        actors = {
            "benefit.revoke": revoke_actor,
            "benefit.enqueue_grants": enqueue_grants_actor,
        }
        broker_mock.return_value.get_actor.side_effect = lambda name: actors.get(
            name, MagicMock()
        )

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefits[0],
            member=None,
        )
        grant.set_granted()
        await save_fixture(grant)

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "revoke", customer, product, subscription=subscription
        )

        revoke_actor.message.assert_called_once_with(
            customer_id=customer.id,
            benefit_id=benefits[0].id,
            member_id=None,
            subscription_id=subscription.id,
        )
        group_mock.assert_called_once_with([revoke_actor.message.return_value])
        enqueue_grants_actor.message.assert_called_once_with(
            customer_id=customer.id,
            grant_benefit_ids=[],
            member_id=None,
            subscription_id=subscription.id,
        )
        group_mock.return_value.add_completion_callback.assert_called_once_with(
            enqueue_grants_actor.message.return_value
        )
        group_mock.return_value.run.assert_called_once()

    async def test_revoke_enqueues_grants_for_soft_deleted_member(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
        member_owner: Member,
        member_second: Member,
    ) -> None:
        mocker.patch("polar.benefit.grant.service.group")
        broker = mocker.patch("polar.benefit.grant.service.dramatiq.get_broker")
        revoke_actor = MagicMock()
        broker.return_value.get_actor.side_effect = {
            "benefit.revoke": revoke_actor,
            "benefit.enqueue_grants": MagicMock(),
        }.__getitem__
        await set_product_benefits(save_fixture, product=product, benefits=benefits)
        await create_benefit_grant(
            save_fixture,
            customer,
            benefits[0],
            granted=True,
            member=member_second,
            subscription=subscription,
        )
        await create_benefit_grant(
            save_fixture,
            customer,
            benefits[1],
            granted=True,
            member=member_owner,
            subscription=subscription,
        )
        member_second.set_deleted_at()
        await save_fixture(member_second)

        await benefit_grant_service.enqueue_benefits_grants(
            session,
            "revoke",
            customer,
            product,
            member_id=member_second.id,
            subscription=subscription,
        )

        revoke_actor.message.assert_called_once_with(
            customer_id=customer.id,
            benefit_id=benefits[0].id,
            member_id=member_second.id,
            subscription_id=subscription.id,
        )

    async def test_revoke_pending_action_required_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
    ) -> None:
        group_mock = mocker.patch("polar.benefit.grant.service.group")
        broker_mock = mocker.patch("polar.benefit.grant.service.dramatiq.get_broker")
        revoke_actor = MagicMock()
        broker_mock.return_value.get_actor.side_effect = lambda name: (
            revoke_actor if name == "benefit.revoke" else MagicMock()
        )

        order = await create_order(save_fixture, customer=customer, product=product)
        grant = BenefitGrant(
            order=order, customer=customer, benefit=benefits[0], member=None
        )
        grant.set_grant_failed(BenefitActionRequiredError("Connect GitHub"))
        await save_fixture(grant)

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "revoke", customer, product, order=order
        )

        revoke_actor.message.assert_called_once_with(
            customer_id=customer.id,
            benefit_id=benefits[0].id,
            member_id=None,
            order_id=order.id,
        )
        group_mock.return_value.run.assert_called_once()

    async def test_revoke_no_grants_enqueues_nothing(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """No jobs are enqueued when there are no grants to revoke."""
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")
        group_mock = mocker.patch("polar.benefit.grant.service.group")

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "revoke", customer, product, subscription=subscription
        )

        enqueue_job_mock.assert_not_called()
        group_mock.assert_not_called()

    async def test_subscription_upgrade_revokes_before_grants(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
        customer: Customer,
    ) -> None:
        """
        Subscription upgrade creates pipeline: revoke group -> enqueue_grants callback.

        This ensures old benefits are revoked, meters are reset, then new benefits
        are granted - fixing the negative credits bug.
        """
        group_mock = mocker.patch("polar.benefit.grant.service.group")
        broker_mock = mocker.patch("polar.benefit.grant.service.dramatiq.get_broker")

        revoke_actor = MagicMock()
        enqueue_grants_actor = MagicMock()
        actors = {
            "benefit.revoke": revoke_actor,
            "benefit.enqueue_grants": enqueue_grants_actor,
        }
        broker_mock.return_value.get_actor.side_effect = lambda name: actors.get(
            name, MagicMock()
        )

        old_benefit = benefits[0]
        new_benefits = benefits[1:]

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=old_benefit,
            member=None,
        )
        grant.set_granted()
        await save_fixture(grant)

        product = await set_product_benefits(
            save_fixture, product=product, benefits=new_benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "grant", customer, product, subscription=subscription
        )

        revoke_actor.message.assert_called_once_with(
            customer_id=customer.id,
            benefit_id=old_benefit.id,
            member_id=None,
            subscription_id=subscription.id,
        )
        group_mock.assert_called_once_with([revoke_actor.message.return_value])

        enqueue_grants_actor.message.assert_called_once()
        callback_kwargs = enqueue_grants_actor.message.call_args[1]
        assert callback_kwargs["customer_id"] == customer.id
        assert set(callback_kwargs["grant_benefit_ids"]) == {b.id for b in new_benefits}
        assert callback_kwargs["member_id"] is None
        assert callback_kwargs["subscription_id"] == subscription.id

        group_mock.return_value.add_completion_callback.assert_called_once_with(
            enqueue_grants_actor.message.return_value
        )
        group_mock.return_value.run.assert_called_once()


@pytest.mark.anyio
class TestEnqueueBenefitGrantUpdates:
    async def test_not_required_update(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")
        benefit_strategy_mock.requires_update.return_value = False

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, redis, benefit_organization, {}
        )

        enqueue_job_mock.assert_not_called()

    async def test_required_update_granted(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        granted_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        granted_grant.set_granted()
        await save_fixture(granted_grant)

        other_benefit_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization_second,
            member=None,
        )
        other_benefit_grant.set_granted()
        await save_fixture(other_benefit_grant)

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")
        benefit_strategy_mock.requires_update.return_value = True

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, redis, benefit_organization, {}
        )

        enqueue_job_mock.assert_called_once_with(
            "benefit.update",
            benefit_grant_id=granted_grant.id,
        )

    async def test_required_update_revoked(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        revoked_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        revoked_grant.set_revoked()
        await save_fixture(revoked_grant)

        other_benefit_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization_second,
            member=None,
        )
        other_benefit_grant.set_granted()
        await save_fixture(other_benefit_grant)

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")
        benefit_strategy_mock.requires_update.return_value = True

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, redis, benefit_organization, {}
        )

        enqueue_job_mock.assert_not_called()


@pytest.mark.anyio
class TestUpdateBenefitGrant:
    async def test_manually_revoked_purchase_is_not_updated(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        subscription: Subscription,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
            member=None,
        )
        grant.manually_revoked_at = utc_now()
        await save_fixture(grant)

        await benefit_grant_service.update_benefit_grant(session, redis, grant)

        benefit_strategy_mock.grant.assert_not_awaited()

    async def test_revoked_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        grant.set_revoked()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.update_benefit_grant(
            session, redis, grant
        )

        assert updated_grant.id == grant.id
        benefit_strategy_mock.grant.assert_not_called()

    async def test_granted_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        benefit_strategy_mock.grant.return_value = {"external_id": "xyz"}

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            properties={"external_id": "abc"},
            member=None,
        )
        grant.set_granted()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.update_benefit_grant(
            session, redis, grant
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        assert cast(Any, updated_grant.properties) == {"external_id": "xyz"}
        benefit_strategy_mock.grant.assert_called_once()
        assert benefit_strategy_mock.grant.call_args[1]["update"] is True

    async def test_action_required_error(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        grant.set_granted()
        await save_fixture(grant)

        error_message = "Update action required error message"
        benefit_strategy_mock.grant.side_effect = BenefitActionRequiredError(
            error_message
        )

        updated_grant = await benefit_grant_service.update_benefit_grant(
            session, redis, grant
        )

        assert not updated_grant.is_granted
        assert updated_grant.error is not None
        assert updated_grant.error["message"] == error_message
        assert updated_grant.error["type"] == "BenefitActionRequiredError"
        assert "timestamp" in updated_grant.error

    async def test_action_required_error_with_grant_properties(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            properties={"external_id": "abc"},
            member=None,
        )
        grant.set_granted()
        await save_fixture(grant)

        error_message = "Update action required error message"
        grant_properties = cast(BenefitGrantProperties, {"external_id": "xyz"})
        benefit_strategy_mock.grant.side_effect = BenefitActionRequiredError(
            error_message, grant_properties=grant_properties
        )

        updated_grant = await benefit_grant_service.update_benefit_grant(
            session, redis, grant
        )

        assert not updated_grant.is_granted
        assert cast(Any, updated_grant.properties) == {"external_id": "xyz"}
        assert updated_grant.error is not None
        assert updated_grant.error["message"] == error_message
        assert updated_grant.error["type"] == "BenefitActionRequiredError"


@pytest.mark.anyio
class TestEnqueueBenefitGrantCycles:
    async def test_required_update_revoked(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        revoked_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        revoked_grant.set_revoked()
        await save_fixture(revoked_grant)

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization_second,
            member=None,
        )
        grant.set_granted()
        await save_fixture(grant)

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        await benefit_grant_service.enqueue_benefit_grant_cycles(
            session, redis, subscription=subscription
        )

        enqueue_job_mock.assert_called_once_with(
            "benefit.cycle", benefit_grant_id=grant.id
        )


@pytest.mark.anyio
class TestCycleBenefitGrant:
    async def test_manually_revoked_purchase_is_not_cycled(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        subscription: Subscription,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
            member=None,
        )
        grant.manually_revoked_at = utc_now()
        await save_fixture(grant)

        await benefit_grant_service.cycle_benefit_grant(session, redis, grant)

        benefit_strategy_mock.cycle.assert_not_awaited()

    async def test_revoked_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        grant.set_revoked()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.cycle_benefit_grant(
            session, redis, grant
        )

        assert updated_grant.id == grant.id
        benefit_strategy_mock.cycle.assert_not_called()

    async def test_granted_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        benefit_strategy_mock.cycle.return_value = {"external_id": "xyz"}
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            properties={"external_id": "abc"},
            subscription=subscription,
            member=None,
        )

        updated_grant = await benefit_grant_service.cycle_benefit_grant(
            session, redis, grant
        )

        benefit_strategy_mock.cycle.assert_called_once()

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        assert cast(Any, updated_grant.properties) == {"external_id": "xyz"}

    async def test_action_required_error(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
            member=None,
        )

        error_message = "Cycle action required error message"
        benefit_strategy_mock.cycle.side_effect = BenefitActionRequiredError(
            error_message
        )

        updated_grant = await benefit_grant_service.cycle_benefit_grant(
            session, redis, grant
        )

        benefit_strategy_mock.cycle.assert_called_once()
        assert not updated_grant.is_granted
        assert updated_grant.error is not None
        assert updated_grant.error["message"] == error_message
        assert updated_grant.error["type"] == "BenefitActionRequiredError"
        assert "timestamp" in updated_grant.error


@pytest.mark.anyio
class TestEnqueueBenefitGrantDeletions:
    @pytest.mark.parametrize("fulfilled", [False, True])
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        fulfilled: bool,
    ) -> None:
        granted_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        if fulfilled:
            granted_grant.set_granted()
        await save_fixture(granted_grant)

        other_benefit_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization_second,
            member=None,
        )
        other_benefit_grant.set_granted()
        await save_fixture(other_benefit_grant)

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        await benefit_grant_service.enqueue_benefit_grant_deletions(
            session, benefit_organization
        )

        enqueue_job_mock.assert_called_once_with(
            "benefit.delete_grant", benefit_grant_id=granted_grant.id
        )


@pytest.mark.anyio
class TestEnqueueCustomerGrantDeletions:
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
    ) -> None:
        grant1 = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        grant1.set_granted()
        await save_fixture(grant1)

        grant2 = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization_second,
            member=None,
        )
        await save_fixture(grant2)

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        await benefit_grant_service.enqueue_customer_grant_deletions(session, customer)

        # The deletion order is irrelevant, so don't assert on it.
        enqueue_job_mock.assert_has_calls(
            [
                call("benefit.delete_grant", benefit_grant_id=grant1.id),
                call("benefit.delete_grant", benefit_grant_id=grant2.id),
            ],
            any_order=True,
        )


@pytest.mark.anyio
class TestEnqueueMemberGrantDeletions:
    async def test_includes_errored_grants(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        member: Member,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        benefit_organization_third: Benefit,
    ) -> None:
        granted_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            member=member,
            subscription=subscription,
        )

        errored_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            member=member,
            benefit=benefit_organization_second,
        )
        errored_grant.set_grant_failed(Exception("OAuth account missing"))
        await save_fixture(errored_grant)

        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization_third,
            granted=False,
            member=member,
            subscription=subscription,
        )

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        await benefit_grant_service.enqueue_member_grant_deletions(session, member.id)

        assert enqueue_job_mock.call_count == 2
        enqueue_job_mock.assert_has_calls(
            [
                call("benefit.delete_grant", benefit_grant_id=granted_grant.id),
                call("benefit.delete_grant", benefit_grant_id=errored_grant.id),
            ],
            any_order=True,
        )


@pytest.mark.anyio
class TestDeleteBenefitGrant:
    async def test_revoked_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        grant.set_revoked()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.delete_benefit_grant(
            session, redis, grant
        )

        assert updated_grant.id == grant.id
        benefit_strategy_mock.revoke.assert_not_called()

    async def test_granted_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        grant.set_granted()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.delete_benefit_grant(
            session, redis, grant
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_granted_grant_exhausted_retries(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
        current_message: dramatiq.Message[typing.Any],
    ) -> None:
        current_message.options["retries"] = settings.WORKER_MAX_RETRIES

        benefit_strategy_mock.revoke.side_effect = BenefitRetriableError()

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        grant.set_granted()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.delete_benefit_grant(
            session, redis, grant
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_granted_grant_with_deleted_member_passes_member_to_revoke(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
        member_owner: Member,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """``delete_benefit_grant`` resolves soft-deleted members so the benefit
        strategy (e.g. GitHub repository) can still access the member's stored
        OAuth account when cleaning up after a member deletion.

        Regression test: previously ``delete_benefit_grant`` used
        ``get_by_id`` without ``include_deleted=True``, so a soft-deleted
        member resolved to ``None`` and the strategy's ``revoke`` fell back to
        the customer's (different) OAuth account, raising
        ``BenefitActionRequiredError``. That error was swallowed and the grant
        was marked revoked while external access persisted.
        """
        from polar.member.repository import MemberRepository

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=member,
        )
        grant.set_granted()
        await save_fixture(grant)
        surviving = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            member=member_owner,
            subscription=subscription,
        )

        # Soft-delete the member, mirroring what MemberService.delete() does
        member_repository = MemberRepository.from_session(session)
        await member_repository.soft_delete(member)
        await session.flush()

        updated_grant = await benefit_grant_service.delete_benefit_grant(
            session, redis, grant
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        assert surviving.is_granted
        benefit_strategy_mock.revoke.assert_called_once()
        # The resolved (soft-deleted) member must be passed to revoke so the
        # strategy can look up the member's stored OAuth account.
        revoke_kwargs = benefit_strategy_mock.revoke.call_args.kwargs
        assert revoke_kwargs["member"] is not None
        assert revoke_kwargs["member"].id == member.id


@pytest.mark.anyio
class TestGetByBenefitAndScope:
    async def test_existing_grant_incorrect_scope(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        await save_fixture(grant)

        other_subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        order = await create_order(save_fixture, product=product, customer=customer)

        repository = BenefitGrantRepository.from_session(session)
        retrieved_grant = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, subscription=other_subscription, order=order
        )
        assert retrieved_grant is None

    async def test_existing_grant_correct_scope(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        await save_fixture(grant)

        repository = BenefitGrantRepository.from_session(session)
        retrieved_grant = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, subscription=subscription
        )
        assert retrieved_grant is not None
        assert retrieved_grant.id == grant.id

    async def test_grant_with_member_found(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
    ) -> None:
        """Test that grant with member is found when querying with same member."""
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=member,
        )
        await save_fixture(grant)

        repository = BenefitGrantRepository.from_session(session)
        retrieved_grant = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, member=member, subscription=subscription
        )
        assert retrieved_grant is not None
        assert retrieved_grant.id == grant.id
        assert retrieved_grant.member_id == member.id

    async def test_grant_with_member_not_found_when_querying_without_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
    ) -> None:
        """Test that grant with member is NOT found when querying without member."""
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=member,
        )
        await save_fixture(grant)

        repository = BenefitGrantRepository.from_session(session)
        # Query without member - should not find grant with member_id set
        retrieved_grant = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, subscription=subscription
        )
        assert retrieved_grant is None

    async def test_grant_without_member_not_found_when_querying_with_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
    ) -> None:
        """Test that grant without member is NOT found when querying with member."""
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        # Grant without member
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=None,
        )
        await save_fixture(grant)

        repository = BenefitGrantRepository.from_session(session)
        # Query with member - should not find grant without member_id
        retrieved_grant = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, member=member, subscription=subscription
        )
        assert retrieved_grant is None

    async def test_different_members_create_separate_grants(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        organization: Organization,
    ) -> None:
        """Test that different members with different customers can have separate grants.

        In B2B scenarios, each seat holder (member) is typically the same customer (billing).
        This test verifies that the repository correctly queries by member.
        """
        customer = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )

        member1 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member 1",
            role=MemberRole.member,
        )
        await save_fixture(member1)

        member2 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member 2",
            role=MemberRole.member,
        )
        await save_fixture(member2)

        grant1 = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=member1,
        )
        await save_fixture(grant1)

        grant2 = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=member2,
        )
        await save_fixture(grant2)

        repository = BenefitGrantRepository.from_session(session)

        retrieved_grant1 = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, member=member1, subscription=subscription
        )
        assert retrieved_grant1 is not None
        assert retrieved_grant1.id == grant1.id

        retrieved_grant2 = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, member=member2, subscription=subscription
        )
        assert retrieved_grant2 is not None
        assert retrieved_grant2.id == grant2.id


@pytest.mark.anyio
class TestGrantBenefitWithMember:
    """Tests for grant_benefit with member support."""

    async def test_grant_with_member(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """Test granting benefit with a member creates grant with member_id."""
        benefit_strategy_mock.grant.return_value = {"external_id": "abc"}

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        grant = await benefit_grant_service.grant_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member,
            subscription=subscription,
        )

        assert grant.member_id == member.id
        assert grant.customer_id == customer.id
        assert grant.is_granted
        benefit_strategy_mock.grant.assert_called_once()

    async def test_grant_updates_existing_member_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """Test that granting to same member updates existing grant."""
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        # Create existing grant for this member
        existing_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=member,
        )
        await save_fixture(existing_grant)

        # Grant again with same member
        updated_grant = await benefit_grant_service.grant_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member,
            subscription=subscription,
        )

        assert updated_grant.id == existing_grant.id
        assert updated_grant.member_id == member.id
        assert updated_grant.is_granted

    async def test_grant_different_members_with_different_customers_creates_separate_grants(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        organization: Organization,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """Test that granting to different members creates separate grants.

        In B2B scenarios, each seat holder (member) belongs to the same customer.
        """
        customer = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )

        member1 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member 1",
            role=MemberRole.member,
        )
        await save_fixture(member1)

        member2 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member 2",
            role=MemberRole.member,
        )
        await save_fixture(member2)

        grant1 = await benefit_grant_service.grant_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member1,
            subscription=subscription,
        )

        grant2 = await benefit_grant_service.grant_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member2,
            subscription=subscription,
        )

        assert grant1.id != grant2.id
        assert grant1.member_id == member1.id
        assert grant2.member_id == member2.id
        assert grant1.customer_id == customer.id
        assert grant2.customer_id == customer.id


@pytest.mark.anyio
class TestRevokeBenefitWithMember:
    """Tests for revoke_benefit with member support."""

    @pytest.mark.parametrize("same_member", [False, True])
    async def test_revocation_preserves_only_the_same_recipient(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        subscription: Subscription,
        member_owner: Member,
        member_second: Member,
        benefit_strategy_mock: MagicMock,
        same_member: bool,
    ) -> None:
        purchase = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
            member=member_owner,
        )
        manual = BenefitGrant(
            customer=customer,
            benefit=benefit_organization,
            member=member_owner if same_member else member_second,
            manually_granted_at=utc_now(),
            manually_revoked_at=utc_now(),
        )
        manual.set_granted()
        await save_fixture(manual)

        await benefit_grant_service.revoke_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=manual.member,
            grant=manual,
        )

        assert manual.is_revoked
        assert purchase.is_granted
        assert benefit_strategy_mock.revoke.await_count == (0 if same_member else 1)
        if not same_member:
            assert (
                benefit_strategy_mock.revoke.call_args.kwargs["member"] == member_second
            )

    async def test_revoke_with_member(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """Test revoking benefit for a specific member."""
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        existing_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member=member,
        )
        existing_grant.set_granted()
        await save_fixture(existing_grant)

        revoked_grant = await benefit_grant_service.revoke_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member,
            subscription=subscription,
        )

        assert revoked_grant.id == existing_grant.id
        assert revoked_grant.member_id == member.id
        assert revoked_grant.is_revoked
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_revoke_specific_member_does_not_affect_others(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        subscription: Subscription,
        benefit_organization: Benefit,
        member_owner: Member,
        member_second: Member,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        target = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            member=member_owner,
            subscription=subscription,
        )
        other = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            member=member_second,
            subscription=subscription,
        )

        await benefit_grant_service.revoke_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member_owner,
            subscription=subscription,
        )

        assert target.is_revoked
        assert other.is_granted
        benefit_strategy_mock.revoke.assert_awaited_once_with(
            benefit_organization, customer, {}, attempt=1, member=member_owner
        )
