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
    ConfigApplyResourceResult,
    ConfigApplyResult,
    ConfigSection,
)


class ConfigAsCodeNotEnabled(PolarError):
    def __init__(self) -> None:
        super().__init__("Config as code is not enabled for this organization.", 403)


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
            version=config.version,
            results=[
                ConfigApplyResourceResult(
                    section=ConfigSection.meters,
                    key=meter.external_id,
                    action=ConfigAction.created,
                )
                for meter in config.meters
            ],
        )


declarative_config = DeclarativeConfigService()
