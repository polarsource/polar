#!/usr/bin/env python3

"""
Script to transfer products and their associated data between organizations.

This script handles the complex case where products need to be moved from one
organization to another, including handling customers who have purchased both
transferring and non-transferring products.
"""

import asyncio
from collections import defaultdict
from collections.abc import Sequence
from copy import deepcopy
from functools import wraps
from uuid import UUID

import typer
from rich import print
from rich.table import Table
from sqlalchemy import ColumnElement, and_, false, func, or_, select, union_all, update
from sqlalchemy.orm import joinedload
from sqlalchemy.sql.selectable import CompoundSelect

from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.member.repository import MemberRepository
from polar.models import (
    Benefit,
    BenefitGrant,
    BillingEntry,
    Checkout,
    CheckoutLink,
    CheckoutLinkProduct,
    Customer,
    CustomerSeat,
    CustomerSession,
    Discount,
    DiscountProduct,
    DiscountRedemption,
    Downloadable,
    Event,
    LicenseKey,
    Member,
    Order,
    Payment,
    PaymentMethod,
    Product,
    ProductBenefit,
    ProductPrice,
    Refund,
    Subscription,
    SubscriptionUpdate,
    TrialRedemption,
)
from polar.models.discount import DiscountFixed, DiscountPercentage, DiscountType
from polar.models.member import MemberRole
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, create_async_engine

cli = typer.Typer()

type DiscountReference = (
    Checkout
    | Order
    | Subscription
    | SubscriptionUpdate
    | BillingEntry
    | DiscountRedemption
)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


class ProductTransferError(Exception):
    """Base exception for product transfer errors."""


class MixedOrganizationError(ProductTransferError):
    """Raised when products belong to different source organizations."""


class CustomerSplitError(ProductTransferError):
    """Raised when customer splitting fails."""


class TransferValidationError(ProductTransferError):
    """Raised when transfer validation fails."""


