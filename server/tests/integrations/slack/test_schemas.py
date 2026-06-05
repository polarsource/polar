from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from polar.integrations.slack.schemas import (
    SlackIntegration,
    SlackIntegrationCredentialsUpdate,
)
from polar.models import SlackApp


class TestSlackIntegrationCredentialsUpdate:
    def test_accepts_numeric_dot_numeric_client_id(self) -> None:
        update = SlackIntegrationCredentialsUpdate(
            organization_id=uuid4(),
            display_name="Test",
            slack_app_id="A0TESTAPPID",
            client_id="100.200",
            client_secret="cs-test-secret",
            signing_secret="ss-test-secret",
        )

        assert update.client_id == "100.200"

    @pytest.mark.parametrize(
        "client_id",
        [
            "100",
            "100.",
            ".200",
            "100.200.300",
            "abc.200",
            "100.abc",
        ],
    )
    def test_rejects_malformed_client_id(self, client_id: str) -> None:
        with pytest.raises(ValidationError):
            SlackIntegrationCredentialsUpdate(
                organization_id=uuid4(),
                display_name="Test",
                slack_app_id="A0TESTAPPID",
                client_id=client_id,
                client_secret="cs-test-secret",
                signing_secret="ss-test-secret",
            )


class TestSlackIntegration:
    def test_computes_secret_suffixes_without_serializing_raw_secrets(self) -> None:
        slack_app = SlackApp(
            id=uuid4(),
            created_at=datetime.now(UTC),
            modified_at=None,
            organization_id=uuid4(),
            display_name="Test",
            slack_app_id="A0TESTAPPID",
            client_id="100.200",
            client_secret="cs-test-secret",
            signing_secret="ss-test-secret",
            team_id=None,
            team_name=None,
            bot_user_id=None,
            authed_user_id=None,
            scopes=None,
            installed_at=None,
            revoked_at=None,
        )

        integration = SlackIntegration.model_validate(slack_app)

        assert integration.client_id_last_4 == ".200"
        assert integration.client_secret_last_4 == "cret"
        assert integration.signing_secret_last_4 == "cret"

        dumped = integration.model_dump()
        assert "client_secret" not in dumped
        assert "signing_secret" not in dumped

    def test_normalizes_missing_display_fields(self) -> None:
        slack_app = SlackApp(
            id=uuid4(),
            created_at=datetime.now(UTC),
            modified_at=None,
            organization_id=uuid4(),
            display_name="Test",
            slack_app_id=None,
            client_id=None,
            client_secret=None,
            signing_secret=None,
            team_id=None,
            team_name=None,
            bot_user_id=None,
            authed_user_id=None,
            scopes=None,
            installed_at=None,
            revoked_at=None,
        )

        integration = SlackIntegration.model_validate(slack_app)

        assert integration.slack_app_id == ""
        assert integration.client_id == ""
        assert integration.client_id_last_4 == ""
        assert integration.client_secret_last_4 == ""
        assert integration.signing_secret_last_4 == ""
