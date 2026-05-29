from uuid import UUID

from reauth.factors.backup_codes import (
    BackupCodesEnrollment as BackupCodesEnrollmentDataclass,
)
from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class BackupCodesEnrollment(RecordModel):
    __tablename__ = "backup_codes_enrollments"

    codes_hashes: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    used_codes_hashes: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    identity_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=False, unique=True
    )

    def to_dataclass(self) -> BackupCodesEnrollmentDataclass:
        return BackupCodesEnrollmentDataclass(
            id=self.id,
            codes_hashes=self.codes_hashes,
            used_codes_hashes=self.used_codes_hashes,
            identity_id=self.identity_id,
        )
