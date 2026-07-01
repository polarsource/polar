import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.merchant_migration.repository import MerchantMigrationRepository
from polar.merchant_migration.service import merchant_migration as service
from polar.merchant_migration.stripe_oauth import StripeOAuthToken
from polar.models import (
    MerchantMigration,
    Organization,
    User,
    UserOrganization,
)
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


def _token(refresh_token: str = "rt_test") -> StripeOAuthToken:
    return StripeOAuthToken(
        access_token="rk_test",
        refresh_token=refresh_token,
        stripe_user_id="acct_test",
        scope="customer_read",
        livemode=True,
    )


@pytest.mark.asyncio
class TestCreateStripeAuthorizationUrl:
    @pytest.mark.auth
    async def test_creates_migration_and_reuses_ongoing(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch.object(settings, "STRIPE_APP_CLIENT_ID", "ca_test")
        mocker.patch.object(settings, "STRIPE_APP_CLIENT_LINK_ID", "chnlink_test")

        url = await service.create_stripe_authorization_url(
            session,
            auth_subject,
            organization_id=organization.id,
            redirect_uri="http://test/callback",
            return_to="http://test/return",
        )
        assert "chnlink_test" in url
        assert "ca_test" in url
        assert "state=" in url

        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_ongoing_by_source(
            organization.id, MerchantMigrationSourcePlatform.stripe
        )
        assert migration is not None
        assert migration.step == MerchantMigrationStep.source_setup

        await service.create_stripe_authorization_url(
            session,
            auth_subject,
            organization_id=organization.id,
            redirect_uri="http://test/callback",
            return_to="http://test/return",
        )
        statement = repository.get_base_statement().where(
            MerchantMigration.organization_id == organization.id
        )
        migrations = await repository.get_all(statement)
        assert len(migrations) == 1


@pytest.mark.asyncio
class TestCompleteStripeAuthorization:
    @pytest.mark.auth
    async def test_stores_encrypted_refresh_token(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch(
            "polar.merchant_migration.service.stripe_oauth.exchange_code",
            return_value=_token("rt_secret"),
        )
        migration = MerchantMigration(
            organization_id=organization.id,
            source_platform=MerchantMigrationSourcePlatform.stripe,
            step=MerchantMigrationStep.source_setup,
        )
        await save_fixture(migration)

        updated = await service.complete_stripe_authorization(
            session, auth_subject, migration_id=migration.id, code="ac_test"
        )

        credentials = updated.source_credentials
        assert credentials["stripe_user_id"] == "acct_test"
        assert credentials["livemode"] is True
        assert credentials["refresh_token_encrypted"] != "rt_secret"

        decrypted = await service.decrypt_stripe_refresh_token(updated)
        assert decrypted == "rt_secret"
