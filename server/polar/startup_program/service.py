import uuid
from enum import StrEnum

import structlog
from sqlalchemy import select

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.discount.repository import DiscountRepository
from polar.email.schemas import (
    PolarSelfStartupProgramWelcomeEmail,
    PolarSelfStartupProgramWelcomeProps,
)
from polar.email.sender import enqueue_email_template
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.member.repository import MemberRepository
from polar.models import Customer, Discount, DiscountProduct
from polar.models.discount import (
    DiscountDuration,
    DiscountPercentage,
    DiscountType,
)
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository

log = structlog.get_logger()


class StartupProgramStatus(StrEnum):
    invited = "invited"
    consumed = "consumed"


# The only piece of state we store on the Polar-for-Polar customer (the
# customer in Polar's own organization whose ``external_id`` is the
# originating organization's id) is a pointer to the dedicated discount.
# The status (``invited`` / ``consumed`` / ``None``) is derived from that
# discount's redemption count, so there's no second source of truth that can
# drift from the actual redemption state.
DISCOUNT_ID_KEY = "startup_program_discount_id"

# Discount metadata tag, so a Startup Program discount is recognizable.
DISCOUNT_TAG_KEY = "startup_program"

# 100% off (basis points are 1/100th of a percent), for a full year, once.
DISCOUNT_BASIS_POINTS = 10_000
DISCOUNT_DURATION_IN_MONTHS = 12
DISCOUNT_MAX_REDEMPTIONS = 1


class StartupProgramError(PolarError): ...


