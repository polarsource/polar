import pytest
from httpx import AsyncClient

from polar.auth.models import AuthSubject
from polar.models import User
from tests.fixtures.auth import make_session_stale


@pytest.mark.asyncio
class TestTOTPEnroll:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/totp")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_stale_session(
        self, client: AsyncClient, auth_subject: AuthSubject[User]
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.post("/v1/auth/totp")

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_fresh_session(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/totp")

        assert response.status_code == 201
        json = response.json()
        assert json["secret"]
        assert json["provisioning_uri"]


@pytest.mark.asyncio
class TestTOTPEnable:
    @pytest.mark.auth
    async def test_stale_session(
        self, client: AsyncClient, auth_subject: AuthSubject[User]
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.post("/v1/auth/totp/enable", json={"code": "123456"})

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_fresh_session_not_enrolled(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/totp/enable", json={"code": "123456"})

        assert response.status_code == 403
        assert response.json()["error"] != "SessionNotFreshError"


@pytest.mark.asyncio
class TestTOTPDelete:
    @pytest.mark.auth
    async def test_stale_session(
        self, client: AsyncClient, auth_subject: AuthSubject[User]
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.delete("/v1/auth/totp")

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_fresh_session_not_enrolled(self, client: AsyncClient) -> None:
        response = await client.delete("/v1/auth/totp")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestBackupCodesEnroll:
    @pytest.mark.auth
    async def test_stale_session(
        self, client: AsyncClient, auth_subject: AuthSubject[User]
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.post("/v1/auth/backup-codes")

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_fresh_session(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/backup-codes")

        assert response.status_code == 201
        assert len(response.json()["codes"]) > 0
