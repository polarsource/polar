import time
import uuid

import pytest
from httpx import AsyncClient
from reauth.crypto import get_token_hash
from sqlalchemy import select

from polar.config import settings
from polar.models import BackupCodesEnrollment, TOTPEnrollment, User
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
BACKUP_CODES = ["ABCDEFGH23", "JKLMNPQR45", "STUVWXYZ67"]


async def create_totp_enrollment(
    save_fixture: SaveFixture, user: User, *, enabled: bool = True
) -> TOTPEnrollment:
    enrollment = TOTPEnrollment(
        enabled=enabled,
        secret=TOTP_SECRET,
        algorithm="sha256",
        code_length=6,
        time_step=30,
        last_verified_time_step=None,
        identity_id=user.id,
    )
    await save_fixture(enrollment)
    return enrollment


def generate_totp_code(enrollment: TOTPEnrollment) -> str:
    return enrollment.to_dataclass()._impl.generate(int(time.time())).decode()


def invalid_totp_code(valid_code: str) -> str:
    return "000000" if valid_code != "000000" else "111111"


async def create_backup_codes_enrollment(
    save_fixture: SaveFixture,
    user: User,
    codes: list[str] = BACKUP_CODES,
    used_codes: list[str] = [],
) -> BackupCodesEnrollment:
    enrollment = BackupCodesEnrollment(
        codes_hashes=[get_token_hash(code, secret=settings.SECRET) for code in codes],
        used_codes_hashes=[
            get_token_hash(code, secret=settings.SECRET) for code in used_codes
        ],
        identity_id=user.id,
    )
    await save_fixture(enrollment)
    return enrollment