class ProductTransferService:
    """Service to handle product transfer between organizations."""

    def __init__(
        self, source_organization_id: UUID, target_organization_id: UUID
    ) -> None:
        self.source_organization_id = source_organization_id
        self.target_organization_id = target_organization_id
        self.products: Sequence[Product] = []
        self.benefits_to_transfer: Sequence[Benefit] = []
        self.benefits_to_split: Sequence[Benefit] = []
        self.new_benefits_map: dict[UUID, Benefit] = {}
        self.customers_to_split: Sequence[Customer] = []
        self.customers_to_transfer: Sequence[Customer] = []
        self.customers_to_merge: list[
            Customer
        ] = []  # Customers with existing email in target
        self.discounts_to_transfer: Sequence[Discount] = []
        self.discounts_to_split: Sequence[Discount] = []
        self.checkout_links_to_update: Sequence[CheckoutLink] = []
        self.new_customers_map: dict[UUID, Customer] = {}
        self.new_discounts_map: dict[UUID, Discount] = {}
        self.events_to_transfer: Sequence[Event] = []
        self.transfer_stats: dict[str, int] = defaultdict(int)

    async def validate_organizations_exist(self, session: AsyncSession) -> None:
        """Validate that both organizations exist."""
        organization_repository = OrganizationRepository.from_session(session)
        source_org = await organization_repository.get_by_id(
            self.source_organization_id
        )
        if not source_org:
            raise TransferValidationError(
                f"Source organization {self.source_organization_id} does not exist"
            )

        target_org = await organization_repository.get_by_id(
            self.target_organization_id
        )
        if not target_org:
            raise TransferValidationError(
                f"Target organization {self.target_organization_id} does not exist"
            )

    async def validate_products_belong_to_same_organization(
        self, session: AsyncSession, product_ids: list[UUID]
    ) -> None:
        """Validate that all products belong to the same source organization."""
        result = await session.execute(
            select(Product).where(Product.id.in_(product_ids))
        )
        products = result.scalars().all()

        if not products:
            raise TransferValidationError("No products found with the provided IDs")

        if len(products) != len(product_ids):
            found_ids = {p.id for p in products}
            missing_ids = set(product_ids) - found_ids
            raise TransferValidationError(f"Products not found: {missing_ids}")

        # Check if all products belong to the same organization
        organizations = {product.organization_id for product in products}
        if len(organizations) != 1:
            raise MixedOrganizationError(
                f"Products belong to multiple organizations: {organizations}"
            )

        source_org_id = organizations.pop()
        if source_org_id != self.source_organization_id:
            raise MixedOrganizationError(
                f"Products belong to organization {source_org_id}, "
                f"but expected {self.source_organization_id}"
            )

        self.products = products

    async def analyze_affected_data(self, session: AsyncSession) -> None:
        """Analyze all data that will be affected by the transfer."""
        print("[bold yellow]🔍 Analyzing affected data...[/bold yellow]")

        # Find all benefits used by the transferring products
        product_ids = [p.id for p in self.products]
        product_benefit_ids_result = await session.execute(
            union_all(
                select(ProductBenefit.benefit_id).where(
                    ProductBenefit.product_id.in_(product_ids)
                ),
                select(BenefitGrant.benefit_id)
                .where(self._transferred_benefit_grants())
                .distinct(),
            )
        )
        product_benefit_ids = product_benefit_ids_result.scalars().all()

        benefits_result = await session.execute(
            select(Benefit).where(
                and_(
                    Benefit.id.in_(product_benefit_ids),
                    Benefit.organization_id == self.source_organization_id,
                )
            )
        )
        benefits = benefits_result.scalars().all()
        retained_benefit_ids = set(
            await session.scalars(
                union_all(
                    select(ProductBenefit.benefit_id).where(
                        ProductBenefit.benefit_id.in_(product_benefit_ids),
                        ProductBenefit.product_id.notin_(product_ids),
                    ),
                    select(BenefitGrant.benefit_id)
                    .where(
                        BenefitGrant.benefit_id.in_(product_benefit_ids),
                        ~func.coalesce(self._transferred_benefit_grants(), false()),
                    )
                    .distinct(),
                )
            )
        )
        self.benefits_to_transfer = [
            benefit for benefit in benefits if benefit.id not in retained_benefit_ids
        ]
        self.benefits_to_split = [
            benefit for benefit in benefits if benefit.id in retained_benefit_ids
        ]

        # Find all customers who have orders/subscriptions for these products
        customer_ids_with_transferring_products_result = await session.execute(
            select(Order.customer_id)
            .where(Order.product_id.in_([p.id for p in self.products]))
            .distinct()
        )
        customer_ids_with_transferring_products = (
            customer_ids_with_transferring_products_result.scalars().all()
        )

        # Also check subscriptions
        customer_ids_with_subscriptions_result = await session.execute(
            select(Subscription.customer_id)
            .where(Subscription.product_id.in_([p.id for p in self.products]))
            .distinct()
        )
        customer_ids_with_subscriptions = (
            customer_ids_with_subscriptions_result.scalars().all()
        )

        all_customer_ids = {
            *customer_ids_with_transferring_products,
            *customer_ids_with_subscriptions,
        }

        # Find customers who also have orders/subscriptions for non-transferring products
        # (i.e., products that stay in the source organization)
        non_transferring_product_ids_result = await session.execute(
            select(Product.id).where(
                and_(
                    Product.organization_id == self.source_organization_id,
                    Product.id.notin_([p.id for p in self.products]),
                )
            )
        )
        non_transferring_product_ids = (
            non_transferring_product_ids_result.scalars().all()
        )

        customers_with_mixed_purchases = []
        for customer_id in all_customer_ids:
            # Check if customer has orders for non-transferring products
            has_non_transferring_orders_result = await session.execute(
                select(Order.id)
                .where(
                    and_(
                        Order.customer_id == customer_id,
                        Order.product_id.in_(non_transferring_product_ids),
                    )
                )
                .limit(1)
            )
            has_non_transferring_orders = (
                has_non_transferring_orders_result.scalar_one_or_none() is not None
            )

            # Check if customer has subscriptions for non-transferring products
            has_non_transferring_subscriptions_result = await session.execute(
                select(Subscription.id)
                .where(
                    and_(
                        Subscription.customer_id == customer_id,
                        Subscription.product_id.in_(non_transferring_product_ids),
                    )
                )
                .limit(1)
            )
            has_non_transferring_subscriptions = (
                has_non_transferring_subscriptions_result.scalar_one_or_none()
                is not None
            )

            if has_non_transferring_orders or has_non_transferring_subscriptions:
                customers_with_mixed_purchases.append(customer_id)

        customers_to_split_result = await session.execute(
            select(Customer).where(Customer.id.in_(customers_with_mixed_purchases))
        )
        self.customers_to_split = customers_to_split_result.scalars().all()

        # Find customers who only have purchases for transferring products (can be transferred directly)
        customers_to_transfer_directly = list(
            set(all_customer_ids) - set(customers_with_mixed_purchases)
        )
        customers_to_transfer_result = await session.execute(
            select(Customer).where(Customer.id.in_(customers_to_transfer_directly))
        )
        self.customers_to_transfer = customers_to_transfer_result.scalars().all()

        print(
            f"[bold green]✓ Found {len(self.products)} products to transfer[/bold green]"
        )
        print(
            f"[bold green]✓ Found {len(self.benefits_to_transfer)} benefits to transfer[/bold green]"
        )
        print(
            f"[bold green]✓ Found {len(self.customers_to_split)} customers to split[/bold green]"
        )
        print(
            f"[bold green]✓ Found {len(self.customers_to_transfer)} customers to transfer directly[/bold green]"
        )

        # Analyze discounts
        await self._analyze_discounts(session)

        print(
            f"[bold green]✓ Found {len(self.discounts_to_transfer)} discounts to transfer directly[/bold green]"
        )
        print(
            f"[bold green]✓ Found {len(self.discounts_to_split)} discounts to split[/bold green]"
        )

        # Analyze checkout links
        await self._analyze_checkout_links(session)

        self.transfer_stats["products"] = len(self.products)
        self.transfer_stats["benefits"] = len(self.benefits_to_transfer)
        self.transfer_stats["benefits_to_split"] = len(self.benefits_to_split)
        self.transfer_stats["customers_to_split"] = len(self.customers_to_split)
        self.transfer_stats["customers_to_transfer"] = len(self.customers_to_transfer)
        self.transfer_stats["discounts_to_transfer"] = len(self.discounts_to_transfer)
        self.transfer_stats["discounts_to_split"] = len(self.discounts_to_split)
        self.transfer_stats["checkout_links_to_update"] = len(
            self.checkout_links_to_update
        )

    def _transferred_benefit_grants(self) -> ColumnElement[bool]:
        product_ids = [product.id for product in self.products]
        return or_(
            BenefitGrant.order_id.in_(
                select(Order.id).where(Order.product_id.in_(product_ids))
            ),
            BenefitGrant.subscription_id.in_(
                select(Subscription.id).where(Subscription.product_id.in_(product_ids))
            ),
        )

    def _discount_reference_filters(
        self,
    ) -> list[tuple[type[DiscountReference], ColumnElement[bool]]]:
        product_ids = [p.id for p in self.products]
        subscription_ids = select(Subscription.id).where(
            Subscription.product_id.in_(product_ids)
        )
        checkout_ids = select(Checkout.id).where(Checkout.product_id.in_(product_ids))
        return [
            (Checkout, Checkout.product_id.in_(product_ids)),
            (Order, Order.product_id.in_(product_ids)),
            (Subscription, Subscription.product_id.in_(product_ids)),
            (
                SubscriptionUpdate,
                SubscriptionUpdate.subscription_id.in_(subscription_ids),
            ),
            (
                BillingEntry,
                BillingEntry.product_price_id.in_(
                    select(ProductPrice.id).where(
                        ProductPrice.product_id.in_(product_ids)
                    )
                ),
            ),
            (
                DiscountRedemption,
                or_(
                    DiscountRedemption.checkout_id.in_(checkout_ids),
                    DiscountRedemption.subscription_id.in_(subscription_ids),
                ),
            ),
        ]

    async def _analyze_discounts(self, session: AsyncSession) -> None:
        if not self.products:
            return

        product_ids = [p.id for p in self.products]
        references = self._discount_reference_filters()
        transferring_discount_ids: CompoundSelect[tuple[UUID | None]] = union_all(
            select(DiscountProduct.discount_id).where(
                DiscountProduct.product_id.in_(product_ids)
            ),
            *(
                select(model.discount_id).where(condition)
                for model, condition in references
            ),
        )
        discounts = (
            await session.scalars(
                select(Discount).where(
                    Discount.organization_id == self.source_organization_id,
                    or_(
                        Discount.id.in_(transferring_discount_ids),
                        and_(~Discount.discount_products.any(), ~Discount.is_deleted),
                    ),
                )
            )
        ).all()
        discount_ids = [discount.id for discount in discounts]
        remaining_references: CompoundSelect[tuple[UUID | None]] = union_all(
            select(DiscountProduct.discount_id).where(
                DiscountProduct.discount_id.in_(discount_ids),
                DiscountProduct.product_id.notin_(product_ids),
            ),
            select(CheckoutLink.discount_id).where(
                CheckoutLink.discount_id.in_(discount_ids),
                CheckoutLink.organization_id == self.source_organization_id,
            ),
            *(
                select(model.discount_id).where(
                    model.discount_id.in_(discount_ids),
                    ~func.coalesce(condition, false()),
                )
                for model, condition in references
            ),
        )
        remaining_discount_ids = set(
            await session.scalars(
                select(Discount.id).where(
                    Discount.id.in_(discount_ids),
                    Discount.id.in_(remaining_references),
                )
            )
        )
        discounts_to_transfer = []
        discounts_to_split = []
        for discount in discounts:
            if not discount.discount_products or discount.id in remaining_discount_ids:
                discounts_to_split.append(discount)
            else:
                discounts_to_transfer.append(discount)
        self.discounts_to_transfer = discounts_to_transfer
        self.discounts_to_split = discounts_to_split

    async def _analyze_checkout_links(self, session: AsyncSession) -> None:
        """Analyze checkout links affected by the transfer."""
        # Find all checkout links that contain any of the transferring products
        result = await session.execute(
            select(CheckoutLink).where(
                and_(
                    CheckoutLink.organization_id == self.source_organization_id,
                    CheckoutLink.id.in_(
                        select(CheckoutLinkProduct.checkout_link_id).where(
                            CheckoutLinkProduct.product_id.in_(
                                [p.id for p in self.products]
                            )
                        )
                    ),
                )
            )
        )
        self.checkout_links_to_update = result.scalars().all()
        self.transfer_stats["checkout_links_to_update"] = len(
            self.checkout_links_to_update
        )

        print(
            f"[bold green]✓ Found {len(self.checkout_links_to_update)} checkout links to update[/bold green]"
        )

        # Analyze events
        await self._analyze_events(session)

    async def _analyze_events(self, session: AsyncSession) -> None:
        """Analyze events that need to be transferred."""
        if not self.customers_to_transfer:
            return

        # Get customer IDs and external IDs for directly transferred customers
        customer_ids = [c.id for c in self.customers_to_transfer]
        external_ids = [
            c.external_id for c in self.customers_to_transfer if c.external_id
        ]

        # Include customers to merge in event analysis
        merge_customer_ids = [c.id for c in self.customers_to_merge]
        merge_external_ids = [
            c.external_id for c in self.customers_to_merge if c.external_id
        ]

        all_customer_ids = customer_ids + merge_customer_ids
        all_external_ids = external_ids + merge_external_ids

        # Find events for all customers (both to transfer and to merge)
        events_result = await session.execute(
            select(Event).where(
                or_(
                    Event.customer_id.in_(all_customer_ids),
                    and_(
                        Event.external_customer_id.in_(all_external_ids),
                        Event.organization_id == self.source_organization_id,
                    ),
                )
            )
        )
        self.events_to_transfer = events_result.scalars().all()
        self.transfer_stats["events_to_transfer"] = len(self.events_to_transfer)

        print(
            f"[bold green]✓ Found {len(self.events_to_transfer)} events to transfer[/bold green]"
        )

    async def create_new_customer_for_split(
        self, session: AsyncSession, original_customer: Customer
    ) -> Customer:
        """Create a new customer record in the target organization or use existing one."""
        print(
            f"[bold blue]👤 Creating new customer for {original_customer.email}[/bold blue]"
        )

        # Check if a customer with the same email already exists in target organization
        existing_customer = None
        if original_customer.email is not None:
            existing_customer_result = await session.execute(
                select(Customer).where(
                    and_(
                        Customer.email == original_customer.email,
                        Customer.organization_id == self.target_organization_id,
                        Customer.deleted_at.is_(None),
                    )
                )
            )
            existing_customer = existing_customer_result.scalar_one_or_none()

        if existing_customer:
            # Use existing customer instead of creating a new one
            print(
                f"[bold yellow]⚠️  Customer with email {original_customer.email} already exists in target organization, using existing customer[/bold yellow]"
            )
            self.transfer_stats["existing_customers_used"] += 1
            return existing_customer

        # Generate a new short_id for the customer
        result = await session.execute(select(func.nextval("customer_short_id_seq")))
        new_short_id = result.scalar()

        new_customer = Customer(
            organization_id=self.target_organization_id,
            email=original_customer.email,
            email_verified=original_customer.email_verified,
            type=original_customer.type,
            name=original_customer.name,
            billing_name=original_customer.billing_name,
            billing_address=original_customer.billing_address,
            tax_id=original_customer.tax_id,
            short_id=new_short_id,
            stripe_customer_id=original_customer.stripe_customer_id,
            external_id=None,  # Can be set later if needed
            user_metadata=original_customer.user_metadata.copy(),
        )

        session.add(new_customer)
        await session.flush()

        self.new_customers_map[original_customer.id] = new_customer
        self.transfer_stats["new_customers_created"] += 1

        return new_customer

    async def transfer_discounts_directly(self, session: AsyncSession) -> None:
        """Transfer discounts that are only used by transferring products."""
        if not self.discounts_to_transfer:
            print("[bold blue]ℹ️  No discounts to transfer directly[/bold blue]")
            return

        print("[bold yellow]🔄 Transferring discounts directly...[/bold yellow]")

        for discount in self.discounts_to_transfer:
            print(
                f"[bold blue]🏷️  Transferring discount {discount.code or discount.name} directly[/bold blue]"
            )
            discount.organization_id = self.target_organization_id
            session.add(discount)
            self.transfer_stats["discounts_transferred_directly"] += 1

        await session.flush()

    async def split_discounts(self, session: AsyncSession) -> None:
        product_ids = {p.id for p in self.products}
        for discount in self.discounts_to_split:
            restricted = bool(discount.discount_products)
            transferring_products = [
                association.product
                for association in discount.discount_products
                if association.product_id in product_ids
            ]
            new_discount = DiscountType(discount.type).get_model()(
                organization_id=self.target_organization_id,
                name=discount.name,
                type=discount.type,
                code=discount.code,
                external_id=discount.external_id,
                user_metadata=discount.user_metadata.copy(),
                starts_at=discount.starts_at,
                ends_at=discount.ends_at,
                max_redemptions=discount.max_redemptions,
                max_redemptions_per_customer=discount.max_redemptions_per_customer,
                duration=discount.duration,
                duration_in_months=discount.duration_in_months,
                deleted_at=discount.deleted_at,
                discount_products=[
                    DiscountProduct(product=product)
                    for product in transferring_products
                ],
            )
            if isinstance(new_discount, DiscountFixed):
                assert isinstance(discount, DiscountFixed)
                new_discount.amounts = discount.amounts.copy()
            elif isinstance(new_discount, DiscountPercentage):
                assert isinstance(discount, DiscountPercentage)
                new_discount.basis_points = discount.basis_points

            discount.discount_products = [
                association
                for association in discount.discount_products
                if association.product_id not in product_ids
            ]
            # Empty restrictions would otherwise make these discounts organization-wide.
            if restricted:
                if not discount.discount_products and discount.deleted_at is None:
                    discount.deleted_at = utc_now()
                if not transferring_products and new_discount.deleted_at is None:
                    new_discount.deleted_at = utc_now()

            session.add(new_discount)
            await session.flush()
            self.new_discounts_map[discount.id] = new_discount

            for model, condition in self._discount_reference_filters():
                updated_ids = await session.scalars(
                    update(model)
                    .where(model.discount_id == discount.id, condition)
                    .values(discount_id=new_discount.id)
                    .returning(model.id)
                )
                self.transfer_stats[f"{model.__tablename__}_discount_updated"] += len(
                    updated_ids.all()
                )

            for current_discount in (discount, new_discount):
                current_discount.redemptions_count = (
                    await session.scalar(
                        select(func.count(DiscountRedemption.id)).where(
                            DiscountRedemption.discount_id == current_discount.id
                        )
                    )
                    or 0
                )
            self.transfer_stats["discounts_split"] += 1

        await session.flush()

    async def transfer_customers_directly(self, session: AsyncSession) -> None:
        """Transfer customers who only have purchases for transferring products."""
        if not self.customers_to_transfer:
            print("[bold blue]ℹ️  No customers to transfer directly[/bold blue]")
            return

        print("[bold yellow]🔄 Transferring customers directly...[/bold yellow]")

        for customer in self.customers_to_transfer:
            print(
                f"[bold blue]👤 Transferring customer {customer.email} directly[/bold blue]"
            )

            # Check if a customer with the same email already exists in target organization
            existing_customer = None
            if customer.email is not None:
                existing_customer_result = await session.execute(
                    select(Customer).where(
                        and_(
                            Customer.email == customer.email,
                            Customer.organization_id == self.target_organization_id,
                            Customer.deleted_at.is_(None),
                        )
                    )
                )
                existing_customer = existing_customer_result.scalar_one_or_none()

            if existing_customer:
                # Customer with same email exists in target org - this is a merge scenario
                print(
                    f"[bold yellow]⚠️  Customer with email {customer.email} already exists in target organization, merging into existing customer[/bold yellow]"
                )

                # Add to customers_to_merge list and remove from customers_to_transfer for proper tracking
                self.customers_to_merge.append(customer)
                self.customers_to_transfer = [
                    c for c in self.customers_to_transfer if c.id != customer.id
                ]

                # Update all orders for this customer to use the existing customer
                orders_result = await session.execute(
                    select(Order).where(Order.customer_id == customer.id)
                )
                orders_to_update = orders_result.scalars().all()

                for order in orders_to_update:
                    order.customer_id = existing_customer.id
                    session.add(order)
                    self.transfer_stats["orders_updated"] += 1

                # Update all subscriptions for this customer to use the existing customer
                subscriptions_result = await session.execute(
                    select(Subscription).where(Subscription.customer_id == customer.id)
                )
                subscriptions_to_update = subscriptions_result.scalars().all()

                for subscription in subscriptions_to_update:
                    subscription.customer_id = existing_customer.id
                    session.add(subscription)
                    self.transfer_stats["subscriptions_updated"] += 1

                # Update benefit grants for this customer
                benefit_grants_result = await session.execute(
                    select(BenefitGrant).where(BenefitGrant.customer_id == customer.id)
                )
                benefit_grants_to_update = benefit_grants_result.scalars().all()

                for grant in benefit_grants_to_update:
                    grant.customer_id = existing_customer.id
                    session.add(grant)
                    self.transfer_stats["benefit_grants_updated"] += 1

                # Update license keys for this customer
                license_keys_result = await session.execute(
                    select(LicenseKey).where(LicenseKey.customer_id == customer.id)
                )
                license_keys_to_update = license_keys_result.scalars().all()

                for license_key in license_keys_to_update:
                    license_key.customer_id = existing_customer.id
                    license_key.organization_id = self.target_organization_id
                    session.add(license_key)
                    self.transfer_stats["license_keys_updated"] += 1

                # Update downloadables for this customer
                downloadables_result = await session.execute(
                    select(Downloadable).where(Downloadable.customer_id == customer.id)
                )
                downloadables_to_update = downloadables_result.scalars().all()

                for downloadable in downloadables_to_update:
                    downloadable.customer_id = existing_customer.id
                    session.add(downloadable)
                    self.transfer_stats["downloadables_updated"] += 1

                # Update billing entries for this customer
                billing_entries_result = await session.execute(
                    select(BillingEntry).where(BillingEntry.customer_id == customer.id)
                )
                billing_entries_to_update = billing_entries_result.scalars().all()

                for billing_entry in billing_entries_to_update:
                    billing_entry.customer_id = existing_customer.id
                    session.add(billing_entry)
                    self.transfer_stats["billing_entries_updated"] += 1

                # Update customer sessions for this customer
                customer_sessions_result = await session.execute(
                    select(CustomerSession).where(
                        CustomerSession.customer_id == customer.id
                    )
                )
                customer_sessions_to_update = customer_sessions_result.scalars().all()

                for customer_session in customer_sessions_to_update:
                    customer_session.customer_id = existing_customer.id
                    session.add(customer_session)
                    self.transfer_stats["customer_sessions_updated"] += 1

                await self.copy_payment_methods(
                    session, customer, existing_customer, subscriptions_to_update
                )
                await self.transfer_customer_references(
                    session, customer, existing_customer, split=False
                )

                await session.execute(
                    update(CustomerSeat)
                    .where(CustomerSeat.customer_id == customer.id)
                    .values(customer_id=existing_customer.id)
                )

                # Soft delete the source customer since they shouldn't exist in source org anymore
                customer.deleted_at = func.now()
                session.add(customer)
                self.transfer_stats["customers_merged"] += 1

                print(
                    f"[bold green]✓ Merged {len(orders_to_update)} orders, {len(subscriptions_to_update)} subscriptions, and other related objects into existing customer[/bold green]"
                )
            else:
                # No existing customer - transfer normally
                customer.organization_id = self.target_organization_id
                session.add(customer)
                self.transfer_stats["customers_transferred_directly"] += 1

            member_ids = await session.scalars(
                update(Member)
                .where(Member.customer_id == customer.id)
                .values(
                    customer_id=(existing_customer or customer).id,
                    organization_id=self.target_organization_id,
                )
                .returning(Member.id)
            )
            self.transfer_stats["members_transferred"] += len(member_ids.all())

        await session.flush()

    async def split_customers(self, session: AsyncSession) -> None:
        """Handle customer splitting for customers with mixed purchases."""
        if not self.customers_to_split:
            print("[bold blue]ℹ️  No customers to split[/bold blue]")
            return

        print("[bold yellow]🔄 Starting customer splitting...[/bold yellow]")

        for customer in self.customers_to_split:
            new_customer = await self.create_new_customer_for_split(session, customer)
            members = await session.scalars(
                select(Member).where(Member.customer_id == customer.id)
            )
            target_members = list(
                await MemberRepository.from_session(session).list_by_customer(
                    new_customer.id
                )
            )
            member_map: dict[UUID, Member] = {}
            for member in members:
                if member.deleted_at is None:
                    matches = [
                        target_member
                        for target_member in target_members
                        if target_member.email.lower() == member.email.lower()
                        or (
                            member.external_id is not None
                            and target_member.external_id == member.external_id
                        )
                    ]
                    if len(matches) > 1:
                        raise CustomerSplitError(
                            f"Member {member.id} matches different target members "
                            "by email and external ID."
                        )
                    if matches:
                        matched_member = matches[0]
                        if (
                            member.external_id is not None
                            and matched_member.external_id is not None
                            and member.external_id != matched_member.external_id
                        ) or matched_member in member_map.values():
                            raise CustomerSplitError(
                                f"Member {member.id} has a conflicting target identity."
                            )
                        if matched_member.external_id is None:
                            matched_member.external_id = member.external_id
                        matched_member._oauth_accounts = {
                            **member.oauth_accounts,
                            **matched_member.oauth_accounts,
                        }
                        member_map[member.id] = matched_member
                        self.transfer_stats["members_reused"] += 1
                        continue
                    if member.role == MemberRole.owner and any(
                        target_member.role == MemberRole.owner
                        for target_member in target_members
                    ):
                        raise CustomerSplitError(
                            f"Customer {new_customer.id} already has a different owner; "
                            f"cannot copy owner member {member.id}."
                        )
                new_member = Member(
                    customer=new_customer,
                    organization_id=self.target_organization_id,
                    email=member.email,
                    name=member.name,
                    external_id=member.external_id,
                    role=member.role,
                    _oauth_accounts=member.oauth_accounts.copy(),
                    deleted_at=member.deleted_at,
                )
                session.add(new_member)
                member_map[member.id] = new_member
                if new_member.deleted_at is None:
                    target_members.append(new_member)
                self.transfer_stats["members_copied"] += 1
            await session.flush()

            # Update all orders for transferring products to use the new customer
            orders_result = await session.execute(
                select(Order)
                .where(
                    and_(
                        Order.customer_id == customer.id,
                        Order.product_id.in_([p.id for p in self.products]),
                    )
                )
                .options(joinedload(Order.items))
            )
            orders_to_update = orders_result.unique().scalars().all()

            for order in orders_to_update:
                order.customer_id = new_customer.id
                session.add(order)
                self.transfer_stats["orders_updated"] += 1

            # Update all subscriptions for transferring products to use the new customer
            subscriptions_result = await session.execute(
                select(Subscription).where(
                    and_(
                        Subscription.customer_id == customer.id,
                        Subscription.product_id.in_([p.id for p in self.products]),
                    )
                )
            )
            subscriptions_to_update = subscriptions_result.scalars().all()

            for subscription in subscriptions_to_update:
                subscription.customer_id = new_customer.id
                session.add(subscription)
                self.transfer_stats["subscriptions_updated"] += 1

            # Update benefit grants for transferring products
            benefit_grants_result = await session.execute(
                select(BenefitGrant).where(
                    and_(
                        BenefitGrant.customer_id == customer.id,
                        BenefitGrant.benefit_id.in_(
                            [b.id for b in self.benefits_to_transfer]
                        ),
                        self._transferred_benefit_grants(),
                    )
                )
            )
            benefit_grants_to_update = benefit_grants_result.scalars().all()

            for grant in benefit_grants_to_update:
                grant.customer_id = new_customer.id
                if grant.member_id is not None:
                    grant.member_id = member_map[grant.member_id].id
                session.add(grant)
                self.transfer_stats["benefit_grants_updated"] += 1

            # Update license keys for transferring benefits
            license_keys_result = await session.execute(
                select(LicenseKey).where(
                    and_(
                        LicenseKey.customer_id == customer.id,
                        LicenseKey.benefit_id.in_(
                            [b.id for b in self.benefits_to_transfer]
                        ),
                    )
                )
            )
            license_keys_to_update = license_keys_result.scalars().all()

            for license_key in license_keys_to_update:
                license_key.customer_id = new_customer.id
                if license_key.member_id is not None:
                    license_key.member_id = member_map[license_key.member_id].id
                license_key.organization_id = self.target_organization_id
                session.add(license_key)
                self.transfer_stats["license_keys_updated"] += 1

            # Update downloadables for transferring benefits
            downloadables_result = await session.execute(
                select(Downloadable).where(
                    and_(
                        Downloadable.customer_id == customer.id,
                        Downloadable.benefit_id.in_(
                            [b.id for b in self.benefits_to_transfer]
                        ),
                    )
                )
            )
            downloadables_to_update = downloadables_result.scalars().all()

            for downloadable in downloadables_to_update:
                downloadable.customer_id = new_customer.id
                if downloadable.member_id is not None:
                    downloadable.member_id = member_map[downloadable.member_id].id
                session.add(downloadable)
                self.transfer_stats["downloadables_updated"] += 1

            seats = await session.scalars(
                select(CustomerSeat).where(
                    CustomerSeat.customer_id == customer.id,
                    or_(
                        CustomerSeat.subscription_id.in_(
                            [s.id for s in subscriptions_to_update]
                        ),
                        CustomerSeat.order_id.in_([o.id for o in orders_to_update]),
                    ),
                )
            )
            for seat in seats:
                seat.customer_id = new_customer.id
                if seat.member_id is not None:
                    seat.member_id = member_map[seat.member_id].id
                self.transfer_stats["customer_seats_updated"] += 1

            # Update billing entries for transferring products
            billing_entries_result = await session.execute(
                select(BillingEntry).where(
                    and_(
                        BillingEntry.customer_id == customer.id,
                        BillingEntry.subscription_id.in_(
                            [s.id for s in subscriptions_to_update]
                        ),
                    )
                )
            )
            billing_entries_to_update = billing_entries_result.scalars().all()

            for billing_entry in billing_entries_to_update:
                billing_entry.customer_id = new_customer.id
                session.add(billing_entry)
                self.transfer_stats["billing_entries_updated"] += 1

            await self.copy_payment_methods(
                session, customer, new_customer, subscriptions_to_update
            )
            await self.transfer_customer_references(
                session, customer, new_customer, split=True
            )

    async def transfer_customer_references(
        self,
        session: AsyncSession,
        customer: Customer,
        target_customer: Customer,
        *,
        split: bool,
    ) -> None:
        product_ids = [product.id for product in self.products]
        order_ids = select(Order.id).where(Order.product_id.in_(product_ids))
        checkout_ids = select(Checkout.id).where(Checkout.product_id.in_(product_ids))
        payment_ids = select(Payment.id).where(
            or_(Payment.order_id.in_(order_ids), Payment.checkout_id.in_(checkout_ids))
        )

        for model, product_condition in (
            (Refund, Refund.payment_id.in_(payment_ids)),
            (TrialRedemption, TrialRedemption.product_id.in_(product_ids)),
        ):
            statement = update(model).where(model.customer_id == customer.id)
            if split:
                statement = statement.where(product_condition)
            updated_ids = await session.scalars(
                statement.values(customer_id=target_customer.id).returning(model.id)
            )
            self.transfer_stats[f"{model.__tablename__}_updated"] += len(
                updated_ids.all()
            )

        for reference_model in (Checkout, Event):
            if split and reference_model is Event:
                continue
            customer_condition = reference_model.customer_id == customer.id
            if customer.external_id is not None:
                customer_condition = or_(
                    customer_condition,
                    and_(
                        reference_model.customer_id.is_(None),
                        reference_model.external_customer_id == customer.external_id,
                        reference_model.organization_id == self.source_organization_id,
                    ),
                )
            statement = update(reference_model).where(customer_condition)
            if split:
                statement = statement.where(Checkout.product_id.in_(product_ids))
            await session.execute(
                statement.values(
                    customer_id=target_customer.id,
                    external_customer_id=target_customer.external_id,
                )
            )

    async def copy_payment_methods(
        self,
        session: AsyncSession,
        customer: Customer,
        target_customer: Customer,
        subscriptions: Sequence[Subscription],
    ) -> None:
        if customer.stripe_customer_id is not None:
            if target_customer.stripe_customer_id not in (
                None,
                customer.stripe_customer_id,
            ):
                raise CustomerSplitError(
                    f"Customer {target_customer.id} has a different Stripe customer ID"
                )
            target_customer.stripe_customer_id = customer.stripe_customer_id

        target_methods = await session.scalars(
            select(PaymentMethod).where(PaymentMethod.customer_id == target_customer.id)
        )
        target_methods_by_processor_id = {
            (method.processor, method.processor_id): method for method in target_methods
        }
        payment_methods = await session.scalars(
            select(PaymentMethod).where(PaymentMethod.customer_id == customer.id)
        )
        payment_method_map: dict[UUID, PaymentMethod] = {}
        for payment_method in payment_methods:
            target_method = target_methods_by_processor_id.get(
                (payment_method.processor, payment_method.processor_id)
            )
            if target_method is None:
                target_method = PaymentMethod(
                    customer=target_customer,
                    processor=payment_method.processor,
                    processor_id=payment_method.processor_id,
                    type=payment_method.type,
                    method_metadata=payment_method.method_metadata.copy(),
                    deleted_at=payment_method.deleted_at,
                )
                session.add(target_method)
                self.transfer_stats["payment_methods_copied"] += 1
            payment_method_map[payment_method.id] = target_method

        await session.flush()
        for subscription in subscriptions:
            if subscription.payment_method_id is not None:
                subscription.payment_method = payment_method_map[
                    subscription.payment_method_id
                ]
        if (
            target_customer.default_payment_method_id is None
            and customer.default_payment_method_id is not None
        ):
            target_customer.default_payment_method = payment_method_map[
                customer.default_payment_method_id
            ]
        await session.flush()

    async def transfer_events(self, session: AsyncSession) -> None:
        """Transfer events for directly transferred customers."""
        if not self.events_to_transfer:
            print("[bold blue]ℹ️  No events to transfer[/bold blue]")
            return

        print(
            f"[bold yellow]🔄 Transferring {len(self.events_to_transfer)} events...[/bold yellow]"
        )

        for event in self.events_to_transfer:
            event.organization_id = self.target_organization_id
            session.add(event)
            self.transfer_stats["events_transferred"] += 1

        await session.flush()

    async def split_benefits(self, session: AsyncSession) -> None:
        for benefit in self.benefits_to_split:
            new_benefit = Benefit(
                organization_id=self.target_organization_id,
                type=benefit.type,
                description=benefit.description,
                is_tax_applicable=benefit.is_tax_applicable,
                selectable=benefit.selectable,
                deletable=benefit.deletable,
                visibility=benefit.visibility,
                external_id=benefit.external_id,
                properties=deepcopy(benefit.properties),
                user_metadata=deepcopy(benefit.user_metadata),
                deleted_at=benefit.deleted_at,
            )
            session.add(new_benefit)
            await session.flush()
            grants = (
                await session.scalars(
                    select(BenefitGrant).where(
                        BenefitGrant.benefit_id == benefit.id,
                        self._transferred_benefit_grants(),
                    )
                )
            ).all()
            retained_grants = (
                await session.scalars(
                    select(BenefitGrant).where(
                        BenefitGrant.benefit_id == benefit.id,
                        ~func.coalesce(self._transferred_benefit_grants(), false()),
                    )
                )
            ).all()
            key_ids = {
                UUID(str(key_id))
                for grant in grants
                if (key_id := grant.properties.get("license_key_id")) is not None
            }
            if any(
                UUID(str(key_id)) in key_ids
                for grant in retained_grants
                if (key_id := grant.properties.get("license_key_id")) is not None
            ):
                raise TransferValidationError(
                    f"Benefit {benefit.id} has a license key shared by transferred "
                    "and retained grants; it cannot be moved without changing access."
                )
            await session.execute(
                update(LicenseKey)
                .where(LicenseKey.benefit_id == benefit.id, LicenseKey.id.in_(key_ids))
                .values(
                    benefit_id=new_benefit.id,
                    organization_id=self.target_organization_id,
                )
            )

            transferred_scopes = {
                (grant.customer_id, grant.member_id) for grant in grants
            }
            retained_scopes = {
                (grant.customer_id, grant.member_id) for grant in retained_grants
            }
            downloadables = await session.scalars(
                select(Downloadable).where(Downloadable.benefit_id == benefit.id)
            )
            for downloadable in downloadables:
                scope = (downloadable.customer_id, downloadable.member_id)
                if scope not in transferred_scopes:
                    continue
                if scope in retained_scopes:
                    session.add(
                        Downloadable(
                            benefit_id=new_benefit.id,
                            customer_id=downloadable.customer_id,
                            member_id=downloadable.member_id,
                            file_id=downloadable.file_id,
                            status=downloadable.status,
                            downloaded=downloadable.downloaded,
                            last_downloaded_at=downloadable.last_downloaded_at,
                            deleted_at=downloadable.deleted_at,
                        )
                    )
                else:
                    downloadable.benefit_id = new_benefit.id

            for grant in grants:
                grant.benefit_id = new_benefit.id
            await session.execute(
                update(ProductBenefit)
                .where(
                    ProductBenefit.benefit_id == benefit.id,
                    ProductBenefit.product_id.in_([p.id for p in self.products]),
                )
                .values(benefit_id=new_benefit.id)
            )
            self.new_benefits_map[benefit.id] = new_benefit
            self.benefits_to_transfer = [*self.benefits_to_transfer, new_benefit]
            self.transfer_stats["benefits_split"] += 1
        await session.flush()

    async def transfer_benefits(self, session: AsyncSession) -> None:
        """Transfer benefits to the target organization."""
        if not self.benefits_to_transfer:
            print("[bold blue]ℹ️  No benefits to transfer[/bold blue]")
            return

        print("[bold yellow]🔄 Transferring benefits...[/bold yellow]")

        for benefit in self.benefits_to_transfer:
            benefit.organization_id = self.target_organization_id
            session.add(benefit)  # Ensure benefit is tracked by session
            self.transfer_stats["benefits_transferred"] += 1

        await session.execute(
            update(LicenseKey)
            .where(LicenseKey.benefit_id.in_([b.id for b in self.benefits_to_transfer]))
            .values(organization_id=self.target_organization_id)
        )
        await session.flush()

    async def transfer_products(self, session: AsyncSession) -> None:
        """Transfer products to the target organization."""
        if not self.products:
            print("[bold blue]ℹ️  No products to transfer[/bold blue]")
            return

        print("[bold yellow]🔄 Transferring products...[/bold yellow]")

        for product in self.products:
            product.organization_id = self.target_organization_id
            session.add(product)
            self.transfer_stats["products_transferred"] += 1

        await session.flush()

    async def update_related_entities(self, session: AsyncSession) -> None:
        """Update all entities related to the transferred products."""
        print("[bold yellow]🔄 Updating related entities...[/bold yellow]")

        product_ids = [p.id for p in self.products]
        order_ids = select(Order.id).where(Order.product_id.in_(product_ids))
        checkout_ids = select(Checkout.id).where(Checkout.product_id.in_(product_ids))
        payment_condition = or_(
            Payment.order_id.in_(order_ids), Payment.checkout_id.in_(checkout_ids)
        )
        payment_ids = select(Payment.id).where(payment_condition)

        for model, condition in (
            (Order, Order.product_id.in_(product_ids)),
            (Subscription, Subscription.product_id.in_(product_ids)),
            (Payment, payment_condition),
            (Refund, Refund.payment_id.in_(payment_ids)),
        ):
            updated_ids = await session.scalars(
                update(model)
                .where(condition)
                .values(organization_id=self.target_organization_id)
                .returning(model.id)
            )
            self.transfer_stats[f"{model.__tablename__}_organization_updated"] += len(
                updated_ids.all()
            )

        # Update checkouts that reference the transferring products
        result = await session.execute(
            select(Checkout).where(
                Checkout.product_id.in_([p.id for p in self.products])
            )
        )
        checkouts_to_update = result.scalars().all()

        for checkout in checkouts_to_update:
            checkout.organization_id = self.target_organization_id
            session.add(checkout)  # Ensure checkout is tracked by session
            self.transfer_stats["checkouts_updated"] += 1

        # Update checkout links by removing transferring products
        await self._update_checkout_links(session)

    async def _update_checkout_links(self, session: AsyncSession) -> None:
        """Update checkout links by removing transferring products."""
        if not self.checkout_links_to_update:
            print("[bold blue]ℹ️  No checkout links to update[/bold blue]")
            return

        print("[bold yellow]🔄 Updating checkout links...[/bold yellow]")

        for checkout_link in self.checkout_links_to_update:
            print(
                f"[bold blue]🛒 Updating checkout link {checkout_link.id}[/bold blue]"
            )

            # Load the checkout link products relationship
            await session.refresh(checkout_link, ["checkout_link_products"])

            # Filter out products that are being transferred
            original_products = checkout_link.checkout_link_products
            updated_products = [
                clp
                for clp in original_products
                if clp.product_id not in [p.id for p in self.products]
            ]

            # Update the relationship
            checkout_link.checkout_link_products = updated_products

            # If no products remain, we should soft delete the checkout link
            if not updated_products:
                print(
                    f"[bold yellow]⚠️  Checkout link {checkout_link.id} has no products left, soft deleting[/bold yellow]"
                )
                checkout_link.deleted_at = func.now()
                self.transfer_stats["checkout_links_soft_deleted"] += 1
            else:
                session.add(checkout_link)
                self.transfer_stats["checkout_links_updated"] += 1

        await session.flush()

    async def validate_transfer(self, session: AsyncSession) -> None:
        """Validate that the transfer was successful."""
        print("[bold yellow]🔍 Validating transfer...[/bold yellow]")

        # Check that all discounts to transfer directly now belong to the target organization
        if self.discounts_to_transfer:
            result = await session.execute(
                select(Discount.id).where(
                    and_(
                        Discount.id.in_([d.id for d in self.discounts_to_transfer]),
                        Discount.organization_id == self.target_organization_id,
                    )
                )
            )
            discounts_transferred = result.scalars().all()

            if len(discounts_transferred) != len(self.discounts_to_transfer):
                raise TransferValidationError(
                    f"Not all discounts were transferred directly. Expected {len(self.discounts_to_transfer)}, "
                    f"found {len(discounts_transferred)} in target organization"
                )

        # Check that discounts were split correctly (new discounts created in target org)
        if self.discounts_to_split:
            result = await session.execute(
                select(Discount.id).where(
                    and_(
                        Discount.organization_id == self.target_organization_id,
                        Discount.id.in_(
                            [d.id for d in self.new_discounts_map.values()]
                        ),
                    )
                )
            )
            new_discounts_created = result.scalars().all()

            if len(new_discounts_created) != len(self.discounts_to_split):
                raise TransferValidationError(
                    f"Not all discounts were split correctly. Expected {len(self.discounts_to_split)} new discounts, "
                    f"found {len(new_discounts_created)} in target organization"
                )

        # Check that all customers to transfer directly now belong to the target organization
        if self.customers_to_transfer:
            result = await session.execute(
                select(Customer.id).where(
                    and_(
                        Customer.id.in_([c.id for c in self.customers_to_transfer]),
                        Customer.organization_id == self.target_organization_id,
                    )
                )
            )
            customers_transferred = result.scalars().all()

            if len(customers_transferred) != len(self.customers_to_transfer):
                raise TransferValidationError(
                    f"Not all customers were transferred directly. Expected {len(self.customers_to_transfer)}, "
                    f"found {len(customers_transferred)} in target organization"
                )

        # Check that all customers to merge were soft-deleted (merged into existing target customers)
        if self.customers_to_merge:
            result = await session.execute(
                select(Customer.id).where(
                    and_(
                        Customer.id.in_([c.id for c in self.customers_to_merge]),
                        Customer.deleted_at.isnot(None),
                    )
                )
            )
            customers_merged = result.scalars().all()

            if len(customers_merged) != len(self.customers_to_merge):
                raise TransferValidationError(
                    f"Not all customers were merged correctly. Expected {len(self.customers_to_merge)}, "
                    f"found {len(customers_merged)} soft-deleted (merged)"
                )

        # Check that all products now belong to the target organization
        result = await session.execute(
            select(Product.id).where(
                and_(
                    Product.id.in_([p.id for p in self.products]),
                    Product.organization_id == self.target_organization_id,
                )
            )
        )
        products_in_target = result.scalars().all()

        if len(products_in_target) != len(self.products):
            raise TransferValidationError(
                f"Not all products were transferred. Expected {len(self.products)}, "
                f"found {len(products_in_target)} in target organization"
            )

        # Check that all benefits now belong to the target organization
        result = await session.execute(
            select(Benefit.id).where(
                and_(
                    Benefit.id.in_([b.id for b in self.benefits_to_transfer]),
                    Benefit.organization_id == self.target_organization_id,
                )
            )
        )
        benefits_in_target = result.scalars().all()

        if len(benefits_in_target) != len(self.benefits_to_transfer):
            raise TransferValidationError(
                f"Not all benefits were transferred. Expected {len(self.benefits_to_transfer)}, "
                f"found {len(benefits_in_target)} in target organization"
            )

        # Check that events for transferred customers are now in target org
        if self.events_to_transfer:
            result = await session.execute(
                select(Event.id).where(
                    and_(
                        Event.id.in_([e.id for e in self.events_to_transfer]),
                        Event.organization_id == self.target_organization_id,
                    )
                )
            )
            events_in_target = result.scalars().all()

            if len(events_in_target) != len(self.events_to_transfer):
                raise TransferValidationError(
                    f"Not all events were transferred. Expected {len(self.events_to_transfer)}, "
                    f"found {len(events_in_target)} in target organization"
                )

        print("[bold green]✅ Transfer validation successful![/bold green]")

    async def execute_transfer(self, session: AsyncSession) -> None:
        """Execute the complete product transfer process."""
        try:
            # Analysis phase
            await self.analyze_affected_data(session)

            # Transfer discounts directly (those only used by transferring products)
            await self.transfer_discounts_directly(session)

            # Split discounts (those used by both transferring and non-transferring products)
            await self.split_discounts(session)

            await self.split_benefits(session)

            # Transfer customers directly (those with only transferring products)
            await self.transfer_customers_directly(session)

            # Customer splitting (those with mixed purchases)
            await self.split_customers(session)

            # Transfer events (after customers are in their final state)
            await self.transfer_events(session)

            # Transfer benefits
            await self.transfer_benefits(session)

            # Transfer products
            await self.transfer_products(session)

            # Update related entities
            await self.update_related_entities(session)

            # Validate transfer
            await self.validate_transfer(session)

            print(
                "[bold green]✅ Product transfer completed successfully![/bold green]"
            )
            self._log_transfer_summary()

        except Exception as e:
            await session.rollback()
            print(f"[bold red]❌ Product transfer failed: {e}[/bold red]")
            raise

    def _log_transfer_summary(self) -> None:
        """Display a summary of the transfer operation using Rich."""
        print("\n[bold magenta]=== 📊 Transfer Summary ===[/bold magenta]")

        # Create a table for better visualization
        table = Table(show_header=True, header_style="bold blue")
        table.add_column("Metric", style="dim", width=30)
        table.add_column("Count", style="bold green")

        for key, value in self.transfer_stats.items():
            metric_name = key.replace("_", " ").title()
            table.add_row(metric_name, str(value))

        print(table)
        print("[bold magenta]==============================[/bold magenta]\n")


