from uuid import UUID

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
