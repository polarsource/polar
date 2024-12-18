import uuid
from typing import cast
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.authz.service import Authz
from polar.checkout.eventstream import CheckoutEvent
from polar.exceptions import NotPermitted, PolarRequestValidationError, ResourceNotFound
from polar.models import (
    Organization,
    Product,
    User,
    UserOrganization,
    WebhookEndpoint,
    WebhookEvent,
)
from polar.models.webhook_endpoint import WebhookFormat
from polar.postgres import AsyncSession
from polar.webhook.schemas import HttpsUrl, WebhookEndpointCreate, WebhookEndpointUpdate
from polar.webhook.service import EventDoesNotExist, EventNotSuccessul
from polar.webhook.service import webhook as webhook_service
from polar.webhook.webhooks import WebhookCheckoutUpdatedPayload
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.webhook.service.enqueue_job")


webhook_url = cast(HttpsUrl, "https://example.com/hook")


@pytest.mark.asyncio
class TestCreateEndpoint:
    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.web_default}))
    async def test_user_no_organization_id_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user: User,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url,
            format=WebhookFormat.raw,
            secret="SECRET",
            events=[],
            organization_id=None,
        )

        endpoint = await webhook_service.create_endpoint(
            session, authz, auth_subject, create_schema
        )
        assert endpoint.user_id == user.id
        assert endpoint.organization_id is None

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
    )
    async def test_user_organization_id_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url,
            format=WebhookFormat.raw,
            secret="SECRET",
            events=[],
            organization_id=organization.id,
        )

        endpoint = await webhook_service.create_endpoint(
            session, authz, auth_subject, create_schema
        )
        assert endpoint.user_id is None
        assert endpoint.organization_id == organization.id

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_set_organization_id(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url,
            format=WebhookFormat.raw,
            secret="SECRET",
            events=[],
            organization_id=uuid.uuid4(),
        )

        with pytest.raises(PolarRequestValidationError):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_valid(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url,
            format=WebhookFormat.raw,
            secret="SECRET",
            events=[],
            organization_id=None,
        )

        endpoint = await webhook_service.create_endpoint(
            session, authz, auth_subject, create_schema
        )
        assert endpoint.user_id is None
        assert endpoint.organization_id == organization.id


@pytest.mark.asyncio
class TestUpdateEndpoint:
    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
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

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.webhooks_write}))
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
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
    )
    async def test_user_organization_endpoint_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user_organization: UserOrganization,
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

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization_second", scopes={Scope.webhooks_write})
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
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
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
class TestDeleteEndpoint:
    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
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

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.webhooks_write}))
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
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
    )
    async def test_user_organization_endpoint_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user_organization: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        deleted_endpoint = await webhook_service.delete_endpoint(
            session, authz, auth_subject, webhook_endpoint_organization
        )
        assert deleted_endpoint.deleted_at is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization_second", scopes={Scope.webhooks_write})
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
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
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
class TestRedeliverEvent:
    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
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

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.webhooks_write}))
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
        AuthSubjectFixture(scopes={Scope.webhooks_write}),
    )
    async def test_user_organization_endpoint_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        user_organization: UserOrganization,
        webhook_event_organization: WebhookEvent,
        enqueue_job_mock: MagicMock,
    ) -> None:
        await webhook_service.redeliver_event(
            session, authz, auth_subject, webhook_event_organization.id
        )
        enqueue_job_mock.assert_called_once()

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization_second", scopes={Scope.webhooks_write})
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
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
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


@pytest.mark.asyncio
class TestOnEventSuccess:
    async def test_not_existing_event(self, session: AsyncSession) -> None:
        with pytest.raises(EventDoesNotExist):
            await webhook_service.on_event_success(session, uuid.uuid4())

    async def test_not_successful_event(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=False,
            payload="{}",
        )
        await save_fixture(event)

        with pytest.raises(EventNotSuccessul):
            await webhook_service.on_event_success(session, event.id)

    async def test_checkout_updated_event(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        product: Product,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        publish_checkout_event_mock = mocker.patch(
            "polar.webhook.service.publish_checkout_event"
        )
        checkout = await create_checkout(save_fixture, price=product.prices[0])
        event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=True,
            last_http_code=200,
            payload=WebhookCheckoutUpdatedPayload.model_validate(
                {"type": "checkout.updated", "data": checkout}
            ).model_dump_json(),
        )
        await save_fixture(event)

        await webhook_service.on_event_success(session, event.id)

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret,
            CheckoutEvent.webhook_event_delivered,
            {"status": checkout.status},
        )
