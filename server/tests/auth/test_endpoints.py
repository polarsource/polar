import base64
import secrets
import time
from collections.abc import AsyncIterator
from datetime import timedelta

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import TOTPEnrollment, User, UserSession
from polar.postgres import AsyncSession
from tests.fixtures.base import IsolatedSessionTestClient
from tests.fixtures.database import SaveFixture


def make_session_stale(auth_subject: AuthSubject[User]) -> None:
    assert isinstance(auth_subject.session, UserSession)
    auth_subject.session.created_at = (
        utc_now() - settings.USER_SESSION_FRESHNESS_TTL - timedelta(minutes=1)
    )


def make_session_beyond_step_up_grace(auth_subject: AuthSubject[User]) -> None:
    assert isinstance(auth_subject.session, UserSession)
    auth_subject.session.created_at = (
        utc_now()
        - settings.USER_SESSION_FRESHNESS_TTL
        - settings.USER_SESSION_STEP_UP_GRACE
        - timedelta(minutes=1)
    )


async def create_totp_enrollment(
    save_fixture: SaveFixture, user: User
) -> TOTPEnrollment:
    enrollment = TOTPEnrollment(
        enabled=True,
        secret=base64.b32encode(secrets.token_bytes(20)).decode(),
        algorithm="sha256",
        code_length=6,
        time_step=30,
        identity_id=user.id,
    )
    await save_fixture(enrollment)
    return enrollment


def generate_totp_code(enrollment: TOTPEnrollment) -> str:
    return enrollment.to_dataclass()._impl.generate(int(time.time())).decode()


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


@pytest_asyncio.fixture
async def step_up_client(
    app: FastAPI, session: AsyncSession
) -> AsyncIterator[httpx.AsyncClient]:
    # 127.0.0.1 keeps the session cookie non-Secure so httpx carries it over http
    async with IsolatedSessionTestClient(
        session=session,
        auto_expunge=False,
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1",
    ) as client:
        yield client


@pytest.mark.asyncio
class TestStepUp:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/step-up")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_no_second_factor(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/step-up")

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_beyond_grace(
        self,
        client: AsyncClient,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        await create_totp_enrollment(save_fixture, user)
        make_session_beyond_step_up_grace(auth_subject)

        response = await client.post("/v1/auth/step-up")

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth
    async def test_stale_session_within_grace(
        self,
        step_up_client: AsyncClient,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        enrollment = await create_totp_enrollment(save_fixture, user)
        make_session_stale(auth_subject)

        response = await step_up_client.post("/v1/auth/step-up")

        assert response.status_code == 201
        json = response.json()
        assert json["identity_id"] == str(user.id)
        assert {"type": "totp"} in json["available_factors"]

        response = await step_up_client.post(
            "/v1/auth/totp/verify", json={"code": generate_totp_code(enrollment)}
        )

        assert response.status_code == 200

        response = await step_up_client.post("/v1/auth/step-up/complete")

        assert response.status_code == 204
        assert isinstance(auth_subject.session, UserSession)
        last_authenticated_at = auth_subject.session.last_authenticated_at
        assert last_authenticated_at is not None
        assert utc_now() - last_authenticated_at < timedelta(seconds=5)

    @pytest.mark.auth
    async def test_complete_without_factor(
        self,
        step_up_client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        await create_totp_enrollment(save_fixture, user)

        response = await step_up_client.post("/v1/auth/step-up")

        assert response.status_code == 201

        response = await step_up_client.post("/v1/auth/step-up/complete")

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_complete_without_session(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/step-up/complete")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_step_up_session_cannot_login(
        self,
        step_up_client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        enrollment = await create_totp_enrollment(save_fixture, user)

        response = await step_up_client.post("/v1/auth/step-up")

        assert response.status_code == 201

        response = await step_up_client.post(
            "/v1/auth/totp/verify", json={"code": generate_totp_code(enrollment)}
        )

        assert response.status_code == 200

        response = await step_up_client.get("/v1/auth/complete")

        assert response.status_code == 303
        assert "error=" in response.headers["location"]


@pytest.mark.asyncio
class TestOAuthLinkAuthorize:
    @pytest.mark.auth
    async def test_stale_session(
        self, client: AsyncClient, auth_subject: AuthSubject[User]
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.get("/v1/auth/github/link/authorize")

        assert response.status_code == 303
        location = response.headers["location"]
        assert "error=" in location
        assert "type=oauth_link_error" in location
        assert "factor=github" in location
