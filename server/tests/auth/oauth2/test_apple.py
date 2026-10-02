from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from reauth.factors.oauth2.base import OAuth2Account

from polar.auth.oauth2.apple import AppleFactor


def apple_account() -> OAuth2Account:
    return OAuth2Account(
        provider="apple",
        account_id="apple-account",
        access_token="access-token",
        expires_at=None,
        refresh_token=None,
        refresh_token_expires_at=None,
        scope=[],
        id_token="id-token",
    )


@pytest.mark.asyncio
class TestGetEmailAndVerified:
    @pytest.mark.parametrize(
        ("email_verified", "expected"),
        [
            (True, True),
            ("true", True),
            (False, False),
            ("false", False),
            (None, False),
        ],
    )
    async def test_email_verified_claim(
        self, mocker: MockerFixture, email_verified: Any, expected: bool
    ) -> None:
        claims: dict[str, Any] = {"email": "jane@acme.com"}
        if email_verified is not None:
            claims["email_verified"] = email_verified
        mocker.patch.object(AppleFactor, "get_id_token_claims", return_value=claims)
        factor = AppleFactor(MagicMock(), MagicMock())

        assert await factor.get_email_and_verified(apple_account()) == (
            "jane@acme.com",
            expected,
        )
