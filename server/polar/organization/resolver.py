from typing import Protocol

from pydantic import UUID4

from polar.auth.models import AuthSubject, is_organization
from polar.authz.service import get_accessible_org_ids
from polar.exceptions import PolarRequestValidationError
from polar.models import Organization, User
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession


class _OrganizationIDModelNone(Protocol):
    organization_id: UUID4 | None


class _OrganizationIDModel(Protocol):
    organization_id: UUID4


OrganizationIDModel = _OrganizationIDModelNone | _OrganizationIDModel


async def get_payload_organization(
    session: AsyncSession,
    auth_subject: AuthSubject[User | Organization],
    model: OrganizationIDModel,
) -> Organization:
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

    accessible = await get_accessible_org_ids(session, auth_subject)
    if model.organization_id not in accessible:
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

    repository = OrganizationRepository.from_session(session)
    organization = await repository.get_by_id(model.organization_id)

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
