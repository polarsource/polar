import json
from uuid import uuid4

import httpx
import pytest
import respx
from pytest_mock import MockerFixture
from sqlalchemy import delete

from polar.config import settings
from polar.integrations.resend.service import UserDoesNotExist
from polar.integrations.resend.service import resend as resend_service
from polar.kit.db.postgres import create_async_engine, create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import User
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository
from polar.user.service import user as user_service
from tests.fixtures.database import get_database_url


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

    async def test_signup_after_deletion_reclaims_resend_id_without_collision(
        self,
        worker_id: str,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
    ) -> None:
        """End-to-end regression for the delete -> re-register race.

        A soft-deletes their account (freeing the email). B registers with the
        same email and their signup sync reuses the Resend contact that A's row
        used to point at. Before the fix, soft_delete_user left resend_id set on
        A's soft-deleted row until the LOW-priority deletion sync ran, so B's
        sync_user hit the users.resend_id unique constraint (IntegrityError).
        Now soft_delete_user clears resend_id synchronously, so B's sync commits
        the same contact id without conflict.

        Uses real commits across independent sessions, mirroring
        tests/license_key/test_service.py::TestConcurrentActivation.
        """
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        # Enqueuing the deletion sync is out of scope for this assertion; stub it
        # so soft_delete_user doesn't touch the broker.
        mocker.patch("polar.user.service.resend_service.enqueue_sync_user")
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_resend_race",
            pool_size=8,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)
        a_id = b_id = None
        try:
            async with sessionmaker() as setup:
                user_a = User(email="reused@example.com", oauth_accounts=[])
                user_a.resend_id = "contact-a"
                setup.add(user_a)
                await setup.commit()
                a_id = user_a.id

            # A deletes their account; resend_id is cleared in the same commit.
            async with sessionmaker() as session_a:
                repository = UserRepository.from_session(session_a)
                user_a_to_delete = await repository.get_by_id(
                    a_id, include_deleted=True
                )
                assert user_a_to_delete is not None
                await user_service.soft_delete_user(session_a, user_a_to_delete)
                await session_a.commit()

            async with sessionmaker() as check:
                a = await UserRepository.from_session(check).get_by_id(
                    a_id, include_deleted=True
                )
                assert a is not None
                assert a.resend_id is None
                assert a.is_deleted

            # B registers with the freed email.
            async with sessionmaker() as session_b:
                user_b = User(email="reused@example.com", oauth_accounts=[])
                session_b.add(user_b)
                await session_b.commit()
                b_id = user_b.id

            # B's signup sync reuses the Resend contact A used to own.
            respx_mock.get(path="/contacts/reused@example.com").respond(
                200,
                json={
                    "id": "contact-a",
                    "email": "reused@example.com",
                    "unsubscribed": False,
                },
            )
            respx_mock.post(path="/contacts/contact-a/segments/active-users").respond(
                200
            )

            async with sessionmaker() as session_b:
                await resend_service.sync_user(session_b, b_id)
                await session_b.commit()

            async with sessionmaker() as check:
                b = await UserRepository.from_session(check).get_by_id(b_id)
                assert b is not None
                assert b.resend_id == "contact-a"
        finally:
            if a_id is not None or b_id is not None:
                ids = [id_ for id_ in (a_id, b_id) if id_ is not None]
                async with sessionmaker() as cleanup:
                    await cleanup.execute(delete(User).where(User.id.in_(ids)))
                    await cleanup.commit()
            await engine.dispose()
