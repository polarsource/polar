from collections.abc import Sequence
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import UnaryExpression, asc, desc, text

from polar.auth.models import AuthSubject
from polar.event.repository import EventRepository
from polar.event_type.repository import EventTypeRepository
from polar.event_type.schemas import EventTypeWithStats
from polar.event_type.sorting import EventTypesSortProperty
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.models import Event, EventType, Organization, User
from polar.models.event import EventSource
from polar.postgres import AsyncSession


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
        parent_id: UUID | Literal["null"] | None = None,
        source: EventSource | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[EventTypesSortProperty]] = [
            (EventTypesSortProperty.last_seen, True)
        ],
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

        statement = statement.where(Event.parent_id.is_(parent_id))

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

        event_types_with_stats: list[EventTypeWithStats] = []
        for result in results:
            event_type, occurrences, first_seen, last_seen = result
            event_types_with_stats.append(
                EventTypeWithStats.model_validate(
                    {
                        **event_type.__dict__,
                        "occurrences": occurrences,
                        "first_seen": first_seen,
                        "last_seen": last_seen,
                    }
                )
            )

        return event_types_with_stats, count

    async def update(
        self,
        session: AsyncSession,
        event_type: EventType,
        label: str,
    ) -> EventType:
        event_type.label = label
        session.add(event_type)
        return event_type


event_type_service = EventTypeService()
