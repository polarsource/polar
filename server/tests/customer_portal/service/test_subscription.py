import asyncio
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import delete
from sqlalchemy.exc import DBAPIError

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_portal.schemas.subscription import (
    CustomerSubscriptionChangePreviewProduct,
    CustomerSubscriptionPause,
    CustomerSubscriptionResume,
    CustomerSubscriptionUpdateClear,
    CustomerSubscriptionUpdateProduct,
    CustomerSubscriptionUpdateSeats,
)
from polar.customer_portal.service.subscription import (
    PauseResumeNotAllowed,
    PaymentMethodRequired,
    UpdateSubscriptionPlanNotAllowed,
    UpdateSubscriptionSeatsNotAllowed,
)
from polar.customer_portal.service.subscription import (
    customer_subscription as customer_subscription_service,
)
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.exceptions import PolarRequestValidationError
from polar.kit.db.locking import is_lock_not_available_error
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_engine,
    create_async_sessionmaker,
)
from polar.kit.pagination import PaginationParams
from polar.models import (
    Account,
    Customer,
    Organization,
    PaymentMethod,
    Product,
    ProductPriceFixed,
    Subscription,
    User,
)
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.payment_method.repository import PaymentMethodRepository
from polar.payment_method.service import (
    PaymentMethodInUseByActiveSubscription,
)
from polar.payment_method.service import (
    payment_method as payment_method_service,
)
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import AlreadyCanceledSubscription
from polar.subscription.service import subscription as subscription_service
from polar.subscription.update import generate_subscription_update
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import (
    SaveFixture,
    get_database_url,
    save_fixture_factory,
)
from tests.fixtures.random_objects import (
    create_account,
    create_active_subscription,
    create_customer,
    create_organization,
    create_payment_method,
    create_product,
    create_subscription,
    create_user,
)


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_valid(
        self,
        auth_subject: AuthSubject[Customer],
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        customer_second: Customer,
        product: Product,
        product_second: Product,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1, tzinfo=UTC),
            ended_at=datetime(2023, 6, 15, tzinfo=UTC),
        )
        await create_active_subscription(
            save_fixture,
            product=product_second,
            customer=customer,
            started_at=datetime(2023, 1, 1, tzinfo=UTC),
            ended_at=datetime(2023, 6, 15, tzinfo=UTC),
        )
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer_second,
            started_at=datetime(2023, 1, 1, tzinfo=UTC),
            ended_at=datetime(2023, 6, 15, tzinfo=UTC),
        )

        results, count = await customer_subscription_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 2
        assert count == 2

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_filters_by_product_name(
        self,
        auth_subject: AuthSubject[Customer],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        from polar.enums import SubscriptionRecurringInterval

        product_match = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Premium Subscription",
        )
        product_no_match = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Basic Plan",
        )
        await create_active_subscription(
            save_fixture,
            product=product_match,
            customer=customer,
            started_at=datetime(2023, 1, 1, tzinfo=UTC),
            ended_at=datetime(2023, 6, 15, tzinfo=UTC),
        )
        await create_active_subscription(
            save_fixture,
            product=product_no_match,
            customer=customer,
            started_at=datetime(2023, 1, 1, tzinfo=UTC),
            ended_at=datetime(2023, 6, 15, tzinfo=UTC),
        )

        results, count = await customer_subscription_service.list(
            session, auth_subject, query="Premium", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert results[0].product.name == "Premium Subscription"

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_escapes_percent_character(
        self,
        auth_subject: AuthSubject[Customer],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Test that % in query is treated as literal, not wildcard."""
        from polar.enums import SubscriptionRecurringInterval

        product_with_percent = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="50% Off Subscription",
        )
        product_without_percent = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Half Price Subscription",
        )
        await create_active_subscription(
            save_fixture,
            product=product_with_percent,
            customer=customer,
            started_at=datetime(2023, 1, 1, tzinfo=UTC),
            ended_at=datetime(2023, 6, 15, tzinfo=UTC),
        )
        await create_active_subscription(
            save_fixture,
            product=product_without_percent,
            customer=customer,
            started_at=datetime(2023, 1, 1, tzinfo=UTC),
            ended_at=datetime(2023, 6, 15, tzinfo=UTC),
        )

        results, count = await customer_subscription_service.list(
            session, auth_subject, query="50%", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert results[0].product.name == "50% Off Subscription"

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_escapes_underscore_character(
        self,
        auth_subject: AuthSubject[Customer],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Test that _ in query is treated as literal, not single-char wildcard."""
        from polar.enums import SubscriptionRecurringInterval

        product_with_underscore = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Pro_Plan",
        )
        product_without_underscore = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="ProXPlan",
        )
        await create_active_subscription(
            save_fixture,
            product=product_with_underscore,
            customer=customer,
            started_at=datetime(2023, 1, 1, tzinfo=UTC),
            ended_at=datetime(2023, 6, 15, tzinfo=UTC),
        )
        await create_active_subscription(
            save_fixture,
            product=product_without_underscore,
            customer=customer,
            started_at=datetime(2023, 1, 1, tzinfo=UTC),
            ended_at=datetime(2023, 6, 15, tzinfo=UTC),
        )

        results, count = await customer_subscription_service.list(
            session, auth_subject, query="Pro_Plan", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert results[0].product.name == "Pro_Plan"


@pytest.mark.asyncio
class TestUpdate:
    async def test_not_existing_product(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionUpdateProduct(product_id=uuid.uuid4()),
            )

    async def test_not_recurring_product(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        subscription: Subscription,
    ) -> None:
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        with pytest.raises(PolarRequestValidationError):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionUpdateProduct(product_id=product.id),
            )

    async def test_extraneous_tier(
        self,
        session: AsyncSession,
        subscription: Subscription,
        product_organization_second: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionUpdateProduct(
                    product_id=product_organization_second.id
                ),
            )

    async def test_update_not_allowed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        product_second: Product,
        organization: Organization,
    ) -> None:
        organization.customer_portal_settings = {
            **organization.customer_portal_settings,
            "subscription": {
                "update_seats": False,
                "update_plan": False,
            },
        }
        await save_fixture(organization)

        with pytest.raises(UpdateSubscriptionPlanNotAllowed):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionUpdateProduct(product_id=product_second.id),
            )

        with pytest.raises(UpdateSubscriptionSeatsNotAllowed):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionUpdateSeats(seats=100),
            )

    async def test_preview_change_not_allowed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        product_second: Product,
        organization: Organization,
    ) -> None:
        organization.customer_portal_settings = {
            **organization.customer_portal_settings,
            "subscription": {"update_seats": False, "update_plan": False},
        }
        await save_fixture(organization)

        with pytest.raises(UpdateSubscriptionPlanNotAllowed):
            await customer_subscription_service.preview_change(
                session,
                subscription,
                change=CustomerSubscriptionChangePreviewProduct(
                    product_id=product_second.id
                ),
            )

    @pytest.mark.keep_session_state
    async def test_valid(
        self,
        session: AsyncSession,
        subscription: Subscription,
        product: Product,
        product_second: Product,
    ) -> None:
        new_price = product_second.prices[0]
        updated_subscription = await customer_subscription_service.update(
            session,
            subscription,
            updates=CustomerSubscriptionUpdateProduct(product_id=product_second.id),
        )

        assert isinstance(new_price, ProductPriceFixed)
        assert updated_subscription.product == product_second
        assert updated_subscription.prices == product_second.prices
        assert updated_subscription.amount == new_price.price_amount
        assert (
            updated_subscription.recurring_interval == product_second.recurring_interval
        )


