from typing import Protocol

from fastapi.exceptions import RequestValidationError
from pydantic import UUID4
from pydantic_core import InitErrorDetails, PydanticCustomError

from polar.auth.models import AuthSubject, Subject, is_organization
from polar.models import Organization
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession


class OrganizationIDModel(Protocol):
    organization_id: UUID4 | None


class PayloadOrganizationValidationError(RequestValidationError):
    def __init__(self, value: UUID4) -> None:
        errors: list[InitErrorDetails] = [
            {
                "type": PydanticCustomError(
                    "organization_token",
                    "Setting organization_id is disallowed when using an organization token.",
                ),
                "loc": ("organization_id",),
                "input": value,
            }
        ]
        super().__init__(errors)


async def get_payload_organization(
    session: AsyncSession,
    auth_subject: AuthSubject[Subject],
    model: OrganizationIDModel,
) -> Organization:
    if is_organization(auth_subject):
        if model.organization_id is not None:
            raise RequestValidationError(
                [
                    {
                        "type": PydanticCustomError(
                            "organization_token",
                            "Setting organization_id is disallowed when using an organization token.",
                        ),
                        "loc": ("organization_id",),
                        "input": model.organization_id,
                    }
                ]
            )
        return auth_subject.subject

    if model.organization_id is None:
        raise RequestValidationError(
            [
                {
                    "type": "missing",
                    "loc": ("organization_id",),
                }
            ]
        )

    organization = await organization_service.get(session, model.organization_id)

    if organization is None:
        raise RequestValidationError(
            [
                {
                    "type": PydanticCustomError(
                        "invalid_organization", "This organization does not exist."
                    ),
                    "loc": ("organization_id",),
                    "input": model.organization_id,
                }
            ]
        )

    return organization
