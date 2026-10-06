from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.auth.scope import Scope
from polar.authz.service import assert_organization_permission
from polar.exceptions import PolarError
from polar.models import Organization, User
from polar.oauth2.exceptions import InsufficientScopeError
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


class ConfigAsCodeService:
    async def apply(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        config: Config,
    ) -> ConfigApplyResult:
        organization = await get_payload_organization(session, auth_subject, config)
        if config.organization is not None:
            await self._authorize_section(
                session,
                auth_subject,
                organization,
                Scope.organizations_write,
                OrganizationPermission.organization_manage,
            )
        if config.meters is not None:
            await self._authorize_section(
                session,
                auth_subject,
                organization,
                Scope.meters_write,
                OrganizationPermission.products_manage,
            )
        if not organization.is_config_as_code_enabled:
            raise ConfigAsCodeNotEnabled()

        results: list[ConfigApplyResourceResult] = []
        if config.organization is not None:
            results.append(
                ConfigApplyResourceResult(
                    section=ConfigSection.organization,
                    key=None,
                    action=ConfigAction.updated,
                )
            )
        for meter in config.meters or []:
            results.append(
                ConfigApplyResourceResult(
                    section=ConfigSection.meters,
                    key=meter.external_id,
                    action=ConfigAction.created,
                )
            )
        return ConfigApplyResult(version=config.version, results=results)

    async def _authorize_section(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        scope: Scope,
        permission: OrganizationPermission,
    ) -> None:
        if scope not in auth_subject.scopes:
            raise InsufficientScopeError({scope})
        await assert_organization_permission(
            session, auth_subject, organization.id, permission
        )


config_as_code = ConfigAsCodeService()
