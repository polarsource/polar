from uuid import UUID

from reauth.factors.totp import TOTPAlgorithm
from reauth.factors.totp import TOTPEnrollment as TOTPEnrollmentDataclass
from sqlalchemy import CHAR, ForeignKey, Integer, SmallInteger, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class TOTPEnrollment(RecordModel):
    __tablename__ = "totp_enrollments"

    enabled: Mapped[bool] = mapped_column(nullable=False)
    secret: Mapped[str] = mapped_column(CHAR(32), nullable=False)
    algorithm: Mapped[TOTPAlgorithm] = mapped_column(String, nullable=False)
    code_length: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    time_step: Mapped[int] = mapped_column(Integer, nullable=False)
    last_verified_time_step: Mapped[int | None] = mapped_column(Integer, nullable=True)

    identity_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=False, unique=True
    )

    def to_dataclass(self) -> TOTPEnrollmentDataclass:
        return TOTPEnrollmentDataclass(
            id=self.id,
            enabled=self.enabled,
            secret=self.secret,
            algorithm=self.algorithm,
            code_length=self.code_length,
            time_step=self.time_step,
            identity_id=self.identity_id,
            last_verified_time_step=self.last_verified_time_step,
        )
