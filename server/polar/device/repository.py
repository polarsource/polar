from collections.abc import Sequence
from uuid import UUID

from polar.device.schemas import DevicePlatform
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.repository.base import Options
from polar.models import Device


class DeviceRepository(
    RepositorySoftDeletionIDMixin[Device, UUID],
    RepositorySoftDeletionMixin[Device],
    RepositoryBase[Device],
):
    model = Device

    async def delete(
        self, device_id: UUID, user_id: UUID, *, flush: bool = False
    ) -> None:
        # First get the device
        statement = (
            self.get_base_statement()
            .where(Device.id == device_id)
            .where(Device.user_id == user_id)
        )
        device = await self.get_one_or_none(statement)

        # If device exists, soft delete it
        if device:
            await self.soft_delete(device, flush=flush)

        return None

    async def list_by_user(
        self,
        user_id: UUID,
        platform: DevicePlatform | None,
        expo_push_token: str | None,
        *,
        options: Options = (),
    ) -> Sequence[Device]:
        statement = self.get_base_statement().where(Device.user_id == user_id)

        if expo_push_token:
            statement = statement.where(Device.expo_push_token == expo_push_token)

        if platform:
            statement = statement.where(Device.platform == platform)

        return await self.get_all(statement.options(*options))

    async def get_by_expo_token(self, expo_push_token: str) -> Device | None:
        statement = self.get_base_statement().where(
            Device.expo_push_token == expo_push_token
        )
        return await self.get_one_or_none(statement)
