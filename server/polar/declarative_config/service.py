from typing import Literal

from pydantic import BaseModel, Field, create_model

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.exceptions import PolarError
from polar.models import Organization, User
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession

from .schemas import (
    Config,
    ConfigAction,
    ConfigApplyResult,
    ConfigEntryError,
    ConfigMeterResult,
)


class ConfigAsCodeNotEnabled(PolarError):
    def __init__(self) -> None:
        super().__init__("Config as code is not enabled for this organization.", 403)


class ConfigMeterConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "A meter in this config was created by a concurrent request. Retry.", 409
        )


class ConfigMeterLocked(PolarError):
    def __init__(self, errors: list[ConfigEntryError]) -> None:
        super().__init__(
            "Some meters can't be updated because they're already aggregating events.",
            409,
        )
        self.errors = errors

    @property
    def detail(self) -> list[ConfigEntryError]:
        return self.errors

    @classmethod
    def schema(cls) -> type[BaseModel]:
        if cls._schema is None:
            cls._schema = create_model(
                cls.__name__,
                error=(Literal[cls.__name__], Field(examples=[cls.__name__])),
                detail=(list[ConfigEntryError], ...),
            )
        return cls._schema


class DeclarativeConfigService:
    async def apply(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        config: Config,
    ) -> ConfigApplyResult:
        organization = await get_payload_organization(session, auth_subject, config)
        await assert_organization_permission(
            session,
            auth_subject,
            organization.id,
            OrganizationPermission.products_manage,
        )
        if not organization.is_config_as_code_enabled:
            raise ConfigAsCodeNotEnabled()

        return ConfigApplyResult(
            meters=[
                ConfigMeterResult(
                    external_id=meter.external_id, action=ConfigAction.created
                )
                for meter in config.meters
            ]
        )


declarative_config = DeclarativeConfigService()
