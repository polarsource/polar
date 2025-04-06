from collections.abc import Sequence
from uuid import UUID

from polar.auth.models import AuthSubject
from polar.device.schemas import DeviceCreate, DevicePlatform
from polar.exceptions import PolarRequestValidationError, ValidationError
from polar.models import Device
from polar.models.user import User
from polar.postgres import AsyncSession

from .repository import DeviceRepository


class DeviceService:
    async def list_by_user(
        self,
        session: AsyncSession,
        user_id: UUID,
        expo_push_token: str | None,
        platform: DevicePlatform | None,
    ) -> Sequence[Device]:
        repository = DeviceRepository.from_session(session)
        return await repository.list_by_user(
            user_id, expo_push_token=expo_push_token, platform=platform
        )

    async def create(
        self,
        session: AsyncSession,
        device_create: DeviceCreate,
        auth_subject: AuthSubject[User],
    ) -> Device:
        repository = DeviceRepository.from_session(session)

        errors: list[ValidationError] = []

        if await repository.get_by_expo_token(device_create.expo_push_token):
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "expo_push_token"),
                    "msg": "A device with this Expo push token already exists.",
                    "input": device_create.expo_push_token,
                }
            )

        if errors:
            raise PolarRequestValidationError(errors)

        return await repository.create(
            Device(
                user_id=auth_subject.subject.id,
                platform=device_create.platform,
                expo_push_token=device_create.expo_push_token,
            ),
            flush=True,
        )

    async def delete(
        self, session: AsyncSession, auth_subject: AuthSubject[User], id: UUID
    ) -> None:
        repository = DeviceRepository.from_session(session)
        await repository.delete(id, auth_subject.subject.id)


device = DeviceService()
