"""Issue existing license keys to an organization's customers, without orders.

Each CSV row becomes a manual grant of a license key benefit that issues the
row's key with its own status, expiration and activation limit. Every row is
checked before anything is kept: one error and the whole import is rolled back.
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

import aiocsv
from fastapi import UploadFile
from pydantic import ValidationError
from sse_starlette.event import ServerSentEvent
from tagflow import document, tag, text

from polar.benefit.grant.schemas import BenefitGrantLicenseKeyCreate
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.benefit.repository import BenefitRepository
from polar.customer.repository import CustomerRepository
from polar.customer.service import customer as customer_service
from polar.exceptions import PolarError
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.models import Benefit, Customer, Organization
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.worker._enqueue import JobQueueManager

from ..components import alert
from .orders_import import DecodedUploadFile, RowError, _getter


class LicenseKeysImportError(PolarError):
    def __init__(self, errors: list[RowError]) -> None:
        self.errors = errors
        super().__init__("Errors encountered during import")


def _expires_at(value: str | None) -> datetime | None:
    """A date or datetime; without a timezone it's read as UTC."""
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def _license_key(row: dict[str, str]) -> BenefitGrantLicenseKeyCreate:
    data: dict[str, Any] = {
        "key": _getter(row, "key", "license_key"),
        "expires_at": _expires_at(_getter(row, "expires_at")),
        "limit_activations": _getter(row, "activation_limit", "limit_activations"),
    }
    status = _getter(row, "status")
    if status is not None:
        data["status"] = status
    return BenefitGrantLicenseKeyCreate.model_validate(data)


def _validation_message(error: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(part) for part in e['loc'])}: {e['msg']}"
        for e in error.errors()
    )


async def license_keys_import(
    session: AsyncSession, organization: Organization, file: UploadFile
) -> AsyncGenerator[tuple[int, int]]:
    customer_repository = CustomerRepository.from_session(session)
    benefit_repository = BenefitRepository.from_session(session)
    member_repository = MemberRepository.from_session(session)
    customers: dict[str, Customer] = {}
    benefits: dict[str, Benefit] = {}

    decoded_file = DecodedUploadFile(file)
    total_rows = 0
    async for _ in aiocsv.AsyncDictReader(decoded_file):
        total_rows += 1
    await file.seek(0)
    yield 0, total_rows

    errors: list[RowError] = []
    line = 1
    async for row in aiocsv.AsyncDictReader(decoded_file):
        line += 1
        yield line - 1, total_rows

        email = _getter(row, "email", "customer_email")
        if email is None:
            errors.append(RowError(line, "Missing email"))
            continue

        raw_benefit_id = _getter(row, "benefit_id")
        if raw_benefit_id is None:
            errors.append(RowError(line, "Missing benefit_id"))
            continue
        benefit = benefits.get(raw_benefit_id)
        if benefit is None:
            try:
                benefit_id = uuid.UUID(raw_benefit_id)
            except ValueError:
                errors.append(RowError(line, f"Invalid benefit_id: {raw_benefit_id}"))
                continue
            benefit = await benefit_repository.get_for_manual_grant(
                organization.id, benefit_id=benefit_id
            )
            if benefit is None:
                errors.append(RowError(line, f"Benefit not found: {raw_benefit_id}"))
                continue
            if benefit.type != BenefitType.license_keys:
                errors.append(
                    RowError(line, f"Not a license key benefit: {raw_benefit_id}")
                )
                continue
            benefits[raw_benefit_id] = benefit

        if _getter(row, "key", "license_key") is None:
            errors.append(RowError(line, "Missing key"))
            continue
        try:
            license_key = _license_key(row)
        except ValidationError as e:
            errors.append(RowError(line, _validation_message(e)))
            continue
        except ValueError:
            errors.append(RowError(line, "Invalid expires_at"))
            continue

        customer = customers.get(email)
        if customer is None:
            customer = await customer_repository.get_by_email_and_organization(
                email=email, organization_id=organization.id
            )
        if customer is None:
            customer = await customer_service.create_for_organization(
                session, organization, email=email, name=_getter(row, "name")
            )
        customers[email] = customer

        member = await member_repository.get_owner_by_customer_id(customer.id)
        if member is None:
            member = await member_service.create_owner_member(
                session, customer, organization
            )
        if member is None:
            errors.append(RowError(line, f"No owner member for {email}"))
            continue

        try:
            await benefit_grant_service.grant_manually(
                session,
                organization=organization,
                customer=customer,
                benefit=benefit,
                member=member,
                license_key=license_key,
            )
        except PolarError as e:
            errors.append(RowError(line, e.message))

    yield total_rows, total_rows

    if errors:
        await session.rollback()
        JobQueueManager.get().reset()
        raise LicenseKeysImportError(errors)
    await session.commit()


async def license_keys_import_sse(
    session: AsyncSession, organization: Organization, file: UploadFile
) -> AsyncGenerator[ServerSentEvent]:
    """Same as license_keys_import but yields progress for SSE."""
    try:
        async for done, total in license_keys_import(session, organization, file):
            with document() as d:
                with tag.progress(
                    classes="progress progress-primary w-full",
                    value=str(done),
                    max=str(total),
                ):
                    pass
                yield ServerSentEvent(d.to_html(), event="progress")
    except LicenseKeysImportError as e:
        with document() as d:
            with alert(
                variant="error", soft=True, classes="flex flex-col gap-2 items-start"
            ):
                with tag.div():
                    text("Import errors, no license key was issued:")
                with tag.ul(classes="list-disc list-inside"):
                    for error in e.errors:
                        with tag.li():
                            text(f"Row {error.index}: {error.message}")
            yield ServerSentEvent(d.to_html(), event="close")
    except Exception:
        with document() as d:
            with alert(variant="error", soft=True):
                text("An unexpected error occurred during import. Check server logs.")
            yield ServerSentEvent(d.to_html(), event="close")
        raise
    else:
        with document() as d:
            with alert(variant="success", soft=True):
                text("Import completed. License keys are issued in the background.")
            yield ServerSentEvent(d.to_html(), event="close")
