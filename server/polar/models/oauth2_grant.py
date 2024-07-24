from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.models.organization import Organization
from polar.models.user import User


class OAuth2Grant(RecordModel):
    __tablename__ = "oauth2_grants"
    __table_args__ = (
        UniqueConstraint("client_id", "user_id"),
        UniqueConstraint("client_id", "organization_id"),
    )

    client_id: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    scope: Mapped[str] = mapped_column(Text, default="", nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped[User | None]:
        return relationship(User, lazy="joined")

    @declared_attr
    def organization(cls) -> Mapped[Organization | None]:
        return relationship(Organization, lazy="joined")

    @property
    def scopes(self) -> list[str]:
        return self.scope.strip().split()
