from collections.abc import Sequence
from typing import Any
from uuid import UUID

import logfire
import structlog
from sqlalchemy import UnaryExpression, asc, desc, select, text

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.config import settings
from polar.event.repository import EventRepository
from polar.event.system import SYSTEM_EVENT_LABELS
from polar.event_type.repository import EventTypeRepository
from polar.event_type.schemas import EventTypeWithStats
from polar.event_type.sorting import EventTypesSortProperty
from polar.integrations.tinybird.service import (
    TinybirdEventsQuery,
    TinybirdEventTypeStats,
)
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.logging import Logger
from polar.models import Event, EventType, Organization, User, UserOrganization
from polar.models.event import EventSource
from polar.postgres import AsyncSession

log: Logger = structlog.get_logger()


class EventTypeService:
    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
    ) -> EventType | None:
        repository = EventTypeRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            EventType.id == id
        )
        return await repository.get_one_or_none(statement)

    async def list_with_stats(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[UUID] | None = None,
        customer_id: Sequence[UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        query: str | None = None,
        root_events: bool = False,
        parent_id: UUID | None = None,
        source: EventSource | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[EventTypesSortProperty]] = [
            (EventTypesSortProperty.last_seen, True)
        ],
    ) -> tuple[Sequence[EventTypeWithStats], int]:
        db_results, db_count = await self._list_with_stats_from_db(
            session,
            auth_subject,
            organization_id=organization_id,
            customer_id=customer_id,
            external_customer_id=external_customer_id,
            query=query,
            root_events=root_events,
            parent_id=parent_id,
            source=source,
            pagination=pagination,
            sorting=sorting,
        )

        org = await self._get_tinybird_enabled_org(
            session, auth_subject, organization_id
        )
        if org is None:
            return db_results, db_count

        tinybird_shadow = org.feature_settings.get("tinybird_compare", False)
        tinybird_read = org.feature_settings.get("tinybird_read", False)

        try:
            (
                tinybird_results,
                tinybird_count,
            ) = await self._list_with_stats_from_tinybird(
                session,
                org,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                query=query,
                root_events=root_events,
                parent_id=parent_id,
                source=source,
                pagination=pagination,
                sorting=sorting,
            )
        except Exception as e:
            log.error(
                "tinybird.query.failed",
                organization_id=str(org.id),
                error=str(e),
            )
            return db_results, db_count

        if tinybird_shadow:
            self._log_comparison(
                org.id, db_results, db_count, tinybird_results, tinybird_count
            )
            return db_results, db_count

        if tinybird_read:
            return tinybird_results, tinybird_count

        return db_results, db_count

    async def _get_tinybird_enabled_org(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: Sequence[UUID] | None,
    ) -> Organization | None:
        if not settings.TINYBIRD_EVENTS_READ:
            return None

        org: Organization | None
        if is_organization(auth_subject):
            org = auth_subject.subject
        elif is_user(auth_subject):
            if not organization_id:
                return None
            statement = select(Organization).where(
                Organization.id == organization_id[0],
                Organization.id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                ),
            )
            result = await session.execute(statement)
            org = result.scalar_one_or_none()
            if org is None:
                return None
        else:
            return None

        if org.feature_settings.get("tinybird_read", False) or org.feature_settings.get(
            "tinybird_compare", False
        ):
            return org

        return None

    async def _list_with_stats_from_db(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[UUID] | None = None,
        customer_id: Sequence[UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        query: str | None = None,
        root_events: bool = False,
        parent_id: UUID | None = None,
        source: EventSource | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[EventTypesSortProperty]],
    ) -> tuple[Sequence[EventTypeWithStats], int]:
        event_type_repository = EventTypeRepository.from_session(session)
        event_repository = EventRepository.from_session(session)
        statement = event_type_repository.get_event_types_with_stats_statement(
            auth_subject
        )

        if organization_id is not None:
            statement = statement.where(EventType.organization_id.in_(organization_id))

        if customer_id is not None:
            statement = statement.where(
                event_repository.get_customer_id_filter_clause(customer_id)
            )

        if external_customer_id is not None:
            statement = statement.where(
                event_repository.get_external_customer_id_filter_clause(
                    external_customer_id
                )
            )

        if query is not None:
            statement = statement.where(
                EventType.name.ilike(f"%{query}%") | EventType.label.ilike(f"%{query}%")
            )

        if root_events:
            statement = statement.where(Event.parent_id.is_(None))

        if parent_id is not None:
            statement = statement.where(Event.parent_id == parent_id)

        if source is not None:
            statement = statement.where(Event.source == source)

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == EventTypesSortProperty.event_type_name:
                order_by_clauses.append(clause_function(EventType.name))
            elif criterion == EventTypesSortProperty.event_type_label:
                order_by_clauses.append(clause_function(EventType.label))
            elif criterion == EventTypesSortProperty.first_seen:
                order_by_clauses.append(clause_function(text("first_seen")))
            elif criterion == EventTypesSortProperty.last_seen:
                order_by_clauses.append(clause_function(text("last_seen")))
            elif criterion == EventTypesSortProperty.occurrences:
                order_by_clauses.append(clause_function(text("occurrences")))
        statement = statement.order_by(*order_by_clauses)

        results, count = await paginate(session, statement, pagination=pagination)

        return self._build_event_types_with_stats(results), count

    async def _list_with_stats_from_tinybird(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        customer_id: Sequence[UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        query: str | None = None,
        root_events: bool = False,
        parent_id: UUID | None = None,
        source: EventSource | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[EventTypesSortProperty]],
    ) -> tuple[Sequence[EventTypeWithStats], int]:
        tinybird_query = TinybirdEventsQuery(organization.id)

        if customer_id is not None:
            tinybird_query.filter_customer_id(customer_id)
        if external_customer_id is not None:
            tinybird_query.filter_external_customer_id(external_customer_id)
        if root_events:
            tinybird_query.filter_root_events()
        if parent_id is not None:
            tinybird_query.filter_parent_id(parent_id)
        if source is not None:
            tinybird_query.filter_source(source)

        for criterion, is_desc in sorting:
            if criterion == EventTypesSortProperty.event_type_name:
                tinybird_query.order_by("name", is_desc)
            elif criterion == EventTypesSortProperty.first_seen:
                tinybird_query.order_by("first_seen", is_desc)
            elif criterion == EventTypesSortProperty.last_seen:
                tinybird_query.order_by("last_seen", is_desc)
            elif criterion == EventTypesSortProperty.occurrences:
                tinybird_query.order_by("occurrences", is_desc)

        tinybird_stats = await tinybird_query.get_event_type_stats()

        names = [s.name for s in tinybird_stats]
        event_type_repository = EventTypeRepository.from_session(session)
        event_types_by_name = await event_type_repository.get_by_names_and_organization(
            names, organization.id
        )

        if query is not None:
            query_lower = query.lower()
            tinybird_stats = [
                s
                for s in tinybird_stats
                if query_lower in s.name.lower()
                or (
                    s.name in event_types_by_name
                    and query_lower in (event_types_by_name[s.name].label or "").lower()
                )
            ]

        total_count = len(tinybird_stats)
        start = (pagination.page - 1) * pagination.limit
        end = start + pagination.limit
        paginated_stats = tinybird_stats[start:end]

        results = self._build_event_types_from_tinybird(
            paginated_stats, event_types_by_name, organization.id
        )

        return results, total_count

    def _build_event_types_with_stats(
        self, results: Sequence[tuple[EventType, EventSource, int, Any, Any]]
    ) -> list[EventTypeWithStats]:
        event_types_with_stats: list[EventTypeWithStats] = []
        for result in results:
            event_type, src, occurrences, first_seen, last_seen = result

            if src == EventSource.system:
                label = SYSTEM_EVENT_LABELS.get(event_type.name, event_type.label)
            else:
                label = event_type.label

            event_types_with_stats.append(
                EventTypeWithStats.model_validate(
                    {
                        "id": event_type.id,
                        "created_at": event_type.created_at,
                        "modified_at": event_type.modified_at,
                        "name": event_type.name,
                        "label": label,
                        "label_property_selector": event_type.label_property_selector,
                        "organization_id": event_type.organization_id,
                        "source": src,
                        "occurrences": occurrences,
                        "first_seen": first_seen,
                        "last_seen": last_seen,
                    }
                )
            )
        return event_types_with_stats

    def _build_event_types_from_tinybird(
        self,
        stats: list[TinybirdEventTypeStats],
        event_types_by_name: dict[str, EventType],
        organization_id: UUID,
    ) -> list[EventTypeWithStats]:
        results: list[EventTypeWithStats] = []
        for s in stats:
            event_type = event_types_by_name.get(s.name)
            if event_type is None:
                continue

            if s.source == EventSource.system:
                label = SYSTEM_EVENT_LABELS.get(s.name, event_type.label)
            else:
                label = event_type.label

            results.append(
                EventTypeWithStats.model_validate(
                    {
                        "id": event_type.id,
                        "created_at": event_type.created_at,
                        "modified_at": event_type.modified_at,
                        "name": event_type.name,
                        "label": label,
                        "label_property_selector": event_type.label_property_selector,
                        "organization_id": organization_id,
                        "source": s.source,
                        "occurrences": s.occurrences,
                        "first_seen": s.first_seen,
                        "last_seen": s.last_seen,
                    }
                )
            )
        return results

    def _log_comparison(
        self,
        organization_id: UUID,
        db_results: Sequence[EventTypeWithStats],
        db_count: int,
        tinybird_results: Sequence[EventTypeWithStats],
        tinybird_count: int,
    ) -> None:
        db_by_key = {(r.name, r.source): r for r in db_results}
        tinybird_by_key = {(r.name, r.source): r for r in tinybird_results}

        missing_in_tinybird: list[str] = []
        missing_in_db: list[str] = []
        occurrences_mismatch: list[dict[str, Any]] = []

        for key, db_r in db_by_key.items():
            tb_r = tinybird_by_key.get(key)
            if tb_r is None:
                missing_in_tinybird.append(f"{key[0]}:{key[1]}")
            elif db_r.occurrences != tb_r.occurrences:
                occurrences_mismatch.append(
                    {
                        "name": key[0],
                        "source": str(key[1]),
                        "db": db_r.occurrences,
                        "tinybird": tb_r.occurrences,
                    }
                )

        for key in tinybird_by_key:
            if key not in db_by_key:
                missing_in_db.append(f"{key[0]}:{key[1]}")

        has_diff = (
            db_count != tinybird_count
            or missing_in_tinybird
            or missing_in_db
            or occurrences_mismatch
        )

        with logfire.span(
            "tinybird.shadow.comparison",
            organization_id=str(organization_id),
            db_count=db_count,
            tinybird_count=tinybird_count,
            has_diff=has_diff,
            missing_in_tinybird=missing_in_tinybird,
            missing_in_db=missing_in_db,
            occurrences_mismatch=occurrences_mismatch,
        ):
            pass

    async def update(
        self,
        session: AsyncSession,
        event_type: EventType,
        label: str,
        label_property_selector: str | None = None,
    ) -> EventType:
        event_type.label = label
        event_type.label_property_selector = label_property_selector
        session.add(event_type)
        return event_type


event_type_service = EventTypeService()
