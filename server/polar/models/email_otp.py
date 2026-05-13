from uuid import UUID

from reauth.factors.email_otp import EmailOTP as EmailOTPDataclass
from sqlalchemy import CHAR, BigInteger, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class EmailOTP(RecordModel):
    __tablename__ = "email_otps"

    code_hash: Mapped[str] = mapped_column(
        CHAR(64), nullable=False, index=True, unique=True
    )
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)

    identity_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=False, index=True
    )

    authentication_session_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("authentication_sessions.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    def to_dataclass(self) -> EmailOTPDataclass:
        return EmailOTPDataclass(
            id=self.id,
            code_hash=self.code_hash,
            expires_at=self.expires_at,
            email=self.email,
            identity_id=self.identity_id,
            authentication_session_id=self.authentication_session_id,
        )
