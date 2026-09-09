import json
from uuid import uuid4

import httpx
import pytest
import respx
from pytest_mock import MockerFixture

from polar.config import settings
from polar.integrations.resend.service import UserDoesNotExist
from polar.integrations.resend.service import resend as resend_service
from polar.kit.anonymization import anonymize_email_for_deletion
from polar.kit.utils import utc_now
from polar.models import User
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestSyncUser:
    async def test_disabled(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", None)
        user = await resend_service.sync_user(session, user.id)

        assert not respx_mock.calls
        assert user.resend_id is None

    @pytest.mark.parametrize("existing", [False, True])
    async def test_create_or_retrieve(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
        existing: bool,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        contact = {"id": "contact-id", "email": user.email, "unsubscribed": False}
        lookup = respx_mock.get(path=f"/contacts/{user.email}").respond(
            200 if existing else 404, json=contact if existing else None
        )
        if not existing:
            create = respx_mock.post(path="/contacts").respond(
                200, json={"id": "contact-id"}
            )
        segment = respx_mock.post(
            path="/contacts/contact-id/segments/active-users"
        ).respond(200)

        user = await resend_service.sync_user(session, user.id)

        assert user.resend_id == "contact-id"
        assert lookup.call_count == 1
        assert segment.called
        if not existing:
            assert json.loads(create.calls.last.request.content) == {
                "email": user.email,
                "unsubscribed": False,
            }

    @pytest.mark.parametrize("email", ["user@example.com", "USER@example.com"])
    async def test_reuses_linked_contact(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
        email: str,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        user.email = "user@example.com"
        user.resend_id = "contact-id"
        respx_mock.get(path="/contacts/contact-id").respond(
            200, json={"id": "contact-id", "email": email, "unsubscribed": True}
        )
        segment = respx_mock.post(
            path="/contacts/contact-id/segments/active-users"
        ).respond(200)

        user = await resend_service.sync_user(session, user.id)

        assert user.resend_id == "contact-id"
        assert segment.called
        assert len(respx_mock.calls) == 2

    @pytest.mark.parametrize("linked", [False, True])
    async def test_email_change(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
        linked: bool,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        previous_email = user.email
        user.email = "new@example.com"
        user.resend_id = "old-contact" if linked else None
        respx_mock.get(path=f"/contacts/{previous_email}").respond(
            200,
            json={"id": "old-contact", "email": previous_email, "unsubscribed": True},
        )
        respx_mock.get(path="/contacts/new@example.com").respond(404)
        create = respx_mock.post(path="/contacts").respond(
            200, json={"id": "new-contact"}
        )
        respx_mock.post(path="/contacts/new-contact/segments/active-users").respond(200)
        delete = respx_mock.delete(path="/contacts/old-contact").respond(200)

        user = await resend_service.sync_user(
            session, user.id, previous_email=previous_email
        )

        assert user.resend_id == "new-contact"
        assert json.loads(create.calls.last.request.content) == {
            "email": "new@example.com",
            "unsubscribed": True,
        }
        assert delete.called

    @pytest.mark.parametrize("failure_stage", ["create", "segment"])
    async def test_email_change_preserves_old_contact_on_failure(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
        failure_stage: str,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        delete = mocker.patch("polar.integrations.resend.service.client.delete_contact")
        previous_email = user.email
        user.email = "new@example.com"
        user.resend_id = "old-contact"
        respx_mock.get(path=f"/contacts/{previous_email}").respond(
            200,
            json={"id": "old-contact", "email": previous_email, "unsubscribed": True},
        )
        respx_mock.get(path="/contacts/new@example.com").respond(404)
        respx_mock.post(path="/contacts").respond(
            500 if failure_stage == "create" else 200, json={"id": "new-contact"}
        )
        if failure_stage == "segment":
            respx_mock.post(path="/contacts/new-contact/segments/active-users").respond(
                500
            )

        with pytest.raises(httpx.HTTPStatusError):
            await resend_service.sync_user(
                session, user.id, previous_email=previous_email
            )

        delete.assert_not_awaited()
        assert user.resend_id == "old-contact"

    @pytest.mark.parametrize("linked", [False, True])
    async def test_deleted_user(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
        linked: bool,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        user.resend_id = "contact-id" if linked else None
        user.deleted_at = utc_now()
        if linked:
            respx_mock.get(path="/contacts/contact-id").respond(
                200, json={"id": "contact-id", "email": user.email}
            )
        respx_mock.get(path=f"/contacts/{user.email}").respond(
            200, json={"id": "contact-id", "email": user.email}
        )
        delete = respx_mock.delete(path="/contacts/contact-id").respond(404)

        user = await resend_service.sync_user(session, user.id)

        assert user.resend_id is None
        assert user.is_deleted
        assert delete.call_count == 1

    @pytest.mark.parametrize("old_contact_exists", [False, True])
    async def test_deleted_user_with_unsaved_replacement_contact(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
        old_contact_exists: bool,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        user.resend_id = "old-contact"
        user.deleted_at = utc_now()
        user.email = "deleted@example.com"
        respx_mock.get(path="/contacts/old-contact").respond(
            200 if old_contact_exists else 404,
            json={"id": "old-contact", "email": "old@example.com"}
            if old_contact_exists
            else None,
        )
        respx_mock.get(path="/contacts/new@example.com").respond(
            200, json={"id": "new-contact", "email": "new@example.com"}
        )
        if old_contact_exists:
            delete_old = respx_mock.delete(path="/contacts/old-contact").respond(200)
        delete_new = respx_mock.delete(path="/contacts/new-contact").respond(200)

        user = await resend_service.sync_user(
            session, user.id, previous_email="new@example.com"
        )

        assert user.resend_id is None
        assert delete_new.call_count == 1
        if old_contact_exists:
            assert delete_old.call_count == 1

    async def test_deleted_user_preserves_contact_reused_by_active_user(
        self,
        session: AsyncSession,
        user: User,
        user_second: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
    ) -> None:
        # A soft-deleted user with no resend_id frees their email; an active
        # user reuses it and links their own contact. The deletion job must NOT
        # destroy the active user's contact.
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        freed_email = user.email
        user.resend_id = None
        user.deleted_at = utc_now()
        user.email = anonymize_email_for_deletion(freed_email, user.created_at)
        session.add(user)
        await session.flush()

        user_second.email = freed_email
        user_second.resend_id = "contact-B"
        session.add(user_second)
        await session.flush()

        respx_mock.get(path=f"/contacts/{freed_email}").respond(
            200, json={"id": "contact-B", "email": freed_email}
        )
        delete_b = respx_mock.delete(path="/contacts/contact-B").respond(200)

        user = await resend_service.sync_user(
            session, user.id, previous_email=freed_email
        )

        assert user.resend_id is None
        assert user.is_deleted
        assert delete_b.call_count == 0

    async def test_deleted_user_with_resend_id_preserves_contact_reused_by_active_user(
        self,
        session: AsyncSession,
        user: User,
        user_second: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
    ) -> None:
        # A soft-deleted user whose resend_id points at an older contact
        # (e.g. a crashed email-change left resend_id stale) still has
        # previous_email freed and reused by an active user. The deletion job
        # must delete the user's own resend_id contact but NOT the reuser's.
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        freed_email = user.email
        user.resend_id = "old-contact"
        user.deleted_at = utc_now()
        user.email = anonymize_email_for_deletion(freed_email, user.created_at)
        session.add(user)
        await session.flush()

        user_second.email = freed_email
        user_second.resend_id = "contact-B"
        session.add(user_second)
        await session.flush()

        respx_mock.get(path="/contacts/old-contact").respond(
            200, json={"id": "old-contact", "email": "old@example.com"}
        )
        respx_mock.get(path=f"/contacts/{freed_email}").respond(
            200, json={"id": "contact-B", "email": freed_email}
        )
        delete_old = respx_mock.delete(path="/contacts/old-contact").respond(200)
        delete_b = respx_mock.delete(path="/contacts/contact-B").respond(200)

        user = await resend_service.sync_user(
            session, user.id, previous_email=freed_email
        )

        assert user.resend_id is None
        assert delete_old.call_count == 1
        assert delete_b.call_count == 0

    async def test_deleted_user_preserves_contact_owned_by_blocked_user(
        self,
        session: AsyncSession,
        user: User,
        user_second: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
    ) -> None:
        # Blocking is not deletion: a blocked (but non-deleted) user's contact
        # at the freed email must not be swept up by another user's deletion.
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        freed_email = user.email
        user.resend_id = None
        user.deleted_at = utc_now()
        user.email = anonymize_email_for_deletion(freed_email, user.created_at)
        session.add(user)
        await session.flush()

        user_second.email = freed_email
        user_second.resend_id = "contact-B"
        user_second.blocked_at = utc_now()
        session.add(user_second)
        await session.flush()

        respx_mock.get(path=f"/contacts/{freed_email}").respond(
            200, json={"id": "contact-B", "email": freed_email}
        )
        delete_b = respx_mock.delete(path="/contacts/contact-B").respond(200)

        user = await resend_service.sync_user(
            session, user.id, previous_email=freed_email
        )

        assert user.resend_id is None
        assert delete_b.call_count == 0

    async def test_deleted_user_without_resend_id_deletes_unowned_orphan(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
    ) -> None:
        # An orphan contact at the freed email that no active user has claimed
        # (e.g. a crashed sync left it behind) is still cleaned up even when the
        # deleted user has no resend_id anchor.
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        freed_email = user.email
        user.resend_id = None
        user.deleted_at = utc_now()
        user.email = anonymize_email_for_deletion(freed_email, user.created_at)
        session.add(user)
        await session.flush()

        respx_mock.get(path=f"/contacts/{freed_email}").respond(
            200, json={"id": "orphan-contact", "email": freed_email}
        )
        delete_orphan = respx_mock.delete(path="/contacts/orphan-contact").respond(200)

        user = await resend_service.sync_user(
            session, user.id, previous_email=freed_email
        )

        assert user.resend_id is None
        assert delete_orphan.call_count == 1

    async def test_user_does_not_exist(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        user_id = uuid4()

        with pytest.raises(UserDoesNotExist, match=str(user_id)) as exc:
            await resend_service.sync_user(session, user_id)

        assert exc.value.status_code == 404
        assert not respx_mock.calls

    async def test_reuses_new_email_contact(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        user.resend_id = "new-contact"
        respx_mock.get(path="/contacts/old@example.com").respond(
            200,
            json={
                "id": "old-contact",
                "email": "old@example.com",
                "unsubscribed": True,
            },
        )
        respx_mock.get(path=f"/contacts/{user.email}").respond(
            200, json={"id": "new-contact", "email": user.email, "unsubscribed": False}
        )
        unsubscribe = respx_mock.patch(path="/contacts/new-contact").respond(200)
        respx_mock.post(path="/contacts/new-contact/segments/active-users").respond(200)
        delete = respx_mock.delete(path="/contacts/old-contact").respond(200)

        user = await resend_service.sync_user(
            session, user.id, previous_email="old@example.com"
        )

        assert user.resend_id == "new-contact"
        assert json.loads(unsubscribe.calls.last.request.content) == {
            "unsubscribed": True
        }
        assert delete.called
