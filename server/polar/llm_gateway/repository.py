from uuid import UUID

from sqlalchemy import Select

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    RepositoryBase,
    RepositoryIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.llm_provider_config import LLMProviderConfig


class LLMProviderConfigRepository(
    RepositorySoftDeletionMixin[LLMProviderConfig],
    RepositoryBase[LLMProviderConfig],
    RepositoryIDMixin[LLMProviderConfig, UUID],
):
    model = LLMProviderConfig

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[LLMProviderConfig]]:
        return self.get_base_statement().where(
            LLMProviderConfig.organization_id.in_(org_ids)
        )

    async def get_readable_by_id(
        self,
        id: UUID,
        org_ids: set[AccessibleOrganizationID],
    ) -> LLMProviderConfig | None:
        statement = self.get_statement_by_org_ids(org_ids).where(
            LLMProviderConfig.id == id
        )
        return await self.get_one_or_none(statement)

    async def get_by_org_and_model(
        self,
        organization_id: UUID,
        model_name: str,
    ) -> LLMProviderConfig | None:
        statement = self.get_base_statement().where(
            LLMProviderConfig.organization_id == organization_id,
            LLMProviderConfig.model_name == model_name,
            LLMProviderConfig.is_enabled.is_(True),
        )
        return await self.get_one_or_none(statement)

    async def get_enabled_by_org(
        self,
        organization_id: UUID,
    ) -> list[LLMProviderConfig]:
        statement = self.get_base_statement().where(
            LLMProviderConfig.organization_id == organization_id,
            LLMProviderConfig.is_enabled.is_(True),
        )
        return list(await self.get_all(statement))