@pytest.mark.asyncio
class TestCancel:
    @pytest.mark.auth
    async def test_already_canceled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
        )

        with pytest.raises(AlreadyCanceledSubscription):
            await customer_subscription_service.cancel(session, subscription)

    @pytest.mark.auth
    async def test_cancel_at_period_end(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription.cancel_at_period_end = True
        await save_fixture(subscription)

        with pytest.raises(AlreadyCanceledSubscription):
            await customer_subscription_service.cancel(session, subscription)

    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        updated_subscription = await customer_subscription_service.cancel(
            session,
            subscription,
            reason=CustomerCancellationReason.too_complex,
            comment="So many settings",
        )

        assert updated_subscription.id == subscription.id
        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.ended_at is None
        assert updated_subscription.cancel_at_period_end
        assert updated_subscription.ends_at == updated_subscription.current_period_end


@pytest.mark.asyncio
class TestClearPendingUpdate:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_clear_pending_product_update(
        self,
        auth_subject: AuthSubject[Customer],
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        product_second: Product,
    ) -> None:

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription_update, _ = generate_subscription_update(
            subscription,
            SubscriptionProrationBehavior.next_period,
            product=product_second,
        )
        await save_fixture(subscription_update)
        subscription.pending_update = subscription_update
        await save_fixture(subscription)

        updates = CustomerSubscriptionUpdateClear(pending_update=None)
        updated = await customer_subscription_service.update(
            session, subscription, updates=updates
        )
        await save_fixture(updated)

        assert updated.pending_update is None

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_clear_pending_update_no_pending(
        self,
        auth_subject: AuthSubject[Customer],
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        updates = CustomerSubscriptionUpdateClear(pending_update=None)

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await customer_subscription_service.update(
                session, subscription, updates=updates
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["type"] == "value_error"
        assert errors[0]["loc"] == ("body", "pending_update")
        assert "no pending update" in errors[0]["msg"]


@pytest.mark.asyncio
class TestUpdatePause:
    async def test_pause_not_allowed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        with pytest.raises(PauseResumeNotAllowed):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionPause(pause_at_period_end=True),
            )

    async def test_pause_allowed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        organization.customer_portal_settings = {
            **organization.customer_portal_settings,
            "subscription": {
                **organization.customer_portal_settings["subscription"],
                "pause": True,
            },
        }
        await save_fixture(organization)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        updated = await customer_subscription_service.update(
            session,
            subscription,
            updates=CustomerSubscriptionPause(pause_at_period_end=True),
        )

        assert updated.pause_at_period_end is True

    async def test_resume_not_allowed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
        )

        with pytest.raises(PauseResumeNotAllowed):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionResume(resume=True),
            )

    async def test_resume_without_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        organization.customer_portal_settings = {
            **organization.customer_portal_settings,
            "subscription": {
                **organization.customer_portal_settings["subscription"],
                "pause": True,
            },
        }
        await save_fixture(organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
        )

        with pytest.raises(PaymentMethodRequired):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionResume(resume=True),
            )

    async def test_resume_free_subscription_without_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product_recurring_free_price: Product,
        customer: Customer,
    ) -> None:
        organization.customer_portal_settings = {
            **organization.customer_portal_settings,
            "subscription": {
                **organization.customer_portal_settings["subscription"],
                "pause": True,
            },
        }
        await save_fixture(organization)
        subscription = await create_subscription(
            save_fixture,
            product=product_recurring_free_price,
            customer=customer,
            status=SubscriptionStatus.paused,
        )

        updated = await customer_subscription_service.update(
            session,
            subscription,
            updates=CustomerSubscriptionResume(resume=True),
        )

        assert updated.status == SubscriptionStatus.active

    async def test_resume_without_payment_method_renewals_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        organization.customer_portal_settings = {
            **organization.customer_portal_settings,
            "subscription": {
                **organization.customer_portal_settings["subscription"],
                "pause": True,
            },
        }
        organization.capabilities = {
            **organization.capabilities,
            "subscription_renewals": False,
        }
        await save_fixture(organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
        )

        updated = await customer_subscription_service.update(
            session,
            subscription,
            updates=CustomerSubscriptionResume(resume=True),
        )

        assert updated.status == SubscriptionStatus.paused

    async def test_resume_allowed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        organization.customer_portal_settings = {
            **organization.customer_portal_settings,
            "subscription": {
                **organization.customer_portal_settings["subscription"],
                "pause": True,
            },
        }
        await save_fixture(organization)
        await create_payment_method(save_fixture, customer)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
        )

        updated = await customer_subscription_service.update(
            session,
            subscription,
            updates=CustomerSubscriptionResume(resume=True),
        )

        assert updated.status == SubscriptionStatus.active


