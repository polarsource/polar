from uuid import UUID

from reauth.factors.email_otp import EmailOTP as EmailOTPDataclass
from sqlalchemy import CHAR, BigInteger, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class CustomerSessionEmailOTP(RecordModel):
    __tablename__ = "customer_session_email_otps"

    code_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)

    identity_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("members.id", ondelete="cascade"), nullable=False, index=True
    )

    authentication_session_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customer_session_authentication_sessions.id", ondelete="cascade"),
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
