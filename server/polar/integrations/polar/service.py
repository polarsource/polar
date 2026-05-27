import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, Any

import logfire
from polar_sdk.models import (
    CustomerPortalCustomerUpdate,
    LegacyRecurringProductPriceFixed,
    OrderBillingReason,
    ProductPriceFixed,
    SubscriptionProrationBehavior,
    WebhookBenefitGrantCreatedPayload,
    WebhookBenefitGrantRevokedPayload,
    WebhookBenefitGrantUpdatedPayload,
    WebhookOrderCreatedPayload,
)

from polar.account.repository import AccountRepository
from polar.auth.models import AuthSubject
from polar.config import settings
from polar.discount.repository import DiscountRepository
from polar.discount.schemas import DiscountPercentageCreate
from polar.discount.service import discount as discount_service
from polar.email.schemas import (
    EmailAdapter,
    PolarSelfSubscriptionConfirmationProps,
    PolarSelfSubscriptionCycledProps,
)
from polar.email.sender import Attachment, enqueue_email_template
from polar.integrations.plain.service import plain as plain_service
from polar.models import Discount, Organization
from polar.models.discount import DiscountDuration, DiscountType
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.worker import enqueue_job

from .client import get_client
from .exceptions import (
    PolarSelfCustomerNotFound,
    PolarSelfInvoiceNotReady,
    PolarSelfNoActiveSubscription,
    PolarSelfNotApproved,
    PolarSelfNotConfigured,
    PolarSelfNotPaidOrder,
    PolarSelfOrderNotFound,
    PolarSelfPlanNotFound,
    PolarSelfWebhookError,
    SupportBenefitError,
    TransactionFeeBenefitError,
)
from .schemas import (
    OrganizationBillingDetailsUpdate,
    OrganizationPlan,
)

if TYPE_CHECKING:
    from polar_sdk.models import (
        BenefitGrant,
        Checkout,
        Customer,
        CustomerPaymentMethod,
        CustomerPortalCustomer,
        Order,
        Product,
        Subscription,
        SubscriptionCustomer,
    )


BenefitGrantWebhookPayload = (
    WebhookBenefitGrantCreatedPayload
    | WebhookBenefitGrantUpdatedPayload
    | WebhookBenefitGrantRevokedPayload
)


SCALE_PLAN_NAME = "Scale"
STARTUP_PROGRAM_DISCOUNT_NAME = "Startup Program - Scale"


