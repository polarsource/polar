from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import UnaryExpression, asc, desc, text

from polar.auth.models import AuthSubject
from polar.event.repository import EventRepository
from polar.event.system import SYSTEM_EVENT_LABELS
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
        root_events: bool = False,
        parent_id: UUID | None = None,
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

        event_types_with_stats: list[EventTypeWithStats] = []
        for result in results:
            event_type, source, occurrences, first_seen, last_seen = result

            # Use system event label for system events
            if source == EventSource.system:
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
                        "source": source,
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
        label_property_selector: str | None = None,
    ) -> EventType:
        event_type.label = label
        event_type.label_property_selector = label_property_selector
        session.add(event_type)
        return event_type


event_type_service = EventTypeService()
