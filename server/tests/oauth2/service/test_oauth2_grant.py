from uuid import uuid4

import pytest
from sqlalchemy import func, select

from polar.kit.db.postgres import Session
from polar.models import OAuth2Grant, User
from polar.oauth2.service.oauth2_grant import oauth2_grant as oauth2_grant_service
from polar.oauth2.sub_type import SubType


@pytest.mark.asyncio
class TestCreateOrUpdateGrant:
    async def test_second_consent_updates_the_existing_grant(
        self, sync_session: Session
    ) -> None:
        user = User(email=f"{uuid4()}@example.com", email_verified=True)
        sync_session.add(user)
        sync_session.flush()

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
        assert updated.user_id == user.id
        assert updated.organization_id is None
        assert updated.scope == "openid email"
        count = sync_session.scalar(
            select(func.count())
            .select_from(OAuth2Grant)
            .where(
                OAuth2Grant.client_id == "polar_ci_user",
                OAuth2Grant.user_id == user.id,
            )
        )
        assert count == 1
