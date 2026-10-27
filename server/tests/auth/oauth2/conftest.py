import pytest
from reauth.factors.oauth2.base import OAuth2Account


@pytest.fixture
def oauth_account() -> OAuth2Account:
    return OAuth2Account(
        provider="google",
        account_id="account-id",
        access_token="access-token",
        expires_at=None,
        refresh_token=None,
        refresh_token_expires_at=None,
        scope=[],
    )
