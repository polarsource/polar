import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from polar.exceptions import ResourceNotFound
from polar.models import Organization, VoidEvent, VoidProduct, VoidSubscription
from polar.postgres import AsyncSession
from polar.void.entitlement.repository import EntitlementRepository
from polar.void.entitlement.schemas import EntitlementCreate, EntitlementUpdate
from polar.void.entitlement.service import EntitlementAssignmentConflict
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import event as event_service
from polar.void.identity.schemas import IdentityCreate
from polar.void.identity.service import identity as identity_service
from polar.void.product.schemas import ProductCreate
from polar.void.product.service import product as product_service
from polar.void.reducer.service import reducer as reducer_service
from polar.void.subscription import service as subscription_module
from polar.void.subscription.schemas import SubscriptionCreate
from polar.void.subscription.service import SubscriptionConflict, SubscriptionInvalid
from polar.void.subscription.service import subscription as subscription_service

JAN = datetime(2026, 1, 1, tzinfo=UTC)
NOW = datetime(2026, 1, 20, tzinfo=UTC)
FEB = datetime(2026, 2, 1, tzinfo=UTC)


@pytest_asyncio.fixture
async def product(session: AsyncSession, organization: Organization) -> VoidProduct:
    root, _ = await identity_service.ensure(
        session, organization, IdentityCreate(external_id="root")
    )
    await identity_service.ensure(
        session,
        organization,
        IdentityCreate(external_id="child", parent_external_id=root.external_id),
    )
    feature, _ = await entitlement_service.upsert(
        session, organization.id, EntitlementCreate(slug="support")
    )
    return await product_service.create(
        session,
        organization.id,
        ProductCreate.model_validate(
            {
                "slug": "pro",
                "name": "Pro",
                "price": {
                    "type": "recurring",
                    "amount": "49",
                    "currency": "usd",
                    "interval": "month",
                },
                "entitlement_ids": [feature.id],
            }
        ),
    )