@pytest.mark.asyncio
class TestUncancel:
    async def test_with_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer)
        customer.default_payment_method = payment_method
        await save_fixture(customer)

        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            cancel_at_period_end=True,
        )

        updated = await customer_subscription_service.uncancel(session, subscription)

        assert updated.cancel_at_period_end is False
        assert updated.ends_at is None
        assert updated.canceled_at is None
        assert updated.customer_cancellation_reason is None
        assert updated.customer_cancellation_comment is None

    async def test_with_direct_payment_method_on_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            cancel_at_period_end=True,
            payment_method=payment_method,
        )

        updated = await customer_subscription_service.uncancel(session, subscription)

        assert updated.cancel_at_period_end is False

    async def test_without_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            cancel_at_period_end=True,
        )

        with pytest.raises(PaymentMethodRequired):
            await customer_subscription_service.uncancel(session, subscription)

    async def test_free_subscription_without_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        free_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(None, "usd")],
        )
        subscription = await create_subscription(
            save_fixture,
            product=free_product,
            customer=customer,
            status=SubscriptionStatus.active,
            cancel_at_period_end=True,
        )

        updated = await customer_subscription_service.uncancel(session, subscription)

        assert updated.cancel_at_period_end is False

    async def test_with_soft_deleted_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer)
        customer.default_payment_method = payment_method
        await save_fixture(customer)

        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            cancel_at_period_end=True,
        )

        # Soft-delete the payment method: clear customer default first, then
        # mark the PM as deleted, flushing each step to avoid circular deps.
        customer.default_payment_method = None
        await save_fixture(customer)
        payment_method.deleted_at = datetime.now(UTC)
        await save_fixture(payment_method)

        with pytest.raises(PaymentMethodRequired):
            await customer_subscription_service.uncancel(session, subscription)


