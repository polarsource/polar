import pytest

from polar.models import Customer, Organization
from polar.models.customer import CustomerOAuthAccount, CustomerOAuthPlatform


@pytest.mark.anyio
class TestOAuthAccount:
    async def test_discord_tokens_round_trip_encrypted(
        self, organization: Organization
    ) -> None:
        customer = Customer(organization=organization, email="customer@example.com")
        customer._oauth_accounts = {}
        oauth_account = CustomerOAuthAccount(
            access_token="access",
            refresh_token="refresh",
            account_id="123",
        )

        await customer.set_oauth_account(oauth_account, CustomerOAuthPlatform.discord)

        stored = customer.oauth_accounts["discord:123"]
        assert stored["access_token_encrypted"] != "access"
        assert stored["refresh_token_encrypted"] != "refresh"
        assert (
            await customer.get_oauth_account("123", CustomerOAuthPlatform.discord)
            == oauth_account
        )

    async def test_github_tokens_not_encrypted(
        self, organization: Organization
    ) -> None:
        customer = Customer(organization=organization, email="customer@example.com")
        customer._oauth_accounts = {}

        await customer.set_oauth_account(
            CustomerOAuthAccount(access_token="access", account_id="123"),
            CustomerOAuthPlatform.github,
        )

        assert "access_token_encrypted" not in customer.oauth_accounts["github:123"]
