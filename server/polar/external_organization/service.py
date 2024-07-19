import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, select
from sqlalchemy.orm import joinedload

from polar.auth.models import Anonymous, AuthSubject, is_organization
from polar.enums import Platforms
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import ExternalOrganization, Organization, User
from polar.postgres import AsyncSession

from .sorting import SortProperty


class ExternalOrganizationService(ResourceServiceReader[ExternalOrganization]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Anonymous | User | Organization],
        *,
        name: str | None = None,
        platform: Platforms | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[SortProperty]] = [(SortProperty.created_at, True)],
    ) -> tuple[Sequence[ExternalOrganization], int]:
        statement = self._get_readable_external_organization_statement(auth_subject)

        if name is not None:
            statement = statement.where(ExternalOrganization.name == name)

        if platform is not None:
            statement = statement.where(ExternalOrganization.platform == platform)

        if organization_id is not None:
            statement = statement.where(
                ExternalOrganization.organization_id.in_(organization_id)
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == SortProperty.created_at:
                order_by_clauses.append(
                    clause_function(ExternalOrganization.created_at)
                )
            elif criterion == SortProperty.name:
                order_by_clauses.append(clause_function(ExternalOrganization.name))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> ExternalOrganization | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def get_linked(
        self, session: AsyncSession, id: uuid.UUID
    ) -> ExternalOrganization | None:
        statement = (
            select(ExternalOrganization)
            .where(
                ExternalOrganization.id == id,
                ExternalOrganization.deleted_at.is_(None),
                ExternalOrganization.organization_id.isnot(None),
            )
            .options(joinedload(ExternalOrganization.organization))
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    def _get_readable_external_organization_statement(
        self, auth_subject: AuthSubject[Anonymous | User | Organization]
    ) -> Select[tuple[ExternalOrganization]]:
        statement = select(ExternalOrganization).where(
            ExternalOrganization.deleted_at.is_(None)
        )

        if is_organization(auth_subject):
            statement = statement.where(
                ExternalOrganization.organization_id == auth_subject.subject.id
            )

        return statement


external_organization = ExternalOrganizationService(ExternalOrganization)
