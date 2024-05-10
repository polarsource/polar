from typing import Protocol

from pydantic import UUID4

from polar.auth.models import AuthSubject, Subject, is_organization
from polar.exceptions import PolarRequestValidationError
from polar.models import Organization
from polar.postgres import AsyncSession


class OrganizationIDModel(Protocol):
    organization_id: UUID4 | None


async def get_payload_organization(
    session: AsyncSession,
    auth_subject: AuthSubject[Subject],
    model: OrganizationIDModel,
) -> Organization:
    # Avoids a circular import :(
    from polar.organization.service import organization as organization_service

    if is_organization(auth_subject):
        if model.organization_id is not None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "organization_token",
                        "msg": (
                            "Setting organization_id is disallowed "
                            "when using an organization token."
                        ),
                        "loc": (
                            "body",
                            "organization_id",
                        ),
                        "input": model.organization_id,
                    }
                ]
            )
        return auth_subject.subject

    if model.organization_id is None:
        raise PolarRequestValidationError(
            [
                {
                    "type": "missing",
                    "msg": "organization_id is required.",
                    "loc": (
                        "body",
                        "organization_id",
                    ),
                    "input": None,
                }
            ]
        )

    organization = await organization_service.get(session, model.organization_id)

    if organization is None:
        raise PolarRequestValidationError(
            [
                {
                    "loc": (
                        "body",
                        "organization_id",
                    ),
                    "msg": "Organization not found.",
                    "type": "value_error",
                    "input": model.organization_id,
                }
            ]
        )

    return organization
