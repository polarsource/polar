import contextlib
from collections.abc import AsyncIterator

import pytest
from pytest_mock import MockerFixture

from polar.external_event.repository import ExternalEventRepository
from polar.integrations.stripe.tasks import identity_verification_session_verified
from polar.models import User
from polar.models.external_event import ExternalEventSource, StripeEvent
from polar.models.user import IdentityVerificationStatus
from polar.postgres import AsyncSession
from polar.user.service import (
    IdentityVerificationForUnknownUser,
)
from polar.user.service import user as user_service
from tests.fixtures.database import SaveFixture

_identity_verification_session_verified = (
    identity_verification_session_verified.__wrapped__  # type: ignore[attr-defined]
)


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


@pytest.mark.asyncio
class TestIdentityVerificationSessionVerifiedTask:
    async def test_no_ops_and_marks_handled_for_deleted_user(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        """An in-flight `verified` transition arriving after the user was
        deleted completes without raising and `ExternalEvent.handled_at` is set
        — so `external_event_service.handle` sets `handled_at` (no retry,
        no dead-letter). The session was redacted at deletion, so the primary
        lookup finds nothing and the metadata-user_id fallback resolves the
        soft-deleted user and no-ops.
        """
        user.identity_verification_id = "vs_task_deleted"
        user.identity_verification_status = IdentityVerificationStatus.pending
        await save_fixture(user)

        mocker.patch(
            "polar.user.service.stripe_service.redact_verification_session",
            new_callable=mocker.AsyncMock,
        )

        # Delete the user (redacts the session, nulls the id, soft-deletes).
        assert (await user_service.request_deletion(session, user)).deleted is True

        # Build a synthetic Stripe webhook event for the now-redacted session.
        event = StripeEvent(
            task_name="stripe.webhook.identity.verification_session.verified",
            external_id="evt_test_verified",
            data={
                "id": "evt_test_verified",
                "object": "event",
                "type": "identity.verification_session.verified",
                "data": {
                    "object": {
                        "id": "vs_task_deleted",
                        "object": "identity.verification_session",
                        "status": "verified",
                        "metadata": {"user_id": str(user.id)},
                    }
                },
            },
        )
        await save_fixture(event)

        # Run the actor against the test session so the event and user are visible.
        mocker.patch(
            "polar.integrations.stripe.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        # Must not raise.
        await _identity_verification_session_verified(event.id)

        # handled_at must be set (no retry/dead-letter).
        repository = ExternalEventRepository.from_session(session)
        handled_event = await repository.get_by_source_and_id(
            ExternalEventSource.stripe, event.id
        )
        assert handled_event is not None
        assert handled_event.handled_at is not None

    async def test_unattributable_session_raises_and_leaves_handled_at_unset(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        """G6: a genuinely unattributable session (no matching user, no metadata)
        still raises inside the actor. `handle` re-raises so handled_at stays
        unset — the retry/dead-letter safety signal for misrouted webhooks is
        preserved by the fix, NOT swallowed.
        """
        event = StripeEvent(
            task_name="stripe.webhook.identity.verification_session.verified",
            external_id="evt_test_unknown",
            data={
                "id": "evt_test_unknown",
                "object": "event",
                "type": "identity.verification_session.verified",
                "data": {
                    "object": {
                        "id": "vs_no_such_user",
                        "object": "identity.verification_session",
                        "status": "verified",
                    }
                },
            },
        )
        await save_fixture(event)

        mocker.patch(
            "polar.integrations.stripe.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        with pytest.raises(IdentityVerificationForUnknownUser):
            await _identity_verification_session_verified(event.id)

        repository = ExternalEventRepository.from_session(session)
        unhandled_event = await repository.get_by_source_and_id(
            ExternalEventSource.stripe, event.id
        )
        assert unhandled_event is not None
        assert unhandled_event.handled_at is None
