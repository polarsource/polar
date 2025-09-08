"""
Tests for Two-Factor Authentication functionality
"""
import pytest
from httpx import AsyncClient

from polar.models.user import User
from polar.user.totp_service import totp_service


@pytest.mark.asyncio
@pytest.mark.auth
async def test_totp_setup_flow(user: User, client: AsyncClient) -> None:
    """Test the complete TOTP setup flow"""

    # 1. Check initial status - should be disabled
    response = await client.get("/v1/users/2fa/status")
    assert response.status_code == 200
    json = response.json()
    assert json["enabled"] is False
    assert json["backup_codes_remaining"] == 0

    # 2. Set up TOTP
    response = await client.post("/v1/users/2fa/setup", json={})
    assert response.status_code == 200
    json = response.json()
    assert "secret" in json
    assert "qr_code" in json
    assert "backup_codes" in json
    assert len(json["backup_codes"]) == 10

    secret = json["secret"]

    # 3. Try to enable with invalid code
    response = await client.post("/v1/users/2fa/enable", json={"verification_code": "000000"})
    assert response.status_code == 400

    # 4. Enable with valid code
    import pyotp
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    response = await client.post("/v1/users/2fa/enable", json={"verification_code": valid_code})
    assert response.status_code == 200

    # 5. Check status again - should be enabled
    response = await client.get("/v1/users/2fa/status")
    assert response.status_code == 200
    json = response.json()
    assert json["enabled"] is True
    assert json["backup_codes_remaining"] == 10


@pytest.mark.asyncio
@pytest.mark.auth
async def test_totp_verification(user: User, client: AsyncClient) -> None:
    """Test TOTP code verification"""

    # Set up TOTP first
    response = await client.post("/v1/users/2fa/setup", json={})
    assert response.status_code == 200
    secret = response.json()["secret"]

    # Enable TOTP
    import pyotp
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    response = await client.post("/v1/users/2fa/enable", json={"verification_code": valid_code})
    assert response.status_code == 200

    # Test verification with valid code
    new_valid_code = totp.now()
    response = await client.post("/v1/users/2fa/verify", json={"code": new_valid_code})
    assert response.status_code == 200
    assert response.json()["valid"] is True

    # Test verification with invalid code
    response = await client.post("/v1/users/2fa/verify", json={"code": "000000"})
    assert response.status_code == 200
    assert response.json()["valid"] is False


@pytest.mark.asyncio
@pytest.mark.auth
async def test_totp_disable(user: User, client: AsyncClient) -> None:
    """Test disabling TOTP"""

    # Set up and enable TOTP first
    response = await client.post("/v1/users/2fa/setup", json={})
    assert response.status_code == 200
    secret = response.json()["secret"]

    import pyotp
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    response = await client.post("/v1/users/2fa/enable", json={"verification_code": valid_code})
    assert response.status_code == 200

    # Disable with invalid code should fail
    response = await client.post("/v1/users/2fa/disable", json={"verification_code": "000000"})
    assert response.status_code == 400

    # Disable with valid code should succeed
    new_valid_code = totp.now()
    response = await client.post("/v1/users/2fa/disable", json={"verification_code": new_valid_code})
    assert response.status_code == 200

    # Check status - should be disabled
    response = await client.get("/v1/users/2fa/status")
    assert response.status_code == 200
    json = response.json()
    assert json["enabled"] is False


@pytest.mark.asyncio
async def test_totp_service_methods() -> None:
    """Test TOTP service methods"""

    # Test secret generation
    secret = totp_service.generate_secret()
    assert len(secret) == 32  # Base32 encoded

    # Test backup code generation
    backup_codes = totp_service.generate_backup_codes()
    assert len(backup_codes) == 10
    assert all(len(code) == 8 for code in backup_codes)  # 4 hex bytes = 8 chars

    # Test backup code hashing and verification
    hashed_codes = totp_service.hash_backup_codes(backup_codes)
    assert "codes" in hashed_codes
    assert "used" in hashed_codes
    assert len(hashed_codes["codes"]) == 10

    # Test backup code verification
    first_code = backup_codes[0]
    assert totp_service.verify_backup_code(hashed_codes, first_code)
    assert first_code.upper() in hashed_codes["used"]

    # Test that used code can't be used again
    assert not totp_service.verify_backup_code(hashed_codes, first_code)

    # Test TOTP verification
    import pyotp
    totp = pyotp.TOTP(secret)
    valid_token = totp.now()
    assert totp_service.verify_totp(secret, valid_token)
    assert not totp_service.verify_totp(secret, "000000")
