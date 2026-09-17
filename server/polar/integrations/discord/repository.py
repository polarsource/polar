from uuid import UUID

from sqlalchemy.dialects.postgresql import insert as pg_insert

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import DiscordGuildConnection


class DiscordGuildConnectionRepository(
    RepositorySoftDeletionIDMixin[DiscordGuildConnection, UUID],
    RepositorySoftDeletionMixin[DiscordGuildConnection],
    RepositoryBase[DiscordGuildConnection],
):
    model = DiscordGuildConnection

    async def get_by_organization_and_guild(
        self, organization_id: UUID, guild_id: str
    ) -> DiscordGuildConnection | None:
        statement = self.get_base_statement().where(
            DiscordGuildConnection.organization_id == organization_id,
            DiscordGuildConnection.guild_id == guild_id,
        )
        return await self.get_one_or_none(statement)

    async def create_if_absent(
        self, organization_id: UUID, guild_id: str, user_id: UUID
    ) -> None:
        statement = (
            pg_insert(DiscordGuildConnection)
            .values(
                organization_id=organization_id,
                guild_id=guild_id,
                user_id=user_id,
            )
            .on_conflict_do_nothing(
                index_elements=["organization_id", "guild_id"],
                index_where=DiscordGuildConnection.deleted_at.is_(None),
            )
        )
        await self.session.execute(statement)
