import uuid
from collections.abc import Callable
from typing import Any

from sqlalchemy import insert, select

from polar.auth.models import AuthSubject, is_organization
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.models import Event, Organization, User, UserOrganization
from polar.postgres import AsyncSession

from .schemas import EventsIngest


class EventError(PolarError): ...


class EventIngestValidationError(EventError):
    def __init__(self, errors: list[ValidationError]) -> None:
        self.errors = errors
        super().__init__("Event ingest validation failed.")


class EventService:
    async def ingest(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        ingest: EventsIngest,
    ) -> None:
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

        statement = insert(Event)
        await session.execute(statement, events)

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
