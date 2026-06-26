import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, Any

import logfire
from polar_sdk.models import (
    CustomerBenefitGrantSlackSharedChannel,
    CustomerBenefitGrantSlackSharedChannelPropertiesUpdate,
    CustomerBenefitGrantSlackSharedChannelUpdate,
    CustomerPortalCustomerUpdate,
    LegacyRecurringProductPriceFixed,
    OrderBillingReason,
    ProductPriceFixed,
    SubscriptionProrationBehavior,
    WebhookBenefitGrantCreatedPayload,
    WebhookBenefitGrantRevokedPayload,
    WebhookBenefitGrantUpdatedPayload,
    WebhookOrderCreatedPayload,
    WebhookSubscriptionCanceledPayload,
    WebhookSubscriptionPastDuePayload,
    WebhookSubscriptionRevokedPayload,
)

from polar.account.repository import AccountRepository
from polar.config import settings
from polar.email.schemas import (
    EmailAdapter,
    PolarSelfSubscriptionCancellationProps,
    PolarSelfSubscriptionConfirmationProps,
    PolarSelfSubscriptionCycledProps,
    PolarSelfSubscriptionPastDueProps,
    PolarSelfSubscriptionRevokedProps,
)
from polar.email.sender import Attachment, enqueue_email_template
from polar.integrations.plain.service import plain as plain_service
from polar.models.member import MemberRole
from polar.models.organization import SupportTier
from polar.models.user_organization import OrganizationRole
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.startup_program.service import (
    StartupProgramError,
)
from polar.startup_program.service import (
    startup_program as startup_program_service,
)
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
    OrganizationBenefitGrantUpdate,
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


def billing_member_role(organization_role: OrganizationRole) -> MemberRole:
    if organization_role in (OrganizationRole.owner, OrganizationRole.admin):
        return MemberRole.billing_manager
    return MemberRole.member