class PolarSelfService:
    INITIAL_MEMBER_DELAY_MS = 1000

    @property
    def is_configured(self) -> bool:
        return settings.POLAR_SELF_ENABLED

    def enqueue_create_customer(
        self,
        *,
        organization_id: uuid.UUID,
        name: str,
        slug: str,
        owner_external_id: str,
        owner_email: str,
        owner_name: str,
    ) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.create_customer",
            external_id=str(organization_id),
            name=name,
            slug=slug,
            owner_external_id=owner_external_id,
            owner_email=owner_email,
            owner_name=owner_name,
        )

    def enqueue_add_member(
        self,
        *,
        external_customer_id: str,
        email: str,
        name: str,
        external_id: str,
        delay: int | None = None,
    ) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.add_member",
            delay=delay,
            external_customer_id=external_customer_id,
            email=email,
            name=name,
            external_id=external_id,
        )

    def enqueue_update_member(
        self, *, external_customer_id: str, external_id: str, name: str
    ) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.update_member",
            external_customer_id=external_customer_id,
            external_id=external_id,
            name=name,
        )

    def enqueue_update_customer_slug(
        self, *, organization_id: uuid.UUID, slug: str
    ) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.update_customer_slug",
            external_id=str(organization_id),
            slug=slug,
        )

    def enqueue_remove_member(
        self, *, external_customer_id: str, external_id: str
    ) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.remove_member",
            external_customer_id=external_customer_id,
            external_id=external_id,
        )

    def enqueue_delete_customer(self, *, organization_id: uuid.UUID) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.delete_customer",
            external_id=str(organization_id),
        )

    def enqueue_track_organization_review_usage(
        self,
        *,
        external_customer_id: str,
        review_context: str,
        vendor: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: Decimal | float | None,
    ) -> None:
        if not self.is_configured:
            return
        if external_customer_id == settings.POLAR_ORGANIZATION_ID:
            return
        if cost_usd is None:
            return
        cost_decimal = Decimal(str(cost_usd))
        if cost_decimal <= 0:
            return
        enqueue_job(
            "polar_self.track_organization_review_usage",
            external_customer_id=external_customer_id,
            review_context=review_context,
            vendor=vendor,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=str(cost_decimal),
        )

    async def list_plans(self) -> list["Product"]:
        if not self.is_configured:
            raise PolarSelfNotConfigured()
        products = await get_client().list_recurring_products(
            organization_id=settings.POLAR_ORGANIZATION_ID
        )
        self_serve = [p for p in products if not (p.metadata or {}).get("custom")]
        return sorted(
            self_serve,
            key=lambda p: (p.metadata or {}).get("order", float("inf")),
        )

    async def resolve_free_plan(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        *,
        subscription: "Subscription | None",
    ) -> OrganizationPlan:
        """Return the synthesized free plan for an organization.

        Orgs on the free tier whose Account fees match the early-access constants
        get the "Early Member" variant; everyone else gets the standard "Free"
        plan with platform defaults. Subscribed orgs always see standard Free,
        since their Account fees reflect the active paid plan's grant.
        """
        if subscription is None:
            account = await AccountRepository.from_session(session).get_by_organization(
                organization_id
            )
            if account is not None and account.platform_fee == (
                settings.PLATFORM_FEE_BASIS_POINTS_EARLY_ACCESS,
                settings.PLATFORM_FEE_FIXED_EARLY_ACCESS,
                settings.PLATFORM_SUBSCRIPTION_FEE_BASIS_POINTS_EARLY_ACCESS,
            ):
                return OrganizationPlan.early_member(
                    fee_percent=settings.PLATFORM_FEE_BASIS_POINTS_EARLY_ACCESS,
                    fee_fixed=settings.PLATFORM_FEE_FIXED_EARLY_ACCESS,
                )
        return OrganizationPlan.free(
            fee_percent=settings.PLATFORM_FEE_BASIS_POINTS,
            fee_fixed=settings.PLATFORM_FEE_FIXED,
        )

    async def get_subscription(
        self, organization_id: uuid.UUID
    ) -> "Subscription | None":
        if not self.is_configured:
            raise PolarSelfNotConfigured()
        return await get_client().get_active_subscription(
            external_customer_id=str(organization_id)
        )

    async def start_checkout(
        self,
        *,
        session: AsyncSession,
        organization_id: uuid.UUID,
        product_id: str,
        customer_ip_address: str | None = None,
        success_url: str | None = None,
        return_url: str | None = None,
        embed_origin: str | None = None,
    ) -> "Checkout":
        if not self.is_configured:
            raise PolarSelfNotConfigured()
        plan = await self._ensure_plan(product_id)
        await self._require_approval(session, organization_id=organization_id)
        client = get_client()
        existing = await client.get_active_subscription(
            external_customer_id=str(organization_id)
        )
        discount_id = await self._resolve_startup_program_discount_id(
            session, plan=plan, organization_id=organization_id
        )
        return await client.create_checkout(
            product_id=product_id,
            external_customer_id=str(organization_id),
            subscription_id=existing.id if existing is not None else None,
            customer_ip_address=customer_ip_address,
            success_url=success_url,
            return_url=return_url,
            embed_origin=embed_origin,
            discount_id=discount_id,
        )

    async def change_plan(
        self,
        *,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        product_id: str,
    ) -> "Subscription":
        if not self.is_configured:
            raise PolarSelfNotConfigured()
        target_product = await self._ensure_plan(product_id)
        await self._require_approval(session, organization_id=organization_id)
        client = get_client()
        subscription = await client.get_active_subscription(
            external_customer_id=str(organization_id)
        )
        if subscription is None:
            raise PolarSelfNoActiveSubscription(organization_id)
        if subscription.cancel_at_period_end:
            subscription = await client.uncancel_subscription(
                subscription_id=subscription.id
            )
        target_amount = self._product_fixed_price_amount(target_product)
        proration = (
            SubscriptionProrationBehavior.INVOICE
            if target_amount > subscription.amount
            else SubscriptionProrationBehavior.NEXT_PERIOD
        )
        return await client.update_subscription_product(
            subscription_id=subscription.id,
            product_id=product_id,
            proration_behavior=proration,
        )

    async def cancel_subscription(
        self, *, organization_id: uuid.UUID
    ) -> "Subscription":
        if not self.is_configured:
            raise PolarSelfNotConfigured()
        client = get_client()
        subscription = await client.get_active_subscription(
            external_customer_id=str(organization_id)
        )
        if subscription is None:
            raise PolarSelfNoActiveSubscription(organization_id)
        return await client.cancel_subscription(subscription_id=subscription.id)

    async def list_orders(
        self,
        organization_id: uuid.UUID,
        *,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[list["Order"], int]:
        if not self.is_configured:
            raise PolarSelfNotConfigured()

        client = get_client()
        customer = await client.get_customer_by_external_id_or_none(
            str(organization_id)
        )
        if customer is None:
            return [], 0

        return await client.list_customer_orders(
            customer_id=customer.id,
            page=page,
            limit=limit,
        )

    async def get_billing_details(
        self,
        organization_id: uuid.UUID,
        *,
        external_member_id: str | None = None,
    ) -> "CustomerPortalCustomer":
        await self._ensure_polar_customer(organization_id)
        return await get_client().portal_get_customer(
            external_customer_id=str(organization_id),
            external_member_id=external_member_id,
        )

    async def create_customer_session(
        self,
        organization_id: uuid.UUID,
        *,
        external_member_id: str | None = None,
    ) -> str:
        """Create a customer session token for the org's Polar billing customer.

        Returned token authenticates against `/v1/customer-portal/customers/me/*`
        for the duration of its TTL."""
        await self._ensure_polar_customer(organization_id)
        return await get_client().portal_create_customer_session(
            external_customer_id=str(organization_id),
            external_member_id=external_member_id,
        )

    async def list_payment_methods(
        self,
        organization_id: uuid.UUID,
        *,
        external_member_id: str | None = None,
    ) -> tuple[list["CustomerPaymentMethod"], str | None]:
        await self._ensure_polar_customer(organization_id)
        client = get_client()
        customer = await client.portal_get_customer(
            external_customer_id=str(organization_id),
            external_member_id=external_member_id,
        )
        methods = await client.portal_list_payment_methods(
            external_customer_id=str(organization_id),
            external_member_id=external_member_id,
        )
        default_id = customer.default_payment_method_id
        return methods, default_id if isinstance(default_id, str) else None

    async def delete_payment_method(
        self,
        organization_id: uuid.UUID,
        *,
        payment_method_id: str,
        external_member_id: str | None = None,
    ) -> None:
        await self._ensure_polar_customer(organization_id)
        await get_client().portal_delete_payment_method(
            external_customer_id=str(organization_id),
            payment_method_id=payment_method_id,
            external_member_id=external_member_id,
        )

    async def set_default_payment_method(
        self,
        organization_id: uuid.UUID,
        *,
        payment_method_id: str,
        external_member_id: str | None = None,
    ) -> "CustomerPortalCustomer":
        await self._ensure_polar_customer(organization_id)
        return await get_client().portal_update_customer(
            external_customer_id=str(organization_id),
            update=CustomerPortalCustomerUpdate(
                default_payment_method_id=payment_method_id,
            ),
            external_member_id=external_member_id,
        )

    async def update_billing_details(
        self,
        organization_id: uuid.UUID,
        *,
        update: OrganizationBillingDetailsUpdate,
        external_member_id: str | None = None,
    ) -> "CustomerPortalCustomer":
        await self._ensure_polar_customer(organization_id)
        # Only forward fields the client explicitly sent so we don't
        # null out billing_address / tax_id on a partial update.
        sdk_update = CustomerPortalCustomerUpdate.model_validate(
            update.model_dump(exclude_unset=True, mode="json")
        )
        return await get_client().portal_update_customer(
            external_customer_id=str(organization_id),
            update=sdk_update,
            external_member_id=external_member_id,
        )

    async def _ensure_polar_customer(self, organization_id: uuid.UUID) -> None:
        if not self.is_configured:
            raise PolarSelfNotConfigured()
        customer = await get_client().get_customer_by_external_id_or_none(
            str(organization_id)
        )
        if customer is None:
            raise PolarSelfCustomerNotFound(organization_id)

    async def get_order_invoice_url(
        self, organization_id: uuid.UUID, order_id: str
    ) -> str:
        if not self.is_configured:
            raise PolarSelfNotConfigured()

        client = get_client()
        customer = await client.get_customer_by_external_id_or_none(
            str(organization_id)
        )
        if customer is None:
            raise PolarSelfOrderNotFound(order_id)

        order = await client.get_order(order_id=order_id)
        if order is None or order.customer_id != customer.id:
            raise PolarSelfOrderNotFound(order_id)

        url = await client.get_order_invoice(order_id=order_id)
        if url is None:
            raise PolarSelfOrderNotFound(order_id)
        return url

    async def handle_benefit_grant_event(
        self, session: AsyncSession, payload: BenefitGrantWebhookPayload
    ) -> None:
        grant = payload.data
        metadata = grant.benefit.metadata or {}
        benefit_type = metadata.get("type")

        organization_id = self._resolve_organization_id(grant.customer)

        with logfire.span(
            "polar_self.webhook.benefit_grant",
            event_type=payload.TYPE,
            benefit_id=grant.benefit_id,
            benefit_type=benefit_type,
            organization_id=str(organization_id),
        ):
            if not isinstance(benefit_type, str) or benefit_type not in (
                "transaction_fee",
                "support",
            ):
                return

            active_grant = await self._fetch_active_grant(
                grant.customer_id, benefit_type
            )

            match benefit_type:
                case "transaction_fee":
                    await self._apply_transaction_fee(
                        session, organization_id, active_grant
                    )
                case "support":
                    await self._apply_support(session, organization_id, active_grant)

    async def handle_order_created_event(
        self, payload: WebhookOrderCreatedPayload
    ) -> None:
        # The webhook payload reflects the order at creation time; fields like
        # ``is_invoice_generated`` flip to True later, so refetch over the API.
        client = get_client()
        order = await client.get_order(order_id=payload.data.id)
        if order is None:
            return

        if order.billing_reason not in (
            OrderBillingReason.SUBSCRIPTION_CREATE,
            OrderBillingReason.SUBSCRIPTION_UPDATE,
            OrderBillingReason.SUBSCRIPTION_CYCLE,
        ):
            return

        # Free orders (100% discount, $0 plans) shouldn't trigger an email.
        if order.net_amount == 0:
            return

        contacts = await client.list_billing_contacts(customer_id=order.customer.id)
        recipients = sorted({contact.email for contact in contacts if contact.email})
        if not recipients:
            return

        product_name = order.product.name if order.product is not None else "Polar"

        if order.billing_reason == OrderBillingReason.SUBSCRIPTION_CYCLE:
            template_name = "polar_self_subscription_cycled"
            subject = f"Your {product_name} subscription renewed"
        else:
            template_name = "polar_self_subscription_confirmation"
            subject = f"You're now on {product_name}"

        attachments: list[Attachment] | None = None
        invoice_expected = bool(order.billing_name and order.billing_address)
        if invoice_expected:
            if not order.is_invoice_generated:
                # Kick off PDF generation if the API hasn't done so yet, then
                # retry — generation runs asynchronously on Polar's side.
                try:
                    await client.trigger_order_invoice_generation(order_id=order.id)
                except PolarSelfNotPaidOrder as e:
                    raise PolarSelfInvoiceNotReady(order.id) from e
                raise PolarSelfInvoiceNotReady(order.id)

            invoice_url = await client.get_order_invoice(order_id=order.id)
            if invoice_url is None:
                raise PolarSelfInvoiceNotReady(order.id)
            attachments = [
                {
                    "remote_url": invoice_url,
                    "filename": f"{order.invoice_number}.pdf",
                }
            ]

        with logfire.span(
            "polar_self.webhook.order_created",
            order_id=order.id,
            billing_reason=order.billing_reason.value,
        ):
            for recipient in recipients:
                if template_name == "polar_self_subscription_confirmation":
                    email = EmailAdapter.validate_python(
                        {
                            "template": template_name,
                            "props": PolarSelfSubscriptionConfirmationProps(
                                email=recipient,
                                product_name=product_name,
                            ).model_dump(),
                        }
                    )
                else:
                    email = EmailAdapter.validate_python(
                        {
                            "template": template_name,
                            "props": PolarSelfSubscriptionCycledProps(
                                email=recipient,
                                product_name=product_name,
                            ).model_dump(),
                        }
                    )
                enqueue_email_template(
                    email,
                    to_email_addr=recipient,
                    subject=subject,
                    attachments=attachments,
                )

    async def _require_approval(
        self,
        session: AsyncReadSession,
        *,
        organization_id: uuid.UUID,
    ) -> None:
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            organization_id, include_blocked=True
        )
        if organization is None or not organization.is_active():
            raise PolarSelfNotApproved(organization_id)

    async def _ensure_plan(self, product_id: str) -> "Product":
        plans = await self.list_plans()
        plan = next((p for p in plans if p.id == product_id), None)
        if plan is None:
            raise PolarSelfPlanNotFound(product_id)
        return plan

    async def _resolve_startup_program_discount_id(
        self,
        session: AsyncSession,
        *,
        plan: "Product",
        organization_id: uuid.UUID,
    ) -> str | None:
        """For Scale checkouts by customers flagged ``startup_program_eligible``,
        return the ID of a 12-month 100% discount to auto-attach. Returns None
        for everyone else so non-eligible checkouts are unaffected."""
        if plan.name.lower() != SCALE_PLAN_NAME.lower():
            return None
        customer = await get_client().get_customer_by_external_id_or_none(
            str(organization_id)
        )
        if customer is None:
            return None
        metadata = customer.metadata or {}
        if not metadata.get("startup_program_eligible"):
            return None
        discount = await self._get_or_create_startup_discount(
            session, product_id=uuid.UUID(plan.id)
        )
        return str(discount.id)

    async def _get_or_create_startup_discount(
        self, session: AsyncSession, *, product_id: uuid.UUID
    ) -> Discount:
        polar_organization_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)
        discount_repository = DiscountRepository.from_session(session)
        existing = await discount_repository.get_redeemable_by_name_and_organization(
            name=STARTUP_PROGRAM_DISCOUNT_NAME,
            organization_id=polar_organization_id,
        )
        if existing is not None:
            return existing

        organization_repository = OrganizationRepository.from_session(session)
        polar_organization = await organization_repository.get_by_id(
            polar_organization_id
        )
        if polar_organization is None:
            raise PolarSelfNotConfigured()
        auth_subject: AuthSubject[Organization] = AuthSubject(
            subject=polar_organization, scopes=set(), session=None
        )
        return await discount_service.create(
            session,
            DiscountPercentageCreate(
                name=STARTUP_PROGRAM_DISCOUNT_NAME,
                type=DiscountType.percentage,
                basis_points=10000,
                duration=DiscountDuration.repeating,
                duration_in_months=12,
                max_redemptions=1,
                products=[product_id],
                organization_id=polar_organization_id,
            ),
            auth_subject,
        )

    def _product_fixed_price_amount(self, product: "Product") -> int:
        for price in product.prices:
            if isinstance(price, ProductPriceFixed | LegacyRecurringProductPriceFixed):
                return price.price_amount
        return 0

    def _resolve_organization_id(
        self, customer: "Customer | SubscriptionCustomer"
    ) -> uuid.UUID:
        raw = customer.external_id
        if not isinstance(raw, str):
            raise PolarSelfWebhookError(f"Customer {customer.id} has no external_id")
        try:
            return uuid.UUID(raw)
        except ValueError as e:
            raise PolarSelfWebhookError(
                f"Customer external_id is not a UUID: {raw!r}"
            ) from e

    def _extract_transaction_fee(
        self, metadata: dict[str, Any], benefit_id: str
    ) -> tuple[int, int, int]:
        return (
            self._parse_int_metadata(metadata, "fee_percent", benefit_id),
            self._parse_int_metadata(metadata, "fee_fixed", benefit_id),
            self._parse_int_metadata(metadata, "subscription_fee_percent", benefit_id),
        )

    def _parse_int_metadata(
        self, metadata: dict[str, Any], field: str, benefit_id: str
    ) -> int:
        value = metadata.get(field)
        if isinstance(value, bool):
            raise TransactionFeeBenefitError(
                f"Benefit {benefit_id} has invalid {field}: {value!r}"
            )
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str):
            try:
                return int(value)
            except ValueError as e:
                raise TransactionFeeBenefitError(
                    f"Benefit {benefit_id} has invalid {field}: {value!r}"
                ) from e
        raise TransactionFeeBenefitError(
            f"Benefit {benefit_id} has invalid {field}: {value!r}"
        )

    async def _apply_transaction_fee(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        grant: "BenefitGrant | None",
    ) -> None:
        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_organization(organization_id)
        if account is None:
            return

        if grant is None:
            fee_percent, fee_fixed, subscription_fee_percent = (
                settings.PLATFORM_FEE_BASIS_POINTS,
                settings.PLATFORM_FEE_FIXED,
                settings.PLATFORM_SUBSCRIPTION_FEE_BASIS_POINTS,
            )
        else:
            fee_percent, fee_fixed, subscription_fee_percent = (
                self._extract_transaction_fee(
                    grant.benefit.metadata or {}, grant.benefit_id
                )
            )

        # Inline: account.service → user_organization.service → this module.
        from polar.account.service import account as account_service

        with logfire.span(
            "polar_self.webhook.transaction_fee.applied",
            organization_id=str(organization_id),
            fee_percent=fee_percent,
            fee_fixed=fee_fixed,
            subscription_fee_percent=subscription_fee_percent,
        ):
            await account_service.set_platform_fee(
                session,
                account,
                fee_percent=fee_percent,
                fee_fixed=fee_fixed,
                subscription_fee_percent=subscription_fee_percent,
            )

    def _extract_support(
        self, metadata: dict[str, Any], benefit_id: str
    ) -> tuple[int, bool, bool, str | None]:
        level = self._parse_support_level(metadata, benefit_id)
        slack = self._parse_bool_metadata(metadata, "slack", benefit_id)
        prioritized = self._parse_bool_metadata(metadata, "prioritized", benefit_id)
        plain_tier_external_id = metadata.get("plain_tier_external_id")
        if plain_tier_external_id is not None and not (
            isinstance(plain_tier_external_id, str) and plain_tier_external_id
        ):
            raise SupportBenefitError(
                f"Benefit {benefit_id} has invalid plain_tier_external_id: "
                f"{plain_tier_external_id!r}"
            )
        return level, slack, prioritized, plain_tier_external_id

    def _parse_support_level(self, metadata: dict[str, Any], benefit_id: str) -> int:
        value = metadata.get("level")
        if isinstance(value, bool):
            raise SupportBenefitError(
                f"Benefit {benefit_id} has invalid level: {value!r}"
            )
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str):
            try:
                return int(value)
            except ValueError as e:
                raise SupportBenefitError(
                    f"Benefit {benefit_id} has invalid level: {value!r}"
                ) from e
        raise SupportBenefitError(f"Benefit {benefit_id} has invalid level: {value!r}")

    def _parse_bool_metadata(
        self, metadata: dict[str, Any], field: str, benefit_id: str
    ) -> bool:
        value = metadata.get(field)
        if isinstance(value, bool):
            return value
        if value == "true":
            return True
        if value == "false":
            return False
        raise SupportBenefitError(
            f"Benefit {benefit_id} has invalid {field}: {value!r}"
        )

    async def _apply_support(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        grant: "BenefitGrant | None",
    ) -> None:
        if grant is None:
            level: int | None = None
            slack: bool | None = None
            prioritized: bool | None = None
            plain_tier_external_id: str | None = None
        else:
            level, slack, prioritized, plain_tier_external_id = self._extract_support(
                grant.benefit.metadata or {}, grant.benefit_id
            )

        effective_tier_external_id = (
            plain_tier_external_id or settings.PLAIN_DEFAULT_TIER_EXTERNAL_ID
        )

        with logfire.span(
            "polar_self.webhook.support.applied",
            organization_id=str(organization_id),
            level=level,
            slack=slack,
            prioritized=prioritized,
            plain_tier_external_id=plain_tier_external_id,
            effective_tier_external_id=effective_tier_external_id,
        ):
            await plain_service.update_tenant_tier(
                tenant_external_id=str(organization_id),
                tier_external_id=effective_tier_external_id,
            )

    async def _fetch_active_grant(
        self, customer_id: str, benefit_type: str
    ) -> "BenefitGrant | None":
        grants = await get_client().list_customer_benefit_grants(
            customer_id=customer_id
        )
        matching = [
            grant
            for grant in grants
            if (grant.benefit.metadata or {}).get("type") == benefit_type
        ]
        if len(matching) > 1:
            benefit_ids = [grant.benefit_id for grant in matching]
            raise PolarSelfWebhookError(
                f"Customer {customer_id} holds {len(matching)} active "
                f"{benefit_type!r} benefit grants, expected at most 1: {benefit_ids}"
            )
        return matching[0] if matching else None


polar_self = PolarSelfService()
