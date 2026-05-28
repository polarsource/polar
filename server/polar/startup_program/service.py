import uuid
from enum import StrEnum
from typing import TYPE_CHECKING

import structlog

from polar.config import settings
from polar.email.schemas import (
    PolarSelfStartupProgramWelcomeEmail,
    PolarSelfStartupProgramWelcomeProps,
)
from polar.email.sender import enqueue_email_template
from polar.exceptions import PolarError
from polar.integrations.polar.client import get_client
from polar.models import Organization

if TYPE_CHECKING:
    from polar_sdk.models import Discount

log = structlog.get_logger()


class StartupProgramStatus(StrEnum):
    invited = "invited"
    consumed = "consumed"


# Customer metadata key holding the pointer to the customer's dedicated
# Startup Program discount. Status is derived from the discount's
# ``redemptions_count`` — no separate status field.
DISCOUNT_ID_KEY = "startup_program_discount_id"

# Discount metadata tag, so a Startup Program discount is recognizable.
DISCOUNT_TAG_KEY = "startup_program"

# 100% off (basis points are 1/100th of a percent), for a full year, single use.
DISCOUNT_BASIS_POINTS = 10_000
DISCOUNT_DURATION_IN_MONTHS = 12
DISCOUNT_MAX_REDEMPTIONS = 1


class StartupProgramError(PolarError): ...


