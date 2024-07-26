import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.github.service.secret_scanning import InvalidSignature


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestSecretScanning:
    @pytest.mark.parametrize(
        "headers",
        [
            {"Github-Public-Key-Identifier": "KEY_IDENTIFIER"},
            {"Github-Public-Key-Signature": "SIGNATURE"},
        ],
    )
    async def test_missing_headers(
        self, headers: dict[str, str], client: AsyncClient
    ) -> None:
        response = await client.post(
            "/v1/integrations/github/secret-scanning", headers=headers, json=[]
        )

        assert response.status_code == 422

    async def test_invalid_signature(
        self, client: AsyncClient, mocker: MockerFixture
    ) -> None:
        mocker.patch(
            "polar.integrations.github.service.secret_scanning.secret_scanning.verify_signature",
            side_effect=InvalidSignature("[]", "SIGNATURE", "KEY_IDENTIFIER"),
        )

        response = await client.post(
            "/v1/integrations/github/secret-scanning",
            headers={
                "Github-Public-Key-Identifier": "KEY_IDENTIFIER",
                "Github-Public-Key-Signature": "SIGNATURE",
            },
            json=[],
        )

        assert response.status_code == 403

    async def test_valid(self, client: AsyncClient, mocker: MockerFixture) -> None:
        mocker.patch(
            "polar.integrations.github.service.secret_scanning.secret_scanning.verify_signature",
            return_value=True,
        )
        mocker.patch(
            "polar.integrations.github.service.secret_scanning.secret_scanning.handle_alert",
            return_value=[],
        )

        response = await client.post(
            "/v1/integrations/github/secret-scanning",
            headers={
                "Github-Public-Key-Identifier": "KEY_IDENTIFIER",
                "Github-Public-Key-Signature": "SIGNATURE",
            },
            json=[],
        )

        assert response.status_code == 200
        assert response.json() == []
