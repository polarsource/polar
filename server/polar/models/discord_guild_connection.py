from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.models.organization import Organization
from polar.models.user import User


class DiscordGuildConnection(RecordModel):
    """Records that an organization connected a Discord guild.

    The Polar bot can act on any guild it has joined with nothing but the guild
    id, so a guild id arriving from a client is only trusted when a row here
    says that organization connected it.
    """

    __tablename__ = "discord_guild_connections"
    __table_args__ = (
        Index(
            "ix_discord_guild_connections_organization_id_guild_id",
            "organization_id",
            "guild_id",
            unique=True,
            postgresql_where="deleted_at IS NULL",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    guild_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="set null"), nullable=True, index=True
    )

    @declared_attr
    def organization(cls) -> Mapped[Organization]:
        return relationship(Organization, lazy="raise")

    @declared_attr
    def user(cls) -> Mapped[User | None]:
        return relationship(User, lazy="raise")
