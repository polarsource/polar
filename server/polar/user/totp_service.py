import base64
import hashlib
import hmac
import secrets
from io import BytesIO
from typing import Any

import pyotp
import qrcode
from sqlalchemy.ext.asyncio import AsyncSession

from polar.config import settings
from polar.models.user import User
from polar.user.repository import UserRepository


class TOTPService:

    @staticmethod
    def generate_secret() -> str:
        return pyotp.random_base32()

    @staticmethod
    def generate_backup_codes(count: int = 10) -> list[str]:
        return [secrets.token_hex(4).upper() for _ in range(count)]

    @staticmethod
    def _hash_code(code: str) -> str:
        return hmac.new(
            settings.SECRET.encode("ascii"),
            code.encode("ascii"),
            hashlib.sha256
        ).hexdigest()

    @staticmethod
    def hash_backup_codes(codes: list[str]) -> dict[str, Any]:
        return {
            "codes": [TOTPService._hash_code(code) for code in codes],
            "used": []
        }

    @staticmethod
    def verify_backup_code(stored_codes: dict[str, Any], code: str) -> bool:
        if not stored_codes:
            return False

        code_upper = code.upper()

        # Check if code is already used
        if code_upper in stored_codes.get("used", []):
            return False

        # Verify against stored hashed codes
        for i, hashed_code in enumerate(stored_codes.get("codes", [])):
            if TOTPService._hash_code(code_upper) == hashed_code:
                # Mark code as used
                stored_codes.setdefault("used", []).append(code_upper)
                return True

        return False

    @staticmethod
    def get_provisioning_uri(user: User, secret: str) -> str:
        issuer_name = getattr(settings, "TOTP_ISSUER_NAME", "Polar")
        return pyotp.totp.TOTP(secret).provisioning_uri(
            name=user.email,
            issuer_name=issuer_name
        )

    @staticmethod
    def generate_qr_code(provisioning_uri: str) -> str:
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, "PNG")
        buffer.seek(0)

        return base64.b64encode(buffer.getvalue()).decode()

    @staticmethod
    def verify_totp(secret: str, token: str) -> bool:
        if not secret or not token:
            return False

        try:
            totp = pyotp.TOTP(secret)
            return totp.verify(token, valid_window=1)  # Allow 1 step tolerance
        except Exception:
            return False

    async def setup_totp(
        self, session: AsyncSession, user: User
    ) -> tuple[str, str, list[str]]:
        secret = self.generate_secret()
        backup_codes = self.generate_backup_codes()

        # Store secret and backup codes (backup codes are hashed)
        repository = UserRepository.from_session(session)
        user = await repository.update(user, update_dict={
            "totp_secret": secret,
            "backup_codes": self.hash_backup_codes(backup_codes),
            "totp_enabled": False
        })        # Generate QR code
        provisioning_uri = self.get_provisioning_uri(user, secret)
        qr_code = self.generate_qr_code(provisioning_uri)

        return secret, qr_code, backup_codes

    async def enable_totp(
        self, session: AsyncSession, user: User, verification_code: str
    ) -> bool:
        if not user.totp_secret:
            return False

        if not self.verify_totp(user.totp_secret, verification_code):
            return False

        repository = UserRepository.from_session(session)
        user = await repository.update(user, update_dict={"totp_enabled": True})
        return True

    async def disable_totp(self, session: AsyncSession, user: User) -> bool:
        repository = UserRepository.from_session(session)
        user = await repository.update(user, update_dict={
            "totp_secret": None,
            "totp_enabled": False,
            "backup_codes": None
        })

        return True

    async def verify_user_totp(
        self, user: User, code: str, allow_backup: bool = True
    ) -> bool:
        if not user.totp_enabled or not user.totp_secret:
            return False

        # Try TOTP verification first
        if self.verify_totp(user.totp_secret, code):
            return True

        # Try backup code if allowed
        if allow_backup and user.backup_codes:
            return self.verify_backup_code(user.backup_codes, code)

        return False

    async def regenerate_backup_codes(
        self, session: AsyncSession, user: User
    ) -> list[str] | None:
        if not user.totp_enabled:
            return None

        backup_codes = self.generate_backup_codes()
        repository = UserRepository.from_session(session)
        user = await repository.update(user, update_dict={
            "backup_codes": self.hash_backup_codes(backup_codes)
        })

        return backup_codes
# Service instance
totp_service = TOTPService()