async def get_totp_enrollment(
    session: AsyncSession, user_id: uuid.UUID
) -> TOTPEnrollment | None:
    result = await session.execute(
        select(TOTPEnrollment).where(TOTPEnrollment.identity_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_backup_codes_enrollment(
    session: AsyncSession, user_id: uuid.UUID
) -> BackupCodesEnrollment | None:
    result = await session.execute(
        select(BackupCodesEnrollment).where(
            BackupCodesEnrollment.identity_id == user_id
        )
    )
    return result.scalar_one_or_none()


@pytest.mark.asyncio
class TestTOTPDelete:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.delete("/v1/auth/totp")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_enrolled(self, client: AsyncClient) -> None:
        response = await client.delete("/v1/auth/totp")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_enabled_without_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        await create_totp_enrollment(save_fixture, user)

        response = await client.delete("/v1/auth/totp")

        assert response.status_code == 403
        assert await get_totp_enrollment(session, user.id) is not None

    @pytest.mark.auth
    async def test_enabled_invalid_totp_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        enrollment = await create_totp_enrollment(save_fixture, user)
        code = invalid_totp_code(generate_totp_code(enrollment))

        response = await client.request("DELETE", "/v1/auth/totp", json={"code": code})

        assert response.status_code == 403
        assert await get_totp_enrollment(session, user.id) is not None

    @pytest.mark.auth
    async def test_enabled_valid_totp_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        enrollment = await create_totp_enrollment(save_fixture, user)
        await create_backup_codes_enrollment(save_fixture, user)
        code = generate_totp_code(enrollment)

        response = await client.request("DELETE", "/v1/auth/totp", json={"code": code})

        assert response.status_code == 204
        assert await get_totp_enrollment(session, user.id) is None
        assert await get_backup_codes_enrollment(session, user.id) is None

    @pytest.mark.auth
    async def test_enabled_valid_backup_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        await create_totp_enrollment(save_fixture, user)
        await create_backup_codes_enrollment(save_fixture, user)

        response = await client.request(
            "DELETE", "/v1/auth/totp", json={"code": BACKUP_CODES[0]}
        )

        assert response.status_code == 204
        assert await get_totp_enrollment(session, user.id) is None
        assert await get_backup_codes_enrollment(session, user.id) is None

    @pytest.mark.auth
    async def test_enabled_used_backup_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        await create_totp_enrollment(save_fixture, user)
        await create_backup_codes_enrollment(
            save_fixture, user, used_codes=[BACKUP_CODES[0]]
        )

        response = await client.request(
            "DELETE", "/v1/auth/totp", json={"code": BACKUP_CODES[0]}
        )

        assert response.status_code == 403
        assert await get_totp_enrollment(session, user.id) is not None

    @pytest.mark.auth
    async def test_disabled_without_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        await create_totp_enrollment(save_fixture, user, enabled=False)

        response = await client.delete("/v1/auth/totp")

        assert response.status_code == 204
        assert await get_totp_enrollment(session, user.id) is None


@pytest.mark.asyncio
class TestBackupCodesEnroll:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/backup-codes")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_no_totp_enrollment(self, client: AsyncClient) -> None:
        response = await client.post("/v1/auth/backup-codes")

        assert response.status_code == 201
        assert len(response.json()["codes"]) == 10

    @pytest.mark.auth
    async def test_disabled_totp_enrollment(
        self, client: AsyncClient, save_fixture: SaveFixture, user: User
    ) -> None:
        await create_totp_enrollment(save_fixture, user, enabled=False)

        response = await client.post("/v1/auth/backup-codes")

        assert response.status_code == 201
        assert len(response.json()["codes"]) == 10

    @pytest.mark.auth
    async def test_enabled_totp_without_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        await create_totp_enrollment(save_fixture, user)
        existing = await create_backup_codes_enrollment(save_fixture, user)
        existing_hashes = list(existing.codes_hashes)

        response = await client.post("/v1/auth/backup-codes")

        assert response.status_code == 403
        enrollment = await get_backup_codes_enrollment(session, user.id)
        assert enrollment is not None
        assert enrollment.codes_hashes == existing_hashes

    @pytest.mark.auth
    async def test_enabled_totp_invalid_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        enrollment = await create_totp_enrollment(save_fixture, user)
        code = invalid_totp_code(generate_totp_code(enrollment))

        response = await client.post("/v1/auth/backup-codes", json={"code": code})

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_enabled_totp_valid_totp_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        enrollment = await create_totp_enrollment(save_fixture, user)
        existing = await create_backup_codes_enrollment(save_fixture, user)
        existing_hashes = list(existing.codes_hashes)
        code = generate_totp_code(enrollment)

        response = await client.post("/v1/auth/backup-codes", json={"code": code})

        assert response.status_code == 201
        assert len(response.json()["codes"]) == 10
        new_enrollment = await get_backup_codes_enrollment(session, user.id)
        assert new_enrollment is not None
        for code_hash in existing_hashes:
            assert code_hash not in new_enrollment.codes_hashes

    @pytest.mark.auth
    async def test_enabled_totp_valid_backup_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        await create_totp_enrollment(save_fixture, user)
        await create_backup_codes_enrollment(save_fixture, user)

        response = await client.post(
            "/v1/auth/backup-codes", json={"code": BACKUP_CODES[0]}
        )

        assert response.status_code == 201
        assert len(response.json()["codes"]) == 10


@pytest.mark.asyncio
class TestTOTPEnable:
    @pytest.mark.auth
    async def test_valid_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        enrollment = await create_totp_enrollment(save_fixture, user, enabled=False)
        code = generate_totp_code(enrollment)

        response = await client.post("/v1/auth/totp/enable", json={"code": code})

        assert response.status_code == 200
        assert len(response.json()["codes"]) == 10
        assert await get_backup_codes_enrollment(session, user.id) is not None

    @pytest.mark.auth
    async def test_invalid_code(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        enrollment = await create_totp_enrollment(save_fixture, user, enabled=False)
        code = invalid_totp_code(generate_totp_code(enrollment))

        response = await client.post("/v1/auth/totp/enable", json={"code": code})

        assert response.status_code == 403
        assert await get_backup_codes_enrollment(session, user.id) is None

    @pytest.mark.auth
    async def test_enable_code_replay_rejected_on_backup_codes_enroll(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
    ) -> None:
        enrollment = await create_totp_enrollment(save_fixture, user, enabled=False)
        code = generate_totp_code(enrollment)

        enable_response = await client.post("/v1/auth/totp/enable", json={"code": code})
        assert enable_response.status_code == 200

        response = await client.post("/v1/auth/backup-codes", json={"code": code})
        assert response.status_code == 403
