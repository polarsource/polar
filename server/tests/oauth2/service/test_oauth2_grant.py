from uuid import uuid4

import pytest
from sqlalchemy import func, select

from polar.kit.db.postgres import Session
from polar.models import Account, OAuth2Grant, Organization, User
from polar.oauth2.service.oauth2_grant import oauth2_grant as oauth2_grant_service
from polar.oauth2.sub_type import SubType


def _add_user(session: Session) -> User:
    user = User(email=f"{uuid4()}@example.com", email_verified=True)
    session.add(user)
    session.flush()
    return user


def _add_organization(session: Session) -> Organization:
    account = Account(currency="usd")
    session.add(account)
    session.flush()
    name = f"org{uuid4().hex[:8]}"
    organization = Organization(
        name=name,
        slug=name,
        customer_invoice_prefix=name.upper(),
        account=account,
    )
    session.add(organization)
    session.flush()
    return organization


@pytest.mark.asyncio
class TestCreateOrUpdateGrant:
    async def test_inserts_user_grant(self, sync_session: Session) -> None:
        user = _add_user(sync_session)

        grant = oauth2_grant_service.create_or_update_grant(
            sync_session,
            sub_type=SubType.user,
            sub_id=user.id,
            client_id="polar_ci_user",
            scope="openid",
        )

        assert grant.user_id == user.id
        assert grant.organization_id is None
        assert grant.scope == "openid"

    async def test_updates_user_grant_instead_of_raising(
        self, sync_session: Session
    ) -> None:
        user = _add_user(sync_session)
        created = oauth2_grant_service.create_or_update_grant(
            sync_session,
            sub_type=SubType.user,
            sub_id=user.id,
            client_id="polar_ci_user",
            scope="openid",
        )

        updated = oauth2_grant_service.create_or_update_grant(
            sync_session,
            sub_type=SubType.user,
            sub_id=user.id,
            client_id="polar_ci_user",
            scope="openid email",
        )

        assert updated.id == created.id
        assert updated.scope == "openid email"
        count = sync_session.scalar(
            select(func.count())
            .select_from(OAuth2Grant)
            .where(
                OAuth2Grant.client_id == "polar_ci_user", OAuth2Grant.user_id == user.id
            )
        )
        assert count == 1

    async def test_updates_organization_grant_instead_of_raising(
        self, sync_session: Session
    ) -> None:
        organization = _add_organization(sync_session)
        created = oauth2_grant_service.create_or_update_grant(
            sync_session,
            sub_type=SubType.organization,
            sub_id=organization.id,
            client_id="polar_ci_org",
            scope="openid",
        )

        updated = oauth2_grant_service.create_or_update_grant(
            sync_session,
            sub_type=SubType.organization,
            sub_id=organization.id,
            client_id="polar_ci_org",
            scope="openid profile",
        )

        assert updated.id == created.id
        assert updated.organization_id == organization.id
        assert updated.user_id is None
        assert updated.scope == "openid profile"
        count = sync_session.scalar(
            select(func.count())
            .select_from(OAuth2Grant)
            .where(
                OAuth2Grant.client_id == "polar_ci_org",
                OAuth2Grant.organization_id == organization.id,
            )
        )
        assert count == 1
