import json
from uuid import uuid4

import pytest
import respx
from pytest_mock import MockerFixture

from polar.config import settings
from polar.integrations.resend.client import ResendAPIError
from polar.integrations.resend.service import UserDoesNotExist
from polar.integrations.resend.service import resend as resend_service
from polar.kit.utils import utc_now
from polar.models import Organization, User, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.anyio
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

    @pytest.mark.usefixtures("user_organization")
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

    @pytest.mark.usefixtures("user_organization")
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

    @pytest.mark.usefixtures("user_organization")
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

    @pytest.mark.usefixtures("user_organization")
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

        with pytest.raises(ResendAPIError):
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

    @pytest.mark.parametrize(
        ("status", "in_segment"),
        [
            (OrganizationStatus.CREATED, False),
            (OrganizationStatus.REVIEW, True),
            (OrganizationStatus.SNOOZED, True),
            (OrganizationStatus.OFFBOARDING, True),
            (OrganizationStatus.DENIED, False),
            (OrganizationStatus.BLOCKED, False),
        ],
    )
    async def test_organization_status(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
        status: OrganizationStatus,
        in_segment: bool,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        organization.status = status
        await save_fixture(organization)
        user.resend_id = "contact-id"
        respx_mock.get(path="/contacts/contact-id").respond(
            200, json={"id": "contact-id", "email": user.email, "unsubscribed": False}
        )
        add = respx_mock.post(
            path="/contacts/contact-id/segments/active-users"
        ).respond(200)
        remove = respx_mock.delete(
            path="/contacts/contact-id/segments/active-users"
        ).respond(200)

        user = await resend_service.sync_user(session, user.id)

        assert user.resend_id == "contact-id"
        assert add.called is in_segment
        assert remove.called is not in_segment

    @pytest.mark.parametrize("linked", [False, True])
    async def test_no_organization(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
        linked: bool,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        user.resend_id = "contact-id" if linked else None
        remove = respx_mock.delete(
            path="/contacts/contact-id/segments/active-users"
        ).respond(404)

        user = await resend_service.sync_user(session, user.id)

        assert user.resend_id == ("contact-id" if linked else None)
        assert remove.call_count == (1 if linked else 0)
        assert len(respx_mock.calls) == remove.call_count

    async def test_no_organization_email_change(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        previous_email = user.email
        user.email = "new@example.com"
        user.resend_id = "old-contact"
        respx_mock.get(path=f"/contacts/{previous_email}").respond(
            200,
            json={"id": "old-contact", "email": previous_email, "unsubscribed": True},
        )
        respx_mock.get(path="/contacts/new@example.com").respond(404)
        create = respx_mock.post(path="/contacts").respond(
            200, json={"id": "new-contact"}
        )
        remove = respx_mock.delete(
            path="/contacts/new-contact/segments/active-users"
        ).respond(404)
        delete = respx_mock.delete(path="/contacts/old-contact").respond(200)

        user = await resend_service.sync_user(
            session, user.id, previous_email=previous_email
        )

        assert user.resend_id == "new-contact"
        assert json.loads(create.calls.last.request.content) == {
            "email": "new@example.com",
            "unsubscribed": True,
        }
        assert remove.called
        assert delete.called

    async def test_no_organization_email_change_without_contact(
        self,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
        respx_mock: respx.MockRouter,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        previous_email = user.email
        user.email = "new@example.com"
        lookup = respx_mock.get(path=f"/contacts/{previous_email}").respond(404)

        user = await resend_service.sync_user(
            session, user.id, previous_email=previous_email
        )

        assert user.resend_id is None
        assert lookup.called
        assert len(respx_mock.calls) == 1

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

    @pytest.mark.usefixtures("user_organization")
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


@pytest.mark.anyio
class TestSyncOrganizationMembers:
    async def test_enqueues_members(
        self,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        user_organization_second: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        enqueue_job_mock = mocker.patch("polar.integrations.resend.service.enqueue_job")

        await resend_service.sync_organization_members(session, organization.id)

        assert {call.kwargs["user_id"] for call in enqueue_job_mock.call_args_list} == {
            user_organization.user_id,
            user_organization_second.user_id,
        }


class TestOnOrganizationStatusChanged:
    @pytest.mark.parametrize(
        ("previous_status", "status", "enqueued"),
        [
            (OrganizationStatus.CREATED, OrganizationStatus.REVIEW, True),
            (OrganizationStatus.ACTIVE, OrganizationStatus.DENIED, True),
            (OrganizationStatus.OFFBOARDING, OrganizationStatus.OFFBOARDED, True),
            (OrganizationStatus.REVIEW, OrganizationStatus.OFFBOARDING, False),
            (OrganizationStatus.ACTIVE, OrganizationStatus.REVIEW, False),
            (OrganizationStatus.REVIEW, OrganizationStatus.SNOOZED, False),
            (OrganizationStatus.DENIED, OrganizationStatus.CREATED, False),
        ],
    )
    def test_enqueues_on_crossing(
        self,
        mocker: MockerFixture,
        previous_status: OrganizationStatus,
        status: OrganizationStatus,
        enqueued: bool,
    ) -> None:
        mocker.patch.object(settings, "RESEND_ACTIVE_USERS_SEGMENT_ID", "active-users")
        enqueue_job_mock = mocker.patch("polar.integrations.resend.service.enqueue_job")
        organization_id = uuid4()

        resend_service.on_organization_status_changed(
            organization_id, previous_status, status
        )

        if enqueued:
            enqueue_job_mock.assert_called_once_with(
                "resend.sync_organization_members", organization_id=organization_id
            )
        else:
            enqueue_job_mock.assert_not_called()
