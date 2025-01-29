import uuid
from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import UnaryExpression, asc, desc, or_, select

from polar.auth.models import AuthSubject, is_organization
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.kit.metadata import MetadataQuery
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Event, Organization, User, UserOrganization
from polar.postgres import AsyncSession

from .repository import EventRepository
from .schemas import EventsIngest, EventsIngestResponse
from .sorting import EventSortProperty


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
        before: datetime | None = None,
        after: datetime | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        metadata: MetadataQuery | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[EventSortProperty]] = [
            (EventSortProperty.timestamp, True)
        ],
    ) -> tuple[Sequence[Event], int]:
        repository = EventRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if before is not None:
            statement = statement.where(Event.timestamp < before)

        if after is not None:
            statement = statement.where(Event.timestamp > after)

        if organization_id is not None:
            statement = statement.where(Event.organization_id.in_(organization_id))

        if metadata is not None:
            for key, values in metadata.items():
                clauses = []
                for value in values:
                    clauses.append(Event.user_metadata[key].astext == value)
                statement = statement.where(or_(*clauses))

        if customer_id is not None:
            statement = statement.where(Event.customer_id.in_(customer_id))

        if external_customer_id is not None:
            statement = statement.where(
                Event.external_customer_id.in_(external_customer_id)
            )

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

    async def ingest(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        ingest: EventsIngest,
    ) -> EventsIngestResponse:
        validate_organization_id = await self._get_organization_validation_function(
            session, auth_subject
        )

        events: list[dict[str, Any]] = []
        errors: list[ValidationError] = []
        for index, event_create in enumerate(ingest.events):
            try:
                organization_id = validate_organization_id(
                    index, event_create.organization_id
                )
            except EventIngestValidationError as e:
                errors.extend(e.errors)
                continue
            else:
                events.append(
                    {
                        "organization_id": organization_id,
                        **event_create.model_dump(
                            exclude={"organization_id"}, by_alias=True
                        ),
                    }
                )

        if len(errors) > 0:
            raise PolarRequestValidationError(errors)

        repository = EventRepository.from_session(session)
        await repository.insert_batch(events)

        return EventsIngestResponse(inserted=len(events))

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


event = EventService()
