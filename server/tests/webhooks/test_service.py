from typing import cast

import pytest
from fastapi.exceptions import RequestValidationError

from polar.auth.exceptions import MissingScope
from polar.auth.scope import Scope
from polar.authz.service import Authz
from polar.exceptions import NotPermitted
from polar.models import Organization, User, UserOrganization, WebhookEndpoint
from polar.postgres import AsyncSession
from polar.webhook.schemas import HttpsUrl, WebhookEndpointCreate, WebhookEndpointUpdate
from polar.webhook.service import webhook as webhook_service
from tests.fixtures.auth import get_auth_subject
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


webhook_url = cast(HttpsUrl, "https://example.com/hook")


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreateEndpoint:
    async def test_user_no_organization_id_missing_scope(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=set())
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[]
        )

        with pytest.raises(MissingScope):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    @pytest.mark.parametrize(
        "scopes",
        [
            {Scope.web_default},
            {Scope.backer_webhooks_write},
        ],
    )
    async def test_user_no_organization_id_valid(
        self, scopes: set[Scope], session: AsyncSession, authz: Authz, user: User
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=scopes)
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[]
        )

        endpoint = await webhook_service.create_endpoint(
            session, authz, auth_subject, create_schema
        )
        assert endpoint.user_id == user.id
        assert endpoint.organization_id is None

    async def test_user_organization_id_missing_scope(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=set())
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[], organization_id=organization.id
        )

        with pytest.raises(MissingScope):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    async def test_user_organization_id_not_admin(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes={Scope.creator_webhooks_write})
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[], organization_id=organization.id
        )

        with pytest.raises(NotPermitted):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    @pytest.mark.parametrize(
        "scopes",
        [
            {Scope.web_default},
            {Scope.creator_webhooks_write},
        ],
    )
    async def test_user_organization_id_valid(
        self,
        scopes: set[Scope],
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=scopes)
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[], organization_id=organization.id
        )

        endpoint = await webhook_service.create_endpoint(
            session, authz, auth_subject, create_schema
        )
        assert endpoint.user_id is None
        assert endpoint.organization_id == organization.id

    async def test_organization_missing_scope(
        self, session: AsyncSession, authz: Authz, organization: Organization
    ) -> None:
        auth_subject = get_auth_subject(organization, scopes=set())
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[]
        )

        with pytest.raises(MissingScope):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    async def test_organization_set_organization_id(
        self, session: AsyncSession, authz: Authz, organization: Organization
    ) -> None:
        auth_subject = get_auth_subject(
            organization, scopes={Scope.creator_webhooks_write}
        )
        create_schema = WebhookEndpointCreate(
            url=webhook_url, secret="SECRET", events=[], organization_id=organization.id
        )

        with pytest.raises(RequestValidationError):
            await webhook_service.create_endpoint(
                session, authz, auth_subject, create_schema
            )

    async def test_organization_valid(
        self, session: AsyncSession, authz: Authz, organization: Organization
    ) -> None:
        auth_subject = get_auth_subject(
            organization, scopes={Scope.creator_webhooks_write}
        )
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
    async def test_user_user_endpoint_missing_scope(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        webhook_endpoint_user: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=set())
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(MissingScope):
            await webhook_service.update_endpoint(
                session,
                authz,
                auth_subject,
                endpoint=webhook_endpoint_user,
                update_schema=update_schema,
            )

    @pytest.mark.parametrize(
        "scopes",
        [
            {Scope.web_default},
            {Scope.backer_webhooks_write},
        ],
    )
    async def test_user_user_endpoint_valid(
        self,
        scopes: set[Scope],
        session: AsyncSession,
        authz: Authz,
        user: User,
        webhook_endpoint_user: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=scopes)
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        updated_endpoint = await webhook_service.update_endpoint(
            session,
            authz,
            auth_subject,
            endpoint=webhook_endpoint_user,
            update_schema=update_schema,
        )
        assert updated_endpoint.secret == "UPDATED_SECRET"

    async def test_user_organization_endpoint_missing_scope(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=set())
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(MissingScope):
            await webhook_service.update_endpoint(
                session,
                authz,
                auth_subject,
                endpoint=webhook_endpoint_organization,
                update_schema=update_schema,
            )

    async def test_user_organization_endpoint_not_admin(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes={Scope.creator_webhooks_write})
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(NotPermitted):
            await webhook_service.update_endpoint(
                session,
                authz,
                auth_subject,
                endpoint=webhook_endpoint_organization,
                update_schema=update_schema,
            )

    @pytest.mark.parametrize(
        "scopes",
        [
            {Scope.web_default},
            {Scope.creator_webhooks_write},
        ],
    )
    async def test_user_organization_endpoint_valid(
        self,
        scopes: set[Scope],
        session: AsyncSession,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=scopes)
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        updated_endpoint = await webhook_service.update_endpoint(
            session,
            authz,
            auth_subject,
            endpoint=webhook_endpoint_organization,
            update_schema=update_schema,
        )
        assert updated_endpoint.secret == "UPDATED_SECRET"

    async def test_organization_endpoint_missing_scope(
        self,
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(organization, scopes=set())
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(MissingScope):
            await webhook_service.update_endpoint(
                session,
                authz,
                auth_subject,
                endpoint=webhook_endpoint_organization,
                update_schema=update_schema,
            )

    async def test_organization_endpoint_not_admin(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        other_organization = await create_organization(save_fixture)
        auth_subject = get_auth_subject(other_organization, scopes=set())
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(NotPermitted):
            await webhook_service.update_endpoint(
                session,
                authz,
                auth_subject,
                endpoint=webhook_endpoint_organization,
                update_schema=update_schema,
            )

    async def test_organization_endpoint_valid(
        self,
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(
            organization, scopes={Scope.creator_webhooks_write}
        )
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
    async def test_user_user_endpoint_missing_scope(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        webhook_endpoint_user: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=set())
        update_schema = WebhookEndpointUpdate(secret="UPDATED_SECRET")

        with pytest.raises(MissingScope):
            await webhook_service.delete_endpoint(
                session, authz, auth_subject, webhook_endpoint_user
            )

    @pytest.mark.parametrize(
        "scopes",
        [
            {Scope.web_default},
            {Scope.backer_webhooks_write},
        ],
    )
    async def test_user_user_endpoint_valid(
        self,
        scopes: set[Scope],
        session: AsyncSession,
        authz: Authz,
        user: User,
        webhook_endpoint_user: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=scopes)

        deleted_endpoint = await webhook_service.delete_endpoint(
            session, authz, auth_subject, webhook_endpoint_user
        )
        assert deleted_endpoint.deleted_at is not None

    async def test_user_organization_endpoint_missing_scope(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=set())

        with pytest.raises(MissingScope):
            await webhook_service.delete_endpoint(
                session, authz, auth_subject, webhook_endpoint_organization
            )

    async def test_user_organization_endpoint_not_admin(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes={Scope.creator_webhooks_write})

        with pytest.raises(NotPermitted):
            await webhook_service.delete_endpoint(
                session, authz, auth_subject, webhook_endpoint_organization
            )

    @pytest.mark.parametrize(
        "scopes",
        [
            {Scope.web_default},
            {Scope.creator_webhooks_write},
        ],
    )
    async def test_user_organization_endpoint_valid(
        self,
        scopes: set[Scope],
        session: AsyncSession,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(user, scopes=scopes)

        deleted_endpoint = await webhook_service.delete_endpoint(
            session, authz, auth_subject, webhook_endpoint_organization
        )
        assert deleted_endpoint.deleted_at is not None

    async def test_organization_endpoint_missing_scope(
        self,
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(organization, scopes=set())

        with pytest.raises(MissingScope):
            await webhook_service.delete_endpoint(
                session, authz, auth_subject, webhook_endpoint_organization
            )

    async def test_organization_endpoint_not_admin(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        other_organization = await create_organization(save_fixture)
        auth_subject = get_auth_subject(other_organization, scopes=set())

        with pytest.raises(NotPermitted):
            await webhook_service.delete_endpoint(
                session, authz, auth_subject, webhook_endpoint_organization
            )

    async def test_organization_endpoint_valid(
        self,
        session: AsyncSession,
        authz: Authz,
        organization: Organization,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        auth_subject = get_auth_subject(
            organization, scopes={Scope.creator_webhooks_write}
        )

        deleted_endpoint = await webhook_service.delete_endpoint(
            session, authz, auth_subject, webhook_endpoint_organization
        )
        assert deleted_endpoint.deleted_at is not None
