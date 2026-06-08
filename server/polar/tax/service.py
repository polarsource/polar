from collections.abc import Sequence
from datetime import date
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.postgres import AsyncReadSession

from .repository import TaxJurisdictionRepository
from .schemas import TaxJurisdiction, TaxSummary
from .sorting import TaxJurisdictionSortProperty


class TaxService:
    async def list_jurisdictions(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[UUID] | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[TaxJurisdictionSortProperty]],
    ) -> tuple[Sequence[TaxJurisdiction], int]:
        organization_ids = await self._resolve_organization_ids(
            session, auth_subject, organization_id
        )

        repository = TaxJurisdictionRepository.from_session(session)
        statement = repository.get_jurisdictions_statement(
            organization_ids,
            start_date=start_date,
            end_date=end_date,
            sorting=sorting,
        )

        rows, count = await paginate(session, statement, pagination=pagination)
        jurisdictions = [
            TaxJurisdiction.from_aggregate(
                country=country,
                state=state,
                currency=currency,
                tax_amount=tax_amount,
                order_count=order_count,
            )
            for country, state, currency, tax_amount, order_count in rows
        ]
        return jurisdictions, count

    async def get_summary(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[UUID] | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> TaxSummary:
        organization_ids = await self._resolve_organization_ids(
            session, auth_subject, organization_id
        )

        repository = TaxJurisdictionRepository.from_session(session)
        statement = repository.get_summary_statement(
            organization_ids,
            start_date=start_date,
            end_date=end_date,
        )

        result = await session.execute(statement)
        row = result.one()
        return TaxSummary(
            currency=row.currency or "usd",
            tax_amount=row.tax_amount,
            order_count=row.order_count,
            jurisdiction_count=row.jurisdiction_count,
        )

    async def _resolve_organization_ids(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: Sequence[UUID] | None,
    ) -> list[UUID]:
        accessible_org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.finance_read
        )
        organization_ids: set[UUID] = set(accessible_org_ids)
        if organization_id is not None:
            organization_ids &= set(organization_id)
        return list(organization_ids)


tax = TaxService()