class _UncancelSpyInterrupt(Exception):
    """Raised by the spy to halt uncancel after verifying the Customer lock."""


async def _attempt_uncancel_verify_lock(
    sessionmaker: AsyncSessionMaker,
    subscription_id: uuid.UUID,
    customer_id: uuid.UUID,
    lock_verified: asyncio.Event,
) -> None:
    """Load a subscription with FOR UPDATE (as the endpoint does) and call
    ``uncancel``. A spy on the inner ``subscription_service.uncancel`` verifies
    that the Customer row is FOR UPDATE locked by the time the payment-method
    check has completed — i.e. the check runs inside the serialization boundary.
    """

    async with sessionmaker() as session:
        repository = SubscriptionRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .options(*repository.get_eager_options())
            .where(Subscription.id == subscription_id)
            .with_for_update(of=Subscription)
        )
        subscription = await repository.get_one_or_none(statement)
        assert subscription is not None

        async def _spy(
            session: AsyncSession, ctx: object, sub: Subscription
        ) -> Subscription:
            async with sessionmaker() as probe_session:
                customer_repo = CustomerRepository.from_session(probe_session)
                try:
                    await customer_repo.get_by_id(
                        customer_id, for_update=True, nowait=True
                    )
                except DBAPIError as e:
                    if not is_lock_not_available_error(e):
                        raise
                else:
                    raise AssertionError("Customer row was not locked during uncancel")
            lock_verified.set()
            raise _UncancelSpyInterrupt

        with patch.object(subscription_service, "uncancel", _spy):
            try:
                await customer_subscription_service.uncancel(session, subscription)
            except _UncancelSpyInterrupt:
                pass
        await session.rollback()