@cli.command()
@typer_async
async def main(
    source_org_id: UUID = typer.Option(..., help="Source organization ID"),
    target_org_id: UUID = typer.Option(..., help="Target organization ID"),
    product_ids: list[UUID] = typer.Argument(
        ..., help="List of product IDs to transfer"
    ),
    commit: bool = typer.Option(
        False, help="Whether to commit the changes or just dry run"
    ),
) -> None:
    """Main entry point for the product transfer script."""
    # Rich handles all output formatting, no need for logging setup

    try:
        print(
            f"[bold green]Starting product transfer from org {source_org_id} to org {target_org_id}[/bold green]"
        )
        print(
            f"[bold blue]Products to transfer:[/bold blue] {', '.join(str(pid) for pid in product_ids)}"
        )

        # Create database session
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as session:
            # Initialize service
            transfer_service = ProductTransferService(source_org_id, target_org_id)

            # Validate organizations
            await transfer_service.validate_organizations_exist(session)

            # Validate products
            await transfer_service.validate_products_belong_to_same_organization(
                session, product_ids
            )

            # Execute transfer
            await transfer_service.execute_transfer(session)

            if commit:
                await session.commit()
                print(
                    "[bold green]✅ Changes have been committed to the database[/bold green]"
                )
            else:
                await session.rollback()
                print("[bold blue]ℹ️  Dry run - no changes have been saved[/bold blue]")

        print("[bold green]✅ Script completed successfully![/bold green]")

    except Exception as e:
        print(f"[bold red]❌ Script failed: {e}[/bold red]")
        raise typer.Exit(1)


if __name__ == "__main__":
    cli()
