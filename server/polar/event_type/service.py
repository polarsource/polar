from collections.abc import Sequence
from uuid import UUID

from polar.auth.models import AuthSubject
from polar.authz.service import get_accessible_org_ids
from polar.customer.repository import CustomerRepository
from polar.event.system import SYSTEM_EVENT_LABELS
from polar.event.tinybird_repository import TinybirdEventRepository
from polar.event_type.repository import EventTypeRepository
from polar.event_type.schemas import EventTypeWithStats
from polar.event_type.sorting import EventTypesSortProperty
from polar.integrations.tinybird.service import (
    TinybirdEventTypeStats,
)
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import EventType, Organization, User
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
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = repository.get_statement_by_org_ids(org_ids).where(
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
        org_ids = await get_accessible_org_ids(session, auth_subject)
        if organization_id is not None:
            org_ids = org_ids & set(organization_id)
        organization_ids = list(org_ids)
        if not organization_ids:
            return [], 0

        customer_repository = CustomerRepository.from_session(session)
        all_customer_ids: list[UUID] = list(customer_id or [])
        all_external_ids: list[str] = list(external_customer_id or [])
        if customer_id is not None:
            all_external_ids.extend(
                await customer_repository.get_readable_external_ids_by_ids(
                    org_ids, customer_id
                )
            )
        if external_customer_id is not None:
            all_customer_ids.extend(
                await customer_repository.get_readable_ids_by_external_ids(
                    org_ids, external_customer_id
                )
            )

        tinybird_repository = TinybirdEventRepository()
        tinybird_sorting: list[tuple[str, bool]] = []
        for criterion, is_desc in sorting:
            if criterion == EventTypesSortProperty.event_type_name:
                tinybird_sorting.append(("name", is_desc))
            elif criterion == EventTypesSortProperty.first_seen:
                tinybird_sorting.append(("first_seen", is_desc))
            elif criterion == EventTypesSortProperty.last_seen:
                tinybird_sorting.append(("last_seen", is_desc))
            elif criterion == EventTypesSortProperty.occurrences:
                tinybird_sorting.append(("occurrences", is_desc))

        tinybird_stats = await tinybird_repository.get_event_type_stats(
            organization_id=organization_ids,
            customer_id=all_customer_ids if all_customer_ids else None,
            external_customer_id=all_external_ids if all_external_ids else None,
            root_events=root_events,
            parent_id=parent_id,
            source=source,
            sorting=tinybird_sorting,
        )

        names = [s.name for s in tinybird_stats]
        event_types_by_key = await event_type_repository.get_by_names_and_organization(
            names, organization_ids
        )

        if query is not None:
            query_lower = query.lower()
            tinybird_stats = [
                s
                for s in tinybird_stats
                if query_lower in s.name.lower()
                or query_lower in self._resolve_label(s, event_types_by_key).lower()
            ]

        total_count = len(tinybird_stats)
        start = (pagination.page - 1) * pagination.limit
        end = start + pagination.limit
        paginated_stats = tinybird_stats[start:end]

        results = self._build_event_types_from_tinybird(
            paginated_stats, event_types_by_key
        )

        return results, total_count

    def _resolve_label(
        self,
        stat: TinybirdEventTypeStats,
        event_types_by_key: dict[tuple[UUID, str], EventType],
    ) -> str:
        event_type = event_types_by_key.get((stat.organization_id, stat.name))
        if stat.source == EventSource.system:
            fallback = event_type.label if event_type is not None else stat.name
            return SYSTEM_EVENT_LABELS.get(stat.name, fallback)
        if event_type is not None:
            return event_type.label
        return stat.name

    def _build_event_types_from_tinybird(
        self,
        stats: list[TinybirdEventTypeStats],
        event_types_by_key: dict[tuple[UUID, str], EventType],
    ) -> list[EventTypeWithStats]:
        results: list[EventTypeWithStats] = []
        for s in stats:
            event_type = event_types_by_key.get((s.organization_id, s.name))
            label = self._resolve_label(s, event_types_by_key)

            if event_type is None:
                if s.source != EventSource.system:
                    continue
                results.append(
                    EventTypeWithStats.model_validate(
                        {
                            "id": None,
                            "created_at": None,
                            "modified_at": None,
                            "name": s.name,
                            "label": label,
                            "label_property_selector": None,
                            "organization_id": s.organization_id,
                            "source": s.source,
                            "occurrences": s.occurrences,
                            "first_seen": s.first_seen,
                            "last_seen": s.last_seen,
                        }
                    )
                )
                continue

            results.append(
                EventTypeWithStats.model_validate(
                    {
                        "id": event_type.id,
                        "created_at": event_type.created_at,
                        "modified_at": event_type.modified_at,
                        "name": event_type.name,
                        "label": label,
                        "label_property_selector": event_type.label_property_selector,
                        "organization_id": event_type.organization_id,
                        "source": s.source,
                        "occurrences": s.occurrences,
                        "first_seen": s.first_seen,
                        "last_seen": s.last_seen,
                    }
                )
            )
        return results

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