class StartupProgramService:
    """Startup Program logic, driven entirely from the Polar-for-Polar side.

    Status is derived from the customer's dedicated discount: no discount =>
    not in the program; discount with redemptions_count >= 1 => consumed;
    otherwise => invited. The "applied" / "rejected" lifecycle states from
    the public apply flow live elsewhere and are out of scope here.
    """

    async def mark_invited(self, session: AsyncSession, customer: Customer) -> Discount:
        """Invite a Polar-for-Polar customer to the Startup Program.

        Eagerly creates the customer's dedicated 100% / 12 month / single-use
        discount on the Scale plan and stores its id on the customer's
        metadata. Idempotent: returns the existing discount when the
        customer's pointer still resolves.
        """
        if not settings.STARTUP_PROGRAM_ENABLED:
            raise StartupProgramError(
                "Startup Program is not configured "
                "(POLAR_ORGANIZATION_ID / POLAR_SCALE_PRODUCT_ID)."
            )

        polar_organization_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)
        if customer.organization_id != polar_organization_id:
            raise StartupProgramError(
                "Customer does not belong to the Polar organization "
                f"(customer_id={customer.id}, "
                f"customer_org_id={customer.organization_id}, "
                f"expected_polar_org_id={polar_organization_id})."
            )

        metadata = dict(customer.user_metadata)
        discount_repository = DiscountRepository.from_session(session)

        existing = await self._load_active_discount(
            session, metadata.get(DISCOUNT_ID_KEY)
        )
        if existing is not None:
            return existing

        product_repository = ProductRepository.from_session(session)
        scale_product = await product_repository.get_by_id_and_organization(
            uuid.UUID(settings.POLAR_SCALE_PRODUCT_ID), polar_organization_id
        )
        if scale_product is None:
            raise StartupProgramError(
                f"Scale product {settings.POLAR_SCALE_PRODUCT_ID} not found."
            )

        discount_percentage = DiscountPercentage(
            name=self._discount_name(customer),
            type=DiscountType.percentage,
            code=None,
            starts_at=None,
            ends_at=None,
            max_redemptions=DISCOUNT_MAX_REDEMPTIONS,
            duration=DiscountDuration.repeating,
            duration_in_months=DISCOUNT_DURATION_IN_MONTHS,
            basis_points=DISCOUNT_BASIS_POINTS,
            redemptions_count=0,
            organization_id=polar_organization_id,
            discount_products=[DiscountProduct(product=scale_product)],
            discount_redemptions=[],
            user_metadata={
                DISCOUNT_TAG_KEY: "true",
                "customer_id": str(customer.id),
            },
        )
        discount = await discount_repository.create(discount_percentage, flush=True)

        metadata[DISCOUNT_ID_KEY] = str(discount.id)
        customer.user_metadata = metadata
        session.add(customer)
        await session.flush()

        log.info(
            "startup_program.mark_invited",
            customer_id=str(customer.id),
            discount_id=str(discount.id),
        )

        try:
            await self._send_welcome_email(session, customer)
        except Exception:
            log.exception(
                "startup_program.welcome_email_failed",
                customer_id=str(customer.id),
            )

        return discount

    async def get_status(
        self, session: AsyncReadSession, organization_id: uuid.UUID
    ) -> str | None:
        """Return the Startup Program status for an organization, if any.

        Derived from the customer's stored discount. Returns ``None`` when
        the feature is disabled, the customer doesn't exist, the customer has
        no Startup Program discount, or the discount no longer exists.
        Otherwise returns ``invited`` (discount unused) or ``consumed``
        (discount redeemed).
        """
        discount = await self._get_customer_discount(session, organization_id)
        if discount is None:
            return None
        if discount.redemptions_count >= 1:
            return StartupProgramStatus.consumed.value
        return StartupProgramStatus.invited.value

    async def resolve_checkout_discount_id(
        self,
        session: AsyncReadSession,
        *,
        organization_id: uuid.UUID,
        product_id: str,
    ) -> uuid.UUID | None:
        """Return the discount id to attach to a Polar-for-Polar checkout.

        Returns ``None`` unless the feature is enabled, the product is the
        Scale plan, the organization's customer has an invited (still
        redeemable) Startup Program discount. Read-only.
        """
        if not settings.STARTUP_PROGRAM_ENABLED:
            return None
        if product_id != settings.POLAR_SCALE_PRODUCT_ID:
            return None

        discount = await self._get_customer_discount(session, organization_id)
        if discount is None or not self._is_redeemable(discount):
            return None
        return discount.id

    async def _send_welcome_email(
        self, session: AsyncSession, customer: Customer
    ) -> None:
        """Enqueue a "Welcome to the Startup Program" email to each team member.

        The Polar-for-Polar customer is a team customer (no direct email), so
        recipients come from the customer's members. Best-effort: caller
        wraps in try/except so any failure is logged but doesn't block the
        invite.
        """
        if not customer.external_id:
            return
        try:
            organization_id = uuid.UUID(customer.external_id)
        except ValueError:
            return

        organization = await OrganizationRepository.from_session(session).get_by_id(
            organization_id, include_blocked=True
        )
        if organization is None:
            return

        members = await MemberRepository.from_session(session).list_by_customer(
            customer.id
        )
        recipients = sorted({m.email for m in members if m.email})
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

    async def _get_customer_discount(
        self, session: AsyncReadSession, organization_id: uuid.UUID
    ) -> Discount | None:
        """Load the Startup Program discount for the org, if any.

        Resolves the Polar-for-Polar customer by ``external_id``, follows the
        ``startup_program_discount_id`` pointer, and returns the discount.
        Returns ``None`` when the feature is disabled, the customer or
        pointer don't exist, or the discount has been (soft-)deleted —
        deletion intentionally reads as "not invited" so admins can revoke an
        invitation by deleting the discount.
        """
        if not settings.STARTUP_PROGRAM_ENABLED:
            return None
        customer = await self._get_polar_customer(session, organization_id)
        if customer is None:
            return None
        return await self._load_active_discount(
            session, customer.user_metadata.get(DISCOUNT_ID_KEY)
        )

    async def _load_active_discount(
        self, session: AsyncReadSession, discount_id_raw: object
    ) -> Discount | None:
        """Load a non-deleted discount by id.

        Used wherever we follow the customer's ``startup_program_discount_id``
        pointer — ``DiscountRepository.get_by_id`` doesn't filter soft-deleted
        rows, but for the Startup Program a deleted discount should read as
        "no discount" so deletion can be used to revoke an invitation.
        """
        if not discount_id_raw:
            return None
        try:
            discount_id = uuid.UUID(str(discount_id_raw))
        except ValueError:
            return None
        statement = select(Discount).where(
            Discount.id == discount_id,
            Discount.is_deleted.is_(False),
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def _get_polar_customer(
        self, session: AsyncReadSession, organization_id: uuid.UUID
    ) -> Customer | None:
        polar_organization_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)
        customer_repository = CustomerRepository.from_session(session)
        return await customer_repository.get_by_external_id_and_organization(
            str(organization_id), polar_organization_id
        )

    def _is_redeemable(self, discount: Discount) -> bool:
        # Mirrors discount_service.is_redeemable_discount, read-only so it
        # can run on start_checkout's read session.
        now = utc_now()
        if discount.starts_at is not None and discount.starts_at > now:
            return False
        if discount.ends_at is not None and discount.ends_at < now:
            return False
        if discount.max_redemptions is not None:
            return discount.redemptions_count < discount.max_redemptions
        return True

    def _discount_name(self, customer: Customer) -> str:
        label = customer.name or customer.email or str(customer.id)
        return f"Startup Program: {label}"


startup_program = StartupProgramService()
