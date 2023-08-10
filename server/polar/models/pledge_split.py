from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.pledge import Pledge


class PledgeSplit(RecordModel):
    __tablename__ = "pledge_splits"

    issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("issues.id"), nullable=False
    )

    share: Mapped[int] = mapped_column(BigInteger, nullable=False)

    github_username: Mapped[str | None] = mapped_column(String, nullable=True)

    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), nullable=True
    )

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=True
    )