class StartupProgramService:
    """Startup Program logic, driven entirely through the Polar API.

    All reads and writes against billing-side entities (the Polar-for-Polar
    customer and its dedicated discount) go through the SDK client, so the
    API enforces auth scoping, soft-delete filtering, and tenancy. Status is
    derived from the discount's ``redemptions_count``: no discount or 404 =>
    not invited, ``redemptions_count >= 1`` => consumed, otherwise =>
    invited.
    """

    async def mark_invited(self, organization: Organization) -> "Discount":
        """Invite an organization to the Startup Program.

        Eagerly creates the customer's dedicated 100% / 12 month / single-use
        discount on the Scale plan and records its id on the
        Polar-for-Polar customer's metadata. Idempotent: if the customer
        already has a pointer to a live discount, returns that one. Any
        underlying SDK / network failure is logged and re-raised as a
        ``StartupProgramError`` so the caller (backoffice action) can toast
        the reason instead of 500-ing.
        """
        if not settings.STARTUP_PROGRAM_ENABLED:
            raise StartupProgramError(
                "Startup Program is not configured "
                "(POLAR_ORGANIZATION_ID / POLAR_SCALE_PRODUCT_ID / POLAR_ACCESS_TOKEN)."
            )

        try:
            return await self._mark_invited_inner(organization)
        except StartupProgramError:
            raise
        except Exception as e:
            log.exception(
                "startup_program.mark_invited_failed",
                organization_id=str(organization.id),
            )
            raise StartupProgramError(
                f"Failed to invite organization {organization.id}: {e}"
            ) from e

    async def _mark_invited_inner(self, organization: Organization) -> "Discount":
        from polar_sdk.models import DiscountDuration

        client = get_client()
        customer = await client.get_customer_by_external_id_or_none(
            str(organization.id)
        )
        if customer is None:
            raise StartupProgramError(
                "No Polar customer for organization "
                f"(organization_id={organization.id})."
            )

        existing = await self._load_existing_discount(customer)
        if existing is not None:
            return existing

        # ``organization_id`` is intentionally omitted: ``POLAR_ACCESS_TOKEN``
        # is an organization-scoped token, and the API rejects any explicit
        # ``organization_id`` on the request when that's the case.
        discount = await client.create_percentage_discount(
            name=self._discount_name(organization),
            basis_points=DISCOUNT_BASIS_POINTS,
            duration=DiscountDuration.REPEATING,
            duration_in_months=DISCOUNT_DURATION_IN_MONTHS,
            max_redemptions=DISCOUNT_MAX_REDEMPTIONS,
            products=[settings.POLAR_SCALE_PRODUCT_ID],
            metadata={
                DISCOUNT_TAG_KEY: "true",
                "customer_id": customer.id,
            },
        )

        # ``update_customer_metadata`` replaces metadata wholesale, so merge
        # the existing keys with our new pointer.
        merged_metadata = {
            **(customer.metadata or {}),
            DISCOUNT_ID_KEY: discount.id,
        }
        await client.update_customer_metadata(
            external_id=str(organization.id),
            metadata=merged_metadata,
        )

        log.info(
            "startup_program.mark_invited",
            organization_id=str(organization.id),
            customer_id=customer.id,
            discount_id=discount.id,
        )

        try:
            await self._send_welcome_email(
                organization=organization, customer_id=customer.id
            )
        except Exception:
            log.exception(
                "startup_program.welcome_email_failed",
                organization_id=str(organization.id),
                customer_id=customer.id,
            )

        return discount

    async def uninvite(self, organization: Organization) -> None:
        """Remove the organization's unused Startup Program discount.

        Only allowed when the discount hasn't been redeemed yet
        (``redemptions_count == 0``). Once consumed the discount is part of
        the customer's billing history and can't be revoked.

        The customer's ``startup_program_discount_id`` pointer is cleared
        on success so the status reads as "not invited" immediately.
        """
        if not settings.STARTUP_PROGRAM_ENABLED:
            raise StartupProgramError(
                "Startup Program is not configured "
                "(POLAR_ORGANIZATION_ID / POLAR_SCALE_PRODUCT_ID)."
            )

        client = get_client()
        customer = await client.get_customer_by_external_id_or_none(
            str(organization.id)
        )
        if customer is None:
            raise StartupProgramError(
                "No Polar customer for organization "
                f"(organization_id={organization.id})."
            )

        raw = (customer.metadata or {}).get(DISCOUNT_ID_KEY)
        if not isinstance(raw, str) or not raw:
            raise StartupProgramError(
                "Organization has no Startup Program discount to remove."
            )

        discount = await client.get_discount(discount_id=raw)
        if discount is not None and discount.redemptions_count >= 1:
            raise StartupProgramError(
                "Startup Program discount has already been redeemed and "
                "cannot be removed."
            )

        # ``get_discount`` returning None means the discount is already gone;
        # we still clear the pointer below so the customer metadata catches up.
        if discount is not None:
            await client.delete_discount(discount_id=raw)

        new_metadata = {k: v for k, v in (customer.metadata or {}).items() if k != DISCOUNT_ID_KEY}
        await client.update_customer_metadata(
            external_id=str(organization.id),
            metadata=new_metadata,
        )

        log.info(
            "startup_program.uninvited",
            organization_id=str(organization.id),
            customer_id=customer.id,
            discount_id=raw,
        )

    async def get_status(self, organization_id: uuid.UUID) -> str | None:
        """Return the Startup Program status for an organization, if any.

        ``None`` when the feature is disabled, the org has no Polar customer,
        no discount pointer, or the discount has been deleted (the API
        returns 404 → we treat as "not invited"). ``invited`` when the
        discount exists with ``redemptions_count == 0``; ``consumed`` once
        it's been redeemed.
        """
        discount = await self._get_customer_discount(organization_id)
        if discount is None:
            return None
        if discount.redemptions_count >= 1:
            return StartupProgramStatus.consumed.value
        return StartupProgramStatus.invited.value

    async def resolve_checkout_discount_id(
        self, *, organization_id: uuid.UUID, product_id: str
    ) -> str | None:
        """Return the discount id to attach to a Polar-for-Polar checkout.

        ``None`` unless the feature is enabled, the product is the Scale
        plan, and the organization has an invited (still redeemable)
        Startup Program discount.
        """
        if not settings.STARTUP_PROGRAM_ENABLED:
            return None
        if product_id != settings.POLAR_SCALE_PRODUCT_ID:
            return None
        discount = await self._get_customer_discount(organization_id)
        if discount is None:
            return None
        max_redemptions = discount.max_redemptions
        if max_redemptions is not None and discount.redemptions_count >= max_redemptions:
            return None
        return discount.id

    async def _get_customer_discount(
        self, organization_id: uuid.UUID
    ) -> "Discount | None":
        """Resolve the customer's Startup Program discount via the Polar API.

        Best-effort: any SDK failure (auth, network, unexpected response) is
        logged and returns ``None``. This method is on the billing-page read
        path; we'd rather degrade to "not invited" than 500 the dashboard.
        """
        if not settings.STARTUP_PROGRAM_ENABLED:
            return None
        try:
            client = get_client()
            customer = await client.get_customer_by_external_id_or_none(
                str(organization_id)
            )
            if customer is None:
                return None
            raw = (customer.metadata or {}).get(DISCOUNT_ID_KEY)
            if not isinstance(raw, str) or not raw:
                return None
            return await client.get_discount(discount_id=raw)
        except Exception:
            log.exception(
                "startup_program.get_status_failed",
                organization_id=str(organization_id),
            )
            return None

    async def _load_existing_discount(self, customer: object) -> "Discount | None":
        raw = (getattr(customer, "metadata", None) or {}).get(DISCOUNT_ID_KEY)
        if not isinstance(raw, str) or not raw:
            return None
        return await get_client().get_discount(discount_id=raw)

    async def _send_welcome_email(
        self, *, organization: Organization, customer_id: str
    ) -> None:
        """Enqueue a "Welcome to the Startup Program" email to each team member.

        Recipients come from the Polar API's billing-contacts endpoint
        (matches the order webhook's recipient pattern). Best-effort: caller
        wraps in try/except so any failure is logged but doesn't block the
        invite.
        """
        client = get_client()
        contacts = await client.list_billing_contacts(customer_id=customer_id)
        recipients = sorted({c.email for c in contacts if c.email})
        if not recipients:
            return

        billing_url = (
            f"{settings.FRONTEND_BASE_URL.rstrip('/')}"
            f"/dashboard/{organization.slug}/settings/billing/change-plan"
        )

        for recipient in recipients:
            email = PolarSelfStartupProgramWelcomeEmail(
                props=PolarSelfStartupProgramWelcomeProps(
                    email=recipient,
                    organization_name=organization.name,
                    billing_url=billing_url,
                ),
            )
            enqueue_email_template(
                email,
                to_email_addr=recipient,
                subject="Welcome to the Polar Startup Program",
            )

    def _discount_name(self, organization: Organization) -> str:
        return f"Startup Program: {organization.name}"


startup_program = StartupProgramService()