@pytest.mark.asyncio
class TestUncancelPaymentMethodLock:
    """Regression tests for the race condition where a payment method could be
    deleted between the payment-method check and the uncancel operation.

    The fix moves the check inside ``SubscriptionUpdateContext`` and acquires a
    FOR UPDATE lock on the Customer row. PostgreSQL row-level locks are
    table-specific, so the subscription row lock alone does not block a
    concurrent ``UPDATE Customer SET default_payment_method_id = None``.
    """

    async def test_uncancel_locks_customer_row(self, worker_id: str) -> None:
        """The uncancel flow holds a FOR UPDATE lock on the Customer row during
        the payment-method check, preventing a concurrent payment-method
        deletion from racing with the check."""
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_uncancel_lock",
            pool_size=8,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as setup_session:
            save_fixture = save_fixture_factory(setup_session)
            user = await create_user(save_fixture)
            account = await create_account(save_fixture, user)
            organization = await create_organization(save_fixture, account)
            product = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
            )
            customer = await create_customer(
                save_fixture,
                organization=organization,
                email="uncancel-lock@example.com",
            )
            payment_method = await create_payment_method(save_fixture, customer)
            customer.default_payment_method = payment_method
            await save_fixture(customer)
            subscription = await create_subscription(
                save_fixture,
                product=product,
                customer=customer,
                status=SubscriptionStatus.active,
                cancel_at_period_end=True,
            )
            await setup_session.commit()

        try:
            lock_verified = asyncio.Event()
            await _attempt_uncancel_verify_lock(
                sessionmaker, subscription.id, customer.id, lock_verified
            )
            assert lock_verified.is_set(), (
                "Spy was not invoked — Customer lock was not verified"
            )
        finally:
            async with sessionmaker() as cleanup_session:
                await cleanup_session.execute(
                    delete(Subscription).where(Subscription.id == subscription.id)
                )
                await cleanup_session.execute(
                    delete(PaymentMethod).where(PaymentMethod.id == payment_method.id)
                )
                await cleanup_session.execute(
                    delete(Customer).where(Customer.id == customer.id)
                )
                await cleanup_session.execute(
                    delete(Product).where(Product.id == product.id)
                )
                await cleanup_session.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Account).where(Account.id == account.id)
                )
                await cleanup_session.execute(delete(User).where(User.id == user.id))
                await cleanup_session.commit()
            await engine.dispose()

    async def test_concurrent_uncancel_and_payment_method_deletion(
        self, worker_id: str
    ) -> None:
        """Concurrent uncancel + payment-method deletion must not leave an
        active subscription without a payment method.

        Before the fix, the payment-method check ran outside the
        ``SubscriptionUpdateContext`` with no Customer lock, so the deletion
        could commit between the check and the uncancel update — leaving the
        subscription active with ``default_payment_method_id=None``.

        With the fix, the uncancel flow locks the Customer row (FOR UPDATE)
        inside the ``SubscriptionUpdateContext``. The two operations now
        serialize on the Customer lock: either the deletion commits first
        (uncancel sees no PM and raises ``PaymentMethodRequired``) or the
        uncancel commits first (deletion sees the PM still in use and raises
        ``PaymentMethodInUseByActiveSubscription``). Neither leaves an active
        subscription without a payment method.
        """
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_uncancel_race",
            pool_size=8,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as setup_session:
            save_fixture = save_fixture_factory(setup_session)
            user = await create_user(save_fixture)
            account = await create_account(save_fixture, user)
            organization = await create_organization(save_fixture, account)
            product = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
            )
            customer = await create_customer(
                save_fixture,
                organization=organization,
                email="uncancel-race@example.com",
            )
            payment_method = await create_payment_method(save_fixture, customer)
            customer.default_payment_method = payment_method
            await save_fixture(customer)
            subscription = await create_subscription(
                save_fixture,
                product=product,
                customer=customer,
                status=SubscriptionStatus.active,
                cancel_at_period_end=True,
            )
            await setup_session.commit()

        try:

            async def _attempt_uncancel(
                sessionmaker: AsyncSessionMaker,
                subscription_id: uuid.UUID,
            ) -> Subscription | None:
                async with sessionmaker() as session:
                    repository = SubscriptionRepository.from_session(session)
                    statement = (
                        repository.get_base_statement()
                        .options(*repository.get_eager_options())
                        .where(Subscription.id == subscription_id)
                        .with_for_update(of=Subscription)
                    )
                    subscription = await repository.get_one_or_none(statement)
                    assert subscription is not None
                    try:
                        result = await customer_subscription_service.uncancel(
                            session, subscription
                        )
                    except PaymentMethodRequired:
                        await session.rollback()
                        return None
                    await session.commit()
                    return result

            async def _attempt_delete_payment_method(
                sessionmaker: AsyncSessionMaker,
                payment_method_id: uuid.UUID,
            ) -> bool:
                async with sessionmaker() as session:
                    pm_repository = PaymentMethodRepository.from_session(session)
                    pm = await pm_repository.get_by_id(payment_method_id)
                    assert pm is not None
                    try:
                        await payment_method_service.delete(session, pm, force=True)
                    except PaymentMethodInUseByActiveSubscription:
                        await session.rollback()
                        return False
                    await session.commit()
                    return True

            with (
                patch("polar.payment_method.service.stripe_service") as mock_stripe,
                patch("polar.subscription.service.enqueue_job"),
                patch("polar.customer.repository.enqueue_job"),
                patch("polar.webhook.service.enqueue_job"),
                patch("polar.event.service.enqueue_events"),
                patch("polar.subscription.service.event_service") as mock_event,
                patch("polar.subscription.service.webhook_service.send"),
            ):
                mock_stripe.delete_payment_method = AsyncMock()
                mock_event.create_event = AsyncMock()
                uncancel_result, delete_result = await asyncio.gather(
                    _attempt_uncancel(sessionmaker, subscription.id),
                    _attempt_delete_payment_method(sessionmaker, payment_method.id),
                )

            # Invariant: exactly one of the two operations must have succeeded.
            # They serialize on the Customer lock, so both cannot succeed in a
            # way that leaves an active subscription without a payment method.
            uncancel_succeeded = uncancel_result is not None
            delete_succeeded = delete_result

            # After the dust settles, check the final DB state.
            async with sessionmaker() as verify_session:
                repo = SubscriptionRepository.from_session(verify_session)
                sub = await repo.get_by_id(subscription.id)
                assert sub is not None
                customer_repo = CustomerRepository.from_session(verify_session)
                fresh_customer = await customer_repo.get_by_id(customer.id)
                assert fresh_customer is not None

                if uncancel_succeeded:
                    # Uncancel won the race: subscription is active, not
                    # canceled. The payment method may or may not have been
                    # deleted, but the subscription must still have a payment
                    # method available (either on the sub or customer default).
                    assert sub.cancel_at_period_end is False
                    has_pm = (
                        sub.payment_method_id is not None
                        or fresh_customer.default_payment_method_id is not None
                    )
                    assert has_pm, (
                        "Uncancel succeeded but subscription has no payment "
                        "method — the race condition was NOT fixed"
                    )
                else:
                    # Deletion won the race: uncancel correctly failed with
                    # PaymentMethodRequired because it saw no payment method.
                    assert delete_succeeded, (
                        "Neither uncancel nor delete succeeded — unexpected"
                    )

        finally:
            async with sessionmaker() as cleanup_session:
                from sqlalchemy import text

                # Delete events by both customer_id and organization_id
                # (some events may have customer_id=NULL)
                await cleanup_session.execute(
                    text(
                        "DELETE FROM events WHERE organization_id = :oid "
                        "OR customer_id = :cid"
                    ),
                    {"oid": str(organization.id), "cid": str(customer.id)},
                )
                await cleanup_session.execute(
                    delete(Subscription).where(Subscription.id == subscription.id)
                )
                await cleanup_session.execute(
                    delete(PaymentMethod).where(PaymentMethod.id == payment_method.id)
                )
                await cleanup_session.execute(
                    delete(Customer).where(Customer.id == customer.id)
                )
                await cleanup_session.execute(
                    delete(Product).where(Product.id == product.id)
                )
                await cleanup_session.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Account).where(Account.id == account.id)
                )
                await cleanup_session.execute(delete(User).where(User.id == user.id))
                await cleanup_session.commit()
            await engine.dispose()
