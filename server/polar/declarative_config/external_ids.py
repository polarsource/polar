from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from sqlalchemy import Select

from polar.benefit.repository import BenefitRepository
from polar.exceptions import PolarRequestValidationError, ValidationError
from polar.meter.repository import MeterRepository
from polar.models import Benefit, Meter, Organization, Product
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository

from .schemas import ConfigExternalIDAssignment, ConfigResource


class _Repository[M: Meter | Benefit | Product](Protocol):
    def get_organization_statement(self, organization_id: UUID) -> Select[M]: ...

    async def get_all(self, statement: Select[M]) -> Sequence[M]: ...

    async def get_all_by_external_ids(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> Sequence[M]: ...


def _error(
    index: int, assignment: ConfigExternalIDAssignment, message: str
) -> ValidationError:
    return {
        "type": "value_error",
        "loc": ("body", "external_ids", index, "external_id"),
        "msg": message,
        "input": assignment.external_id,
    }


async def _check[M: Meter | Benefit | Product](
    repository: _Repository[M],
    model: type[M],
    organization: Organization,
    resource: ConfigResource,
    assignments: Sequence[ConfigExternalIDAssignment],
    errors: list[ValidationError],
) -> list[tuple[M, str]]:
    indexed = [
        (index, assignment)
        for index, assignment in enumerate(assignments)
        if assignment.resource == resource
    ]
    if not indexed:
        return []
    found = {
        item.id: item
        for item in await repository.get_all(
            repository.get_organization_statement(organization.id).where(
                model.id.in_([assignment.id for _, assignment in indexed])
            )
        )
    }
    taken = {
        item.external_id
        for item in await repository.get_all_by_external_ids(
            organization.id, [assignment.external_id for _, assignment in indexed]
        )
    }
    pending: list[tuple[M, str]] = []
    seen: set[UUID] = set()
    for index, assignment in indexed:
        item = found.get(assignment.id)
        if assignment.id in seen:
            errors.append(
                _error(index, assignment, f"This {resource} is assigned twice.")
            )
        elif item is None:
            errors.append(_error(index, assignment, f"No {resource} has this ID."))
        elif item.external_id == assignment.external_id:
            continue
        elif item.external_id is not None:
            errors.append(
                _error(
                    index, assignment, f"This {resource} already has an external ID."
                )
            )
        elif assignment.external_id in taken:
            errors.append(
                _error(
                    index,
                    assignment,
                    f"Another {resource} already has this external ID.",
                )
            )
        else:
            pending.append((item, assignment.external_id))
            taken.add(assignment.external_id)
        seen.add(assignment.id)
    return pending


async def assign(
    session: AsyncSession,
    organization: Organization,
    assignments: Sequence[ConfigExternalIDAssignment],
) -> None:
    """Give existing resources without an `external_id` the requested one.

    Resources without an `external_id` have a single version, so the row is
    updated in place.
    """
    errors: list[ValidationError] = []
    pending: list[tuple[Meter | Benefit | Product, str]] = [
        *await _check(
            MeterRepository.from_session(session),
            Meter,
            organization,
            ConfigResource.meter,
            assignments,
            errors,
        ),
        *await _check(
            BenefitRepository.from_session(session),
            Benefit,
            organization,
            ConfigResource.benefit,
            assignments,
            errors,
        ),
        *await _check(
            ProductRepository.from_session(session),
            Product,
            organization,
            ConfigResource.product,
            assignments,
            errors,
        ),
    ]
    if errors:
        raise PolarRequestValidationError(errors)
    for item, external_id in pending:
        item.external_id = external_id
    await session.flush()
