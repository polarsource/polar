import json
from uuid import uuid4

import pytest
import respx
from pytest_mock import MockerFixture

from polar.config import settings
from polar.integrations.resend.service import UserDoesNotExist
from polar.integrations.resend.service import resend as resend_service
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
        contact = {"id": "contact-id", "email": user.email, "unsubscribed": True}
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
        identifier = "contact-id" if linked else user.email
        respx_mock.get(path=f"/contacts/{identifier}").respond(
            200, json={"id": "contact-id", "email": user.email}
        )
        delete = respx_mock.delete(path="/contacts/contact-id").respond(404)

        user = await resend_service.sync_user(session, user.id)

        assert user.resend_id is None
        assert user.is_deleted
        assert delete.called

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