@pytest.mark.asyncio
class TestLifecycle:
    async def test_create_cancel_revoke_and_rebuild(
        self,
        session: AsyncSession,
        organization: Organization,
        product: VoidProduct,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(subscription_module, "utc_now", lambda: NOW)
        subscription = await subscription_service.create(
            session,
            organization.id,
            SubscriptionCreate(
                product_id=product.id, external_identity_id="root", starts_at=JAN
            ),
        )
        sid = subscription.id
        assert (
            await subscription_service.held(session, organization.id, "child", NOW)
        ).slugs == ["support"]
        canceled = await subscription_service.cancel(
            session, organization.id, sid, True
        )
        assert canceled.ends_at == FEB
        assert (
            await subscription_service.held(session, organization.id, "child", NOW)
        ).slugs == ["support"]
        revoked = await subscription_service.revoke(session, organization.id, sid)
        assert revoked.ends_at == NOW
        assert (
            await subscription_service.held(session, organization.id, "child", NOW)
        ).slugs == []
        assert (
            await subscription_service.rebuild(session, organization.id, apply=False)
        ).unchanged == 1
        await session.execute(
            delete(VoidSubscription).where(VoidSubscription.id == sid)
        )
        result = await subscription_service.rebuild(session, organization.id)
        assert result.created == 1
        restored = await subscription_service.get(session, organization.id, sid)
        assert (
            restored.status,
            restored.started_at,
            restored.canceled_at,
            restored.ends_at,
        ) == ("revoked", JAN, NOW, NOW)
        assert (
            await subscription_service.rebuild(session, organization.id)
        ).unchanged == 1

    async def test_conflicts_and_tenant_scope(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        product: VoidProduct,
    ) -> None:
        create = SubscriptionCreate(product_id=product.id, external_identity_id="root")
        item = await subscription_service.create(session, organization.id, create)
        with pytest.raises(SubscriptionConflict):
            await subscription_service.create(session, organization.id, create)
        with pytest.raises(SubscriptionInvalid, match="root identity"):
            await subscription_service.create(
                session,
                organization.id,
                create.model_copy(update={"external_identity_id": "child"}),
            )
        with pytest.raises(ResourceNotFound):
            await subscription_service.get(session, organization_second.id, item.id)
        with pytest.raises(ResourceNotFound):
            await subscription_service.revoke(session, organization_second.id, item.id)
        assert await subscription_service.list(session, organization_second.id) == []
        assert (
            await subscription_service.rebuild(session, organization_second.id)
        ).subscriptions == 0

    async def test_import_history_and_rebuild_dry_run(
        self,
        session: AsyncSession,
        organization: Organization,
        product: VoidProduct,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(subscription_module, "utc_now", lambda: NOW)
        end = JAN + timedelta(days=10)
        item = await subscription_service.create(
            session,
            organization.id,
            SubscriptionCreate(
                product_id=product.id,
                external_identity_id="root",
                starts_at=JAN,
                ends_at=end,
            ),
        )
        item.ends_at = JAN + timedelta(days=12)
        await session.flush()
        result = await subscription_service.rebuild(
            session, organization.id, apply=False
        )
        assert result.updated == 1
        assert item.ends_at == JAN + timedelta(days=12)
        await subscription_service.rebuild(session, organization.id)
        assert item.ends_at == end
        assert (
            await subscription_service.held(session, organization.id, "child", JAN)
        ).slugs == ["support"]
        assert (
            await subscription_service.held(session, organization.id, "child", end)
        ).slugs == []

    async def test_rebuild_ignores_user_product_events(
        self,
        session: AsyncSession,
        organization: Organization,
        product: VoidProduct,
    ) -> None:
        await event_service.ingest(
            session,
            organization.id,
            [
                EventCreate(
                    name="product.subscription.created",
                    external_id="spoof",
                    external_identity_id="root",
                    metadata={},
                )
            ],
            EventSource.user,
        )
        assert (
            await subscription_service.rebuild(session, organization.id)
        ).subscriptions == 0


@pytest.mark.asyncio
class TestAssignments:
    async def test_idempotency_and_event_ownership(
        self,
        session: AsyncSession,
        organization: Organization,
        product: VoidProduct,
    ) -> None:
        first = await entitlement_service.assign(
            session,
            organization.id,
            "child",
            EntitlementUpdate(external_id="assignment", features=[]),
        )
        replay = await entitlement_service.assign(
            session,
            organization.id,
            "child",
            EntitlementUpdate(external_id="assignment", features=["support"]),
        )
        assert first == replay
        assert replay.features == []
        events = (
            await session.scalars(
                select(VoidEvent).where(VoidEvent.organization_id == organization.id)
            )
        ).all()
        assert len(events) == 1
        assert json.loads(events[0].payload["metadata"]) == {
            "features": [],
            "meters": None,
        }
        with pytest.raises(EntitlementAssignmentConflict):
            await entitlement_service.assign(
                session,
                organization.id,
                "root",
                EntitlementUpdate(external_id="assignment"),
            )
        assert await entitlement_service.assignments(session, organization.id) == {}

    async def test_assignment_projection_narrows_ancestor_grants(
        self,
        session: AsyncSession,
        organization: Organization,
        product: VoidProduct,
    ) -> None:
        await subscription_service.create(
            session,
            organization.id,
            SubscriptionCreate(product_id=product.id, external_identity_id="root"),
        )
        await entitlement_service.assign(
            session,
            organization.id,
            "child",
            EntitlementUpdate(external_id="deny", features=[]),
        )
        reducer = await EntitlementRepository.from_session(session).assignment_reducer(
            organization.id
        )
        assert reducer is not None
        await reducer_service.write_buckets(
            session,
            [
                {
                    "organization_id": organization.id,
                    "reducer_id": reducer.id,
                    "external_identity_id": "child",
                    "external_root_id": "root",
                    "bucket_start": JAN,
                    "value": None,
                    "data": {"features": [], "meters": None},
                    "last_processed_event": None,
                }
            ],
        )
        assert (
            await subscription_service.held(session, organization.id, "root")
        ).slugs == ["support"]
        denied = await subscription_service.held(session, organization.id, "child")
        assert denied.slugs == []
        assert denied.assignments["child"].features == []
        assert denied.assignments["root"].features is None


@pytest.mark.asyncio
class TestLifecycleEventCollisions:
    @pytest.mark.parametrize("action", ["canceled", "revoked"])
    async def test_conflict_rolls_back_partial_batch_and_projection(
        self,
        session: AsyncSession,
        organization: Organization,
        product: VoidProduct,
        action: str,
    ) -> None:
        subscription = await subscription_service.create(
            session,
            organization.id,
            SubscriptionCreate(product_id=product.id, external_identity_id="root"),
        )
        sid = subscription.id
        organization_id = organization.id
        external_id = f"product.subscription:{sid}:{action}"
        await event_service.ingest(
            session,
            organization_id,
            [EventCreate(name="merchant.event", external_id=external_id)],
            EventSource.user,
        )
        before = set(
            (
                await session.scalars(
                    select(VoidEvent.id).where(
                        VoidEvent.organization_id == organization_id
                    )
                )
            ).all()
        )
        with pytest.raises(SubscriptionConflict, match="event ID"):
            async with session.begin_nested():
                if action == "canceled":
                    await subscription_service.cancel(
                        session, organization_id, sid, True
                    )
                else:
                    await subscription_service.revoke(session, organization_id, sid)
        restored = await subscription_service.get(session, organization_id, sid)
        assert restored.status == "active"
        assert restored.ends_at is None
        assert (
            set(
                (
                    await session.scalars(
                        select(VoidEvent.id).where(
                            VoidEvent.organization_id == organization_id
                        )
                    )
                ).all()
            )
            == before
        )
        assert (
            await subscription_service.rebuild(session, organization_id, apply=False)
        ).unchanged == 1

    @pytest.mark.parametrize("owned", [True, False])
    async def test_assignment_checks_winner_after_preflight_race(
        self,
        session: AsyncSession,
        organization: Organization,
        product: VoidProduct,
        monkeypatch: pytest.MonkeyPatch,
        owned: bool,
    ) -> None:
        organization_id = organization.id
        await event_service.ingest(
            session,
            organization_id,
            [
                EventCreate(
                    name="identity.entitlements.updated" if owned else "merchant.event",
                    external_id="race",
                    external_identity_id="child",
                    metadata={"features": [], "meters": None},
                )
            ],
            EventSource.system if owned else EventSource.user,
        )
        lookup = EntitlementRepository.assignment_event
        first = True

        async def stale_preflight(
            self: EntitlementRepository, org_id: UUID, external_id: str
        ) -> VoidEvent | None:
            nonlocal first
            if first:
                first = False
                return None
            return await lookup(self, org_id, external_id)

        monkeypatch.setattr(EntitlementRepository, "assignment_event", stale_preflight)
        update = EntitlementUpdate(external_id="race", features=["support"])
        if owned:
            result = await entitlement_service.assign(
                session, organization_id, "child", update
            )
            assert result.features == []
        else:
            with pytest.raises(EntitlementAssignmentConflict):
                async with session.begin_nested():
                    await entitlement_service.assign(
                        session, organization_id, "child", update
                    )
            assert (
                await EntitlementRepository.from_session(session).assignment_reducer(
                    organization_id
                )
                is None
            )
        assert (
            len(
                (
                    await session.scalars(
                        select(VoidEvent).where(
                            VoidEvent.organization_id == organization_id
                        )
                    )
                ).all()
            )
            == 1
        )