class PolarSelfService:
    INITIAL_MEMBER_DELAY_MS = 1000

    PREVIEW_ACCESS_FEATURE_FLAGS = (
        "reset_proration_behavior_enabled",
        "off_session_charges_enabled",
        "slack_benefit_enabled",
        "preview_access_enabled",
    )

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
        role: MemberRole = MemberRole.member,
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
            role=role.value,
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
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        product_id: str,
        customer_ip_address: str | None = None,
        success_url: str | None = None,
        return_url: str | None = None,
        embed_origin: str | None = None,
    ) -> "Checkout":
        if not self.is_configured:
            raise PolarSelfNotConfigured()
        await self._ensure_plan(product_id)
        await self._require_approval(session, organization_id=organization_id)
        client = get_client()
        existing = await client.get_active_subscription(
            external_customer_id=str(organization_id)
        )
        # Auto-apply the Startup Program discount when an eligible organization
        # checks out the Scale plan.
        discount_id = await startup_program_service.resolve_checkout_discount_id(
            organization_id=organization_id, product_id=product_id
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

        # Apply the Startup Program's discount BEFORE switching the product, so
        # the proration computed at product-switch reflects the discounted
        # amount. The discount is no longer product-scoped, so the API accepts
        # it on the current product and carries it through the switch. Only the
        # Scale plan is eligible, so we only attach when switching to Scale.
        # Mirror ``start_checkout``: without this a Pro/Growth -> Scale switch
        # via the Change Plan page would skip the Startup Program discount even
        # when the org is invited.
        if product_id == settings.POLAR_SCALE_PRODUCT_ID:
            discount_id = await startup_program_service.resolve_checkout_discount_id(
                organization_id=organization_id, product_id=product_id
            )
            if discount_id is not None:
                subscription = await client.update_subscription_discount(
                    subscription_id=subscription.id, discount_id=discount_id
                )
        elif subscription.discount_id is not None:
            # Switching away from Scale to a non-eligible plan: the Startup
            # Program discount only applies to Scale. Since the discount is no
            # longer product-scoped, it would otherwise carry onto the new plan,
            # so clear it before the switch.
            subscription = await client.update_subscription_discount(
                subscription_id=subscription.id, discount_id=None
            )

        target_amount = self._product_fixed_price_amount(target_product)
        proration = (
            SubscriptionProrationBehavior.INVOICE
            if target_amount > subscription.amount
            else SubscriptionProrationBehavior.NEXT_PERIOD
        )
        subscription = await client.update_subscription_product(
            subscription_id=subscription.id,
            product_id=product_id,
            proration_behavior=proration,
        )

        return subscription

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

    async def claim_startup_program(
        self,
        *,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        customer_ip_address: str | None = None,
        success_url: str | None = None,
        return_url: str | None = None,
        embed_origin: str | None = None,
    ) -> "tuple[Subscription | None, Checkout | None]":
        """Claim the Startup Program discount on the Scale plan.

        Single entry point for the "Switch to Scale" callout, regardless of
        current plan:

        - **Free → Scale**: returns ``(None, Checkout)`` — the org needs to
          complete a Polar checkout to set up a payment method. The discount
          is auto-attached at checkout creation.
        - **Paid → Scale**: returns ``(Subscription, None)`` — the existing
          subscription is switched to Scale via PATCH and the discount is
          applied immediately. No checkout flow needed.
        """
        if not self.is_configured:
            raise PolarSelfNotConfigured()
        if not settings.STARTUP_PROGRAM_ENABLED:
            raise StartupProgramError("Startup Program is not configured.")
        await self._require_approval(session, organization_id=organization_id)

        discount_id = await startup_program_service.resolve_checkout_discount_id(
            organization_id=organization_id,
            product_id=settings.POLAR_SCALE_PRODUCT_ID,
        )
        if discount_id is None:
            raise StartupProgramError(
                "Organization has no claimable Startup Program discount "
                f"(organization_id={organization_id})."
            )

        client = get_client()
        subscription = await client.get_active_subscription(
            external_customer_id=str(organization_id)
        )

        if subscription is None:
            # Free plan → needs checkout to set up a payment method. The
            # discount auto-attaches because we pass discount_id explicitly.
            checkout = await client.create_checkout(
                product_id=settings.POLAR_SCALE_PRODUCT_ID,
                external_customer_id=str(organization_id),
                subscription_id=None,
                customer_ip_address=customer_ip_address,
                success_url=success_url,
                return_url=return_url,
                embed_origin=embed_origin,
                discount_id=discount_id,
            )
            return (None, checkout)

        if subscription.cancel_at_period_end:
            subscription = await client.uncancel_subscription(
                subscription_id=subscription.id
            )

        needs_switch = subscription.product_id != settings.POLAR_SCALE_PRODUCT_ID

        # Attach the discount BEFORE switching the product so the proration
        # computed at the switch reflects the 100% discount (a $0 prorated
        # charge). The discount is no longer product-scoped, so the API accepts
        # it on the current product and carries it through the switch.
        subscription = await client.update_subscription_discount(
            subscription_id=subscription.id,
            discount_id=discount_id,
        )

        if needs_switch:
            # Upgrade-to-Scale always invoices immediately; with the discount
            # already in place the API computes a $0 prorated charge.
            subscription = await client.update_subscription_product(
                subscription_id=subscription.id,
                product_id=settings.POLAR_SCALE_PRODUCT_ID,
                proration_behavior=SubscriptionProrationBehavior.INVOICE,
            )

        return (subscription, None)

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

    async def list_benefit_grants(
        self,
        organization_id: uuid.UUID,
        *,
        external_member_id: str | None = None,
    ) -> list[CustomerBenefitGrantSlackSharedChannel]:
        await self._ensure_polar_customer(organization_id)
        grants = await get_client().portal_list_benefit_grants(
            external_customer_id=str(organization_id),
            external_member_id=external_member_id,
        )
        return [
            grant
            for grant in grants
            if isinstance(grant, CustomerBenefitGrantSlackSharedChannel)
        ]

    async def update_benefit_grant(
        self,
        organization_id: uuid.UUID,
        *,
        benefit_grant_id: str,
        update: OrganizationBenefitGrantUpdate,
        external_member_id: str | None = None,
    ) -> CustomerBenefitGrantSlackSharedChannel:
        await self._ensure_polar_customer(organization_id)
        grant = await get_client().portal_update_benefit_grant(
            external_customer_id=str(organization_id),
            benefit_grant_id=benefit_grant_id,
            update=CustomerBenefitGrantSlackSharedChannelUpdate(
                properties=CustomerBenefitGrantSlackSharedChannelPropertiesUpdate(
                    invited_email=update.invited_email,
                ),
            ),
            external_member_id=external_member_id,
        )
        assert isinstance(grant, CustomerBenefitGrantSlackSharedChannel)
        return grant

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
                "preview_access",
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
                case "preview_access":
                    await self._apply_preview_access(
                        session, organization_id, active_grant
                    )

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

    async def handle_subscription_canceled_event(
        self, payload: WebhookSubscriptionCanceledPayload
    ) -> None:
        subscription = payload.data
        context = await self._resolve_subscription_email_context(subscription)
        if context is None:
            return
        recipients, product_name = context
        ends_at = subscription.ends_at.isoformat() if subscription.ends_at else None

        with logfire.span(
            "polar_self.webhook.subscription_canceled",
            subscription_id=subscription.id,
        ):
            for recipient in recipients:
                email = EmailAdapter.validate_python(
                    {
                        "template": "polar_self_subscription_cancellation",
                        "props": PolarSelfSubscriptionCancellationProps(
                            email=recipient,
                            product_name=product_name,
                            ends_at=ends_at,
                        ).model_dump(),
                    }
                )
                enqueue_email_template(
                    email,
                    to_email_addr=recipient,
                    subject=f"Your {product_name} subscription has been canceled",
                )

    async def handle_subscription_past_due_event(
        self, payload: WebhookSubscriptionPastDuePayload
    ) -> None:
        subscription = payload.data
        context = await self._resolve_subscription_email_context(subscription)
        if context is None:
            return
        recipients, product_name = context

        with logfire.span(
            "polar_self.webhook.subscription_past_due",
            subscription_id=subscription.id,
        ):
            for recipient in recipients:
                email = EmailAdapter.validate_python(
                    {
                        "template": "polar_self_subscription_past_due",
                        "props": PolarSelfSubscriptionPastDueProps(
                            email=recipient,
                            product_name=product_name,
                        ).model_dump(),
                    }
                )
                enqueue_email_template(
                    email,
                    to_email_addr=recipient,
                    subject=f"Your {product_name} subscription payment failed",
                )

    async def handle_subscription_revoked_event(
        self, payload: WebhookSubscriptionRevokedPayload
    ) -> None:
        subscription = payload.data
        context = await self._resolve_subscription_email_context(subscription)
        if context is None:
            return
        recipients, product_name = context

        with logfire.span(
            "polar_self.webhook.subscription_revoked",
            subscription_id=subscription.id,
        ):
            for recipient in recipients:
                email = EmailAdapter.validate_python(
                    {
                        "template": "polar_self_subscription_revoked",
                        "props": PolarSelfSubscriptionRevokedProps(
                            email=recipient,
                            product_name=product_name,
                        ).model_dump(),
                    }
                )
                enqueue_email_template(
                    email,
                    to_email_addr=recipient,
                    subject=f"Your {product_name} subscription has ended",
                )

    async def _resolve_subscription_email_context(
        self, subscription: "Subscription"
    ) -> tuple[list[str], str] | None:
        """Resolve ``(recipients, product_name)`` for a subscription email.

        Returns ``None`` when no email should be sent: free ($0) subscriptions
        never have a payment to fail, and a subscription with no billing
        contacts has nobody to notify.
        """
        if subscription.amount == 0:
            return None

        contacts = await get_client().list_billing_contacts(
            customer_id=subscription.customer_id
        )
        recipients = sorted({contact.email for contact in contacts if contact.email})
        if not recipients:
            return None

        product_name = (
            subscription.product.name if subscription.product is not None else "Polar"
        )
        return recipients, product_name

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
            organization_repository = OrganizationRepository.from_session(session)
            organization = await organization_repository.get_by_id(
                organization_id, include_blocked=True
            )
            if organization is not None:
                organization.support_tier = SupportTier.from_level(level)

            await plain_service.update_tenant_tier(
                tenant_external_id=str(organization_id),
                tier_external_id=effective_tier_external_id,
            )

    async def _apply_preview_access(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        grant: "BenefitGrant | None",
    ) -> None:
        enabled = grant is not None

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            organization_id, include_blocked=True
        )
        if organization is None:
            return

        with logfire.span(
            "polar_self.webhook.preview_access.applied",
            organization_id=str(organization_id),
            enabled=enabled,
        ):
            organization.feature_settings = {
                **organization.feature_settings,
                **{flag: enabled for flag in self.PREVIEW_ACCESS_FEATURE_FLAGS},
            }

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
