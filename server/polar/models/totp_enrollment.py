from uuid import UUID

from reauth.factors.totp import TOTPAlgorithm
from reauth.factors.totp import TOTPEnrollment as TOTPEnrollmentDataclass
from sqlalchemy import ForeignKey, Integer, SmallInteger, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel
from polar.kit.encryption import EncryptedString, EncryptedStringType

TOTP_ENROLLMENT_SECRET_CONTEXT = {"table": "totp_enrollments", "column": "secret"}


class TOTPEnrollment(RecordModel):
    __tablename__ = "totp_enrollments"

    enabled: Mapped[bool] = mapped_column(nullable=False)
    secret_encrypted: Mapped[EncryptedString] = mapped_column(
        EncryptedStringType(TOTP_ENROLLMENT_SECRET_CONTEXT), nullable=False
    )
    algorithm: Mapped[TOTPAlgorithm] = mapped_column(String, nullable=False)
    code_length: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    time_step: Mapped[int] = mapped_column(Integer, nullable=False)
    last_verified_time_step: Mapped[int | None] = mapped_column(Integer, nullable=True)

    identity_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=False, unique=True
    )

    @classmethod
    async def encrypt_secret(cls, id: UUID, secret: str) -> EncryptedString:
        return await EncryptedString.encrypt(
            secret, context={**TOTP_ENROLLMENT_SECRET_CONTEXT, "id": str(id)}
        )

    async def get_secret(self) -> str:
        return await self.secret_encrypted.decrypt(id=str(self.id))

    async def to_dataclass(self) -> TOTPEnrollmentDataclass:
        return TOTPEnrollmentDataclass(
            id=self.id,
            enabled=self.enabled,
            secret=await self.get_secret(),
            algorithm=self.algorithm,
            code_length=self.code_length,
            time_step=self.time_step,
            identity_id=self.identity_id,
            last_verified_time_step=self.last_verified_time_step,
        )
