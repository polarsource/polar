import uuid
from typing import cast
from unittest.mock import MagicMock

import pytest
from fastapi.exceptions import RequestValidationError
from pytest_mock import MockerFixture

from polar.auth.exceptions import MissingScope
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.authz.service import Authz
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.models import (
    Organization,
    User,
    UserOrganization,
    WebhookEndpoint,
    WebhookEvent,
)
from polar.postgres import AsyncSession
from polar.webhook.schemas import HttpsUrl, WebhookEndpointCreate, WebhookEndpointUpdate
from polar.webhook.service import webhook as webhook_service
from tests.fixtures.auth import AuthSubjectFixture


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.webhook.service.enqueue_job")


webhook_url = cast(HttpsUrl, "https://example.com/hook")


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreateEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_no_organization_id_missing_scope(
        self, auth_subject: AuthSubject[User], session: AsyncSession, authz: Authz
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[]
        )

        with pytest.raises(MissingScope):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.backer_webhooks_write}),
    )
    async def test_user_no_organization_id_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user: User,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[]
        )

        endpoint = await webhook_service.create_endpoint(
            session, authz, auth_subject, create_schema
        )
        assert endpoint.user_id == user.id
        assert endpoint.organization_id is None

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_organization_id_missing_scope(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[], organization_id=organization.id
        )

        with pytest.raises(MissingScope):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.creator_webhooks_write}))
    async def test_user_organization_id_not_admin(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[], organization_id=organization.id
        )

        with pytest.raises(NotPermitted):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.creator_webhooks_write}),
    )
    async def test_user_organization_id_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[], organization_id=organization.id
        )

        endpoint = await webhook_service.create_endpoint(
            session, authz, auth_subject, create_schema
        )
        assert endpoint.user_id is None
        assert endpoint.organization_id == organization.id

    @pytest.mark.auth(AuthSubjectFixture(subject="organization", scopes=set()))
    async def test_organization_missing_scope(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[]
        )

        with pytest.raises(MissingScope):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_set_organization_id(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[], organization_id=uuid.uuid4()
        )

        with pytest.raises(RequestValidationError):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_valid(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[]
        )

        endpoint = await webhook_service.create_endpoint(
            session, authz, auth_subject, create_schema
        )
        assert endpoint.user_id is None
        assert endpoint.organization_id == organization.id


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestUpdateEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_user_endpoint_missing_scope(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user: User,
        webhook_endpoint_user: WebhookEndpoint,
    ) -> None:
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(MissingScope):
            await webhook_service.update_endpoint(
                session,
                authz,
                auth_subject,
                endpoint=webhook_endpoint_user,
                update_schema=update_schema,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.backer_webhooks_write}),
    )
    async def test_user_user_endpoint_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        webhook_endpoint_user: WebhookEndpoint,
    ) -> None:
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        updated_endpoint = await webhook_service.update_endpoint(
            session,
            authz,
            auth_subject,
            endpoint=webhook_endpoint_user,
            update_schema=update_schema,
        )
        assert updated_endpoint.secret == "UPDATED_SECRET"

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_organization_endpoint_missing_scope(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(MissingScope):
            await webhook_service.update_endpoint(
                session,
                authz,
                auth_subject,
                endpoint=webhook_endpoint_organization,
                update_schema=update_schema,
            )

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.creator_webhooks_write}))
    async def test_user_organization_endpoint_not_admin(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user: User,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(NotPermitted):
            await webhook_service.update_endpoint(
                session,
                authz,
                auth_subject,
                endpoint=webhook_endpoint_organization,
                update_schema=update_schema,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.creator_webhooks_write}),
    )
    async def test_user_organization_endpoint_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user_organization_admin: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        updated_endpoint = await webhook_service.update_endpoint(
            session,
            authz,
            auth_subject,
            endpoint=webhook_endpoint_organization,
            update_schema=update_schema,
        )
        assert updated_endpoint.secret == "UPDATED_SECRET"

    @pytest.mark.auth(AuthSubjectFixture(subject="organization", scopes=set()))
    async def test_organization_endpoint_missing_scope(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(MissingScope):
            await webhook_service.update_endpoint(
                session,
                authz,
                auth_subject,
                endpoint=webhook_endpoint_organization,
                update_schema=update_schema,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization_second", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_endpoint_not_admin(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(NotPermitted):
            await webhook_service.update_endpoint(
                session,
                authz,
                auth_subject,
                endpoint=webhook_endpoint_organization,
                update_schema=update_schema,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_endpoint_valid(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        updated_endpoint = await webhook_service.update_endpoint(
            session,
            authz,
            auth_subject,
            endpoint=webhook_endpoint_organization,
            update_schema=update_schema,
        )
        assert updated_endpoint.secret == "UPDATED_SECRET"


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestDeleteEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_user_endpoint_missing_scope(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        webhook_endpoint_user: WebhookEndpoint,
    ) -> None:
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(MissingScope):
            await webhook_service.delete_endpoint(
                session, authz, auth_subject, webhook_endpoint_user
            )

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.backer_webhooks_write}),
    )
    async def test_user_user_endpoint_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        webhook_endpoint_user: WebhookEndpoint,
    ) -> None:
        deleted_endpoint = await webhook_service.delete_endpoint(
            session, authz, auth_subject, webhook_endpoint_user
        )
        assert deleted_endpoint.deleted_at is not None

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_organization_endpoint_missing_scope(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user_organization_admin: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        with pytest.raises(MissingScope):
            await webhook_service.delete_endpoint(
                session, authz, auth_subject, webhook_endpoint_organization
            )

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.creator_webhooks_write}))
    async def test_user_organization_endpoint_not_admin(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        with pytest.raises(NotPermitted):
            await webhook_service.delete_endpoint(
                session, authz, auth_subject, webhook_endpoint_organization
            )

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.creator_webhooks_write}),
    )
    async def test_user_organization_endpoint_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user_organization_admin: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        deleted_endpoint = await webhook_service.delete_endpoint(
            session, authz, auth_subject, webhook_endpoint_organization
        )
        assert deleted_endpoint.deleted_at is not None

    @pytest.mark.auth(AuthSubjectFixture(subject="organization", scopes=set()))
    async def test_organization_endpoint_missing_scope(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        with pytest.raises(MissingScope):
            await webhook_service.delete_endpoint(
                session, authz, auth_subject, webhook_endpoint_organization
            )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization_second", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_endpoint_not_admin(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        with pytest.raises(NotPermitted):
            await webhook_service.delete_endpoint(
                session, authz, auth_subject, webhook_endpoint_organization
            )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_endpoint_valid(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        deleted_endpoint = await webhook_service.delete_endpoint(
            session, authz, auth_subject, webhook_endpoint_organization
        )
        assert deleted_endpoint.deleted_at is not None


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestRedeliverEvent:
    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_user_endpoint_missing_scope(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        webhook_event_user: WebhookEvent,
    ) -> None:
        with pytest.raises(MissingScope):
            await webhook_service.redeliver_event(
                session, authz, auth_subject, webhook_event_user.id
            )

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.backer_webhooks_write}),
    )
    async def test_user_user_endpoint_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        webhook_event_user: WebhookEvent,
        enqueue_job_mock: MagicMock,
    ) -> None:
        await webhook_service.redeliver_event(
            session, authz, auth_subject, webhook_event_user.id
        )
        enqueue_job_mock.assert_called_once()

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_user_organization_endpoint_missing_scope(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user_organization_admin: UserOrganization,
        webhook_event_organization: WebhookEvent,
    ) -> None:
        with pytest.raises(MissingScope):
            await webhook_service.redeliver_event(
                session, authz, auth_subject, webhook_event_organization.id
            )

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.creator_webhooks_write}))
    async def test_user_organization_endpoint_not_admin(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        webhook_event_organization: WebhookEvent,
    ) -> None:
        with pytest.raises(ResourceNotFound):
            await webhook_service.redeliver_event(
                session, authz, auth_subject, webhook_event_organization.id
            )

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.creator_webhooks_write}),
    )
    async def test_user_organization_endpoint_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user_organization_admin: UserOrganization,
        webhook_event_organization: WebhookEvent,
        enqueue_job_mock: MagicMock,
    ) -> None:
        await webhook_service.redeliver_event(
            session, authz, auth_subject, webhook_event_organization.id
        )
        enqueue_job_mock.assert_called_once()

    @pytest.mark.auth(AuthSubjectFixture(subject="organization", scopes=set()))
    async def test_organization_endpoint_missing_scope(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        webhook_event_organization: WebhookEvent,
    ) -> None:
        with pytest.raises(MissingScope):
            await webhook_service.redeliver_event(
                session, authz, auth_subject, webhook_event_organization.id
            )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization_second", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_endpoint_not_admin(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        webhook_event_organization: WebhookEvent,
    ) -> None:
        with pytest.raises(ResourceNotFound):
            await webhook_service.redeliver_event(
                session, authz, auth_subject, webhook_event_organization.id
            )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.creator_webhooks_write}
        )
    )
    async def test_organization_endpoint_valid(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        webhook_event_organization: WebhookEvent,
        enqueue_job_mock: MagicMock,
    ) -> None:
        await webhook_service.redeliver_event(
            session, authz, auth_subject, webhook_event_organization.id
        )
        enqueue_job_mock.assert_called_once()
