import uuid
from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import UnaryExpression, asc, desc, select, text

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.meter.repository import MeterRepository
from polar.models import Customer, Event, Organization, User, UserOrganization
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .repository import EventRepository
from .schemas import EventCreateCustomer, EventName, EventsIngest, EventsIngestResponse
from .sorting import EventNamesSortProperty, EventSortProperty


class EventError(PolarError): ...


class EventIngestValidationError(EventError):
    def __init__(self, errors: list[ValidationError]) -> None:
        self.errors = errors
        super().__init__("Event ingest validation failed.")


class EventService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_timestamp: datetime | None = None,
        end_timestamp: datetime | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        meter_id: uuid.UUID | None = None,
        name: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        metadata: MetadataQuery | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[EventSortProperty]] = [
            (EventSortProperty.timestamp, True)
        ],
    ) -> tuple[Sequence[Event], int]:
        repository = EventRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if start_timestamp is not None:
            statement = statement.where(Event.timestamp > start_timestamp)

        if end_timestamp is not None:
            statement = statement.where(Event.timestamp < end_timestamp)

        if organization_id is not None:
            statement = statement.where(Event.organization_id.in_(organization_id))

        if customer_id is not None:
            statement = statement.where(
                repository.get_customer_id_filter_clause(customer_id)
            )

        if external_customer_id is not None:
            statement = statement.where(
                repository.get_external_customer_id_filter_clause(external_customer_id)
            )

        if meter_id is not None:
            meter_repository = MeterRepository.from_session(session)
            meter = await meter_repository.get_readable_by_id(meter_id, auth_subject)
            if meter is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "meter_id",
                            "msg": "Meter not found.",
                            "loc": ("query", "meter_id"),
                            "input": meter_id,
                        }
                    ]
                )
            statement = statement.where(repository.get_meter_clause(meter))

        if name is not None:
            statement = statement.where(Event.name.in_(name))

        if source is not None:
            statement = statement.where(Event.source.in_(source))

        if metadata is not None:
            statement = apply_metadata_clause(Event, statement, metadata)

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == EventSortProperty.timestamp:
                order_by_clauses.append(clause_function(Event.timestamp))
        statement = statement.order_by(*order_by_clauses)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Event | None:
        repository = EventRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            Event.id == id
        )
        return await repository.get_one_or_none(statement)

    async def list_names(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        source: Sequence[EventSource] | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[EventNamesSortProperty]] = [
            (EventNamesSortProperty.last_seen, True)
        ],
    ) -> tuple[Sequence[EventName], int]:
        repository = EventRepository.from_session(session)
        statement = repository.get_event_names_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(Event.organization_id.in_(organization_id))

        if customer_id is not None:
            statement = statement.where(
                repository.get_customer_id_filter_clause(customer_id)
            )

        if external_customer_id is not None:
            statement = statement.where(
                repository.get_external_customer_id_filter_clause(external_customer_id)
            )

        if source is not None:
            statement = statement.where(Event.source.in_(source))

        if query is not None:
            statement = statement.where(Event.name.ilike(f"%{query}%"))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == EventNamesSortProperty.event_name:
                order_by_clauses.append(clause_function(Event.name))
            elif criterion == EventNamesSortProperty.first_seen:
                order_by_clauses.append(clause_function(text("first_seen")))
            elif criterion == EventNamesSortProperty.last_seen:
                order_by_clauses.append(clause_function(text("last_seen")))
            elif criterion == EventNamesSortProperty.occurrences:
                order_by_clauses.append(clause_function(text("occurrences")))
        statement = statement.order_by(*order_by_clauses)

        results, count = await paginate(session, statement, pagination=pagination)

        event_names: list[EventName] = []
        for result in results:
            event_name, event_source, occurrences, first_seen, last_seen = result
            event_names.append(
                EventName(
                    name=event_name,
                    source=event_source,
                    occurrences=occurrences,
                    first_seen=first_seen,
                    last_seen=last_seen,
                )
            )

        return event_names, count

    async def ingest(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        ingest: EventsIngest,
    ) -> EventsIngestResponse:
        validate_organization_id = await self._get_organization_validation_function(
            session, auth_subject
        )
        validate_customer_id = await self._get_customer_validation_function(
            session, auth_subject
        )

        events: list[dict[str, Any]] = []
        errors: list[ValidationError] = []
        for index, event_create in enumerate(ingest.events):
            try:
                organization_id = validate_organization_id(
                    index, event_create.organization_id
                )
                if isinstance(event_create, EventCreateCustomer):
                    validate_customer_id(index, event_create.customer_id)
            except EventIngestValidationError as e:
                errors.extend(e.errors)
                continue
            else:
                events.append(
                    {
                        "source": EventSource.user,
                        "organization_id": organization_id,
                        **event_create.model_dump(
                            exclude={"organization_id"}, by_alias=True
                        ),
                    }
                )

        if len(errors) > 0:
            raise PolarRequestValidationError(errors)

        repository = EventRepository.from_session(session)
        event_ids = await repository.insert_batch(events)

        enqueue_job("event.ingested", event_ids=event_ids)

        return EventsIngestResponse(inserted=len(events))

    async def ingested(
        self, session: AsyncSession, event_ids: Sequence[uuid.UUID]
    ) -> None:
        repository = EventRepository.from_session(session)
        statement = repository.get_base_statement().where(
            Event.id.in_(event_ids), Event.customer.is_not(None)
        )
        events = await repository.get_all(statement)
        customers: set[Customer] = set()
        for event in events:
            assert event.customer is not None
            customers.add(event.customer)

        for customer in customers:
            enqueue_job("customer_meter.update_customer", customer_id=customer.id)

    async def _get_organization_validation_function(
        self, session: AsyncSession, auth_subject: AuthSubject[User | Organization]
    ) -> Callable[[int, uuid.UUID | None], uuid.UUID]:
        if is_organization(auth_subject):

            def _validate_organization_id_by_organization(
                index: int, organization_id: uuid.UUID | None
            ) -> uuid.UUID:
                if organization_id is not None:
                    raise EventIngestValidationError(
                        [
                            {
                                "type": "organization_token",
                                "msg": (
                                    "Setting organization_id is disallowed "
                                    "when using an organization token."
                                ),
                                "loc": ("body", "events", index, "organization_id"),
                                "input": organization_id,
                            }
                        ]
                    )
                return auth_subject.subject.id

            return _validate_organization_id_by_organization

        statement = select(Organization.id).where(
            Organization.id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == auth_subject.subject.id,
                    UserOrganization.deleted_at.is_(None),
                )
            ),
        )
        result = await session.execute(statement)
        allowed_organizations = set(result.scalars().all())

        def _validate_organization_id_by_user(
            index: int, organization_id: uuid.UUID | None
        ) -> uuid.UUID:
            if organization_id is None:
                raise EventIngestValidationError(
                    [
                        {
                            "type": "missing",
                            "msg": "organization_id is required.",
                            "loc": ("body", "events", index, "organization_id"),
                            "input": None,
                        }
                    ]
                )
            if organization_id not in allowed_organizations:
                raise EventIngestValidationError(
                    [
                        {
                            "type": "organization_id",
                            "msg": "Organization not found.",
                            "loc": ("body", "events", index, "organization_id"),
                            "input": organization_id,
                        }
                    ]
                )

            return organization_id

        return _validate_organization_id_by_user

    async def _get_customer_validation_function(
        self, session: AsyncSession, auth_subject: AuthSubject[User | Organization]
    ) -> Callable[[int, uuid.UUID], uuid.UUID]:
        statement = select(Customer.id).where(Customer.deleted_at.is_(None))
        if is_user(auth_subject):
            statement = statement.where(
                Customer.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        else:
            statement = statement.where(
                Customer.organization_id == auth_subject.subject.id
            )
        result = await session.execute(statement)
        allowed_customers = set(result.scalars().all())

        def _validate_customer_id(index: int, customer_id: uuid.UUID) -> uuid.UUID:
            if customer_id not in allowed_customers:
                raise EventIngestValidationError(
                    [
                        {
                            "type": "customer_id",
                            "msg": "Customer not found.",
                            "loc": ("body", "events", index, "customer_id"),
                            "input": customer_id,
                        }
                    ]
                )

            return customer_id

        return _validate_customer_id


event = EventService()
