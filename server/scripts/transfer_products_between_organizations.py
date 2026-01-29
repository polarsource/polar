"""
Script to transfer products and their associated data between organizations.

This script handles the complex case where products need to be moved from one
organization to another, including handling customers who have purchased both
transferring and non-transferring products.
"""

import asyncio
from collections import defaultdict
from collections.abc import Sequence
from functools import wraps
from uuid import UUID

import typer
from rich import print
from rich.table import Table
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import joinedload

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import (
    Benefit,
    BenefitGrant,
    Checkout,
    CheckoutLink,
    CheckoutLinkProduct,
    Customer,
    Discount,
    DiscountRedemption,
    Downloadable,
    Event,
    LicenseKey,
    Order,
    Product,
    ProductBenefit,
    Subscription,
    TrialRedemption,
)
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, create_async_engine

cli = typer.Typer()


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


class ProductTransferError(Exception):
    """Base exception for product transfer errors."""

    pass


class MixedOrganizationError(ProductTransferError):
    """Raised when products belong to different source organizations."""

    pass


class CustomerSplitError(ProductTransferError):
    """Raised when customer splitting fails."""

    pass


class TransferValidationError(ProductTransferError):
    """Raised when transfer validation fails."""

    pass


class ProductTransferService:
    """Service to handle product transfer between organizations."""

    def __init__(
        self, source_organization_id: UUID, target_organization_id: UUID
    ) -> None:
        self.source_organization_id = source_organization_id
        self.target_organization_id = target_organization_id
        self.products: Sequence[Product] = []
        self.benefits_to_transfer: Sequence[Benefit] = []
        self.customers_to_split: Sequence[Customer] = []
        self.customers_to_transfer: Sequence[Customer] = []
        self.discounts_to_transfer: Sequence[Discount] = []
        self.discounts_to_split: Sequence[Discount] = []
        self.checkout_links_to_update: Sequence[CheckoutLink] = []
        self.new_customers_map: dict[UUID, Customer] = {}
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
        product_benefit_ids_result = await session.execute(
            select(ProductBenefit.benefit_id).where(
                ProductBenefit.product_id.in_([p.id for p in self.products])
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
        self.benefits_to_transfer = benefits_result.scalars().all()

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

        all_customer_ids = set(
            (*customer_ids_with_transferring_products, *customer_ids_with_subscriptions)
        )

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
        self.transfer_stats["customers_to_split"] = len(self.customers_to_split)
        self.transfer_stats["customers_to_transfer"] = len(self.customers_to_transfer)
        self.transfer_stats["discounts_to_transfer"] = len(self.discounts_to_transfer)
        self.transfer_stats["discounts_to_split"] = len(self.discounts_to_split)
        self.transfer_stats["checkout_links_to_update"] = len(
            self.checkout_links_to_update
        )

    async def _analyze_discounts(self, session: AsyncSession) -> None:
        """Analyze discounts affected by the transfer."""
        # Find all discounts used by checkouts/orders/subscriptions for transferring products
        discount_redemptions_result = await session.execute(
            select(DiscountRedemption.discount_id)
            .join(Checkout, Checkout.id == DiscountRedemption.checkout_id)
            .where(Checkout.product_id.in_([p.id for p in self.products]))
        )
        discount_ids_from_checkouts = discount_redemptions_result.scalars().all()

        # Also check subscriptions
        discount_redemptions_subs_result = await session.execute(
            select(DiscountRedemption.discount_id)
            .join(Subscription, Subscription.id == DiscountRedemption.subscription_id)
            .where(Subscription.product_id.in_([p.id for p in self.products]))
        )
        discount_ids_from_subscriptions = (
            discount_redemptions_subs_result.scalars().all()
        )

        all_discount_ids_used = set(
            (*discount_ids_from_checkouts, *discount_ids_from_subscriptions)
        )

        if not all_discount_ids_used:
            return

        # Get the actual discount objects
        discounts_result = await session.execute(
            select(Discount).where(Discount.id.in_(all_discount_ids_used))
        )
        all_discounts = discounts_result.scalars().all()

        # Find discounts that are also used by non-transferring products (need splitting)
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

        discounts_to_split = []
        discounts_to_transfer = []

        for discount in all_discounts:
            # Check if this discount is used by non-transferring products
            discount_redemptions_non_transferring_result = await session.execute(
                select(DiscountRedemption.id)
                .where(
                    and_(
                        DiscountRedemption.discount_id == discount.id,
                        or_(
                            DiscountRedemption.checkout_id.in_(
                                select(Checkout.id).where(
                                    Checkout.product_id.in_(
                                        non_transferring_product_ids
                                    )
                                )
                            ),
                            DiscountRedemption.subscription_id.in_(
                                select(Subscription.id).where(
                                    Subscription.product_id.in_(
                                        non_transferring_product_ids
                                    )
                                )
                            ),
                        ),
                    )
                )
                .limit(1)
            )
            is_used_by_non_transferring = (
                discount_redemptions_non_transferring_result.scalar_one_or_none()
                is not None
            )

            if is_used_by_non_transferring:
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

        # Find events for these customers
        events_result = await session.execute(
            select(Event).where(
                or_(
                    Event.customer_id.in_(customer_ids),
                    and_(
                        Event.external_customer_id.in_(external_ids),
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
        """Create a new customer record in the target organization."""
        print(
            f"[bold blue]👤 Creating new customer for {original_customer.email}[/bold blue]"
        )

        # Generate a new short_id for the customer
        result = await session.execute(select(func.nextval("customer_short_id_seq")))
        new_short_id = result.scalar()

        new_customer = Customer(
            organization_id=self.target_organization_id,
            email=original_customer.email,
            email_verified=original_customer.email_verified,
            name=original_customer.name,
            billing_name=original_customer.billing_name,
            billing_address=original_customer.billing_address,
            tax_id=original_customer.tax_id,
            short_id=new_short_id,
            stripe_customer_id=None,  # Will be created if needed
            external_id=None,  # Can be set later if needed
            metadata=original_customer.metadata,
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
        """Handle discounts that are used by both transferring and non-transferring products."""
        if not self.discounts_to_split:
            print("[bold blue]ℹ️  No discounts to split[/bold blue]")
            return

        print("[bold yellow]🔄 Splitting discounts...[/bold yellow]")

        for discount in self.discounts_to_split:
            print(
                f"[bold blue]🏷️  Splitting discount {discount.code or discount.name}[/bold blue]"
            )

            # Create a new discount in the target organization with the same properties
            new_discount = Discount(
                organization_id=self.target_organization_id,
                name=discount.name,
                type=discount.type,
                code=discount.code,  # Keep the same code for consistency
                starts_at=discount.starts_at,
                ends_at=discount.ends_at,
                max_redemptions=discount.max_redemptions,
                duration=discount.duration,
                duration_in_months=discount.duration_in_months,
                redemptions_count=0,  # Reset redemption count for the new discount
            )

            session.add(new_discount)
            await session.flush()  # Get the new discount ID

            # Update discount redemptions for transferring products to use the new discount
            # Find redemptions linked to transferring products
            redemptions_to_update_result = await session.execute(
                select(DiscountRedemption).where(
                    and_(
                        DiscountRedemption.discount_id == discount.id,
                        or_(
                            DiscountRedemption.checkout_id.in_(
                                select(Checkout.id).where(
                                    Checkout.product_id.in_(
                                        [p.id for p in self.products]
                                    )
                                )
                            ),
                            DiscountRedemption.subscription_id.in_(
                                select(Subscription.id).where(
                                    Subscription.product_id.in_(
                                        [p.id for p in self.products]
                                    )
                                )
                            ),
                        ),
                    )
                )
            )
            redemptions_to_update = redemptions_to_update_result.scalars().all()

            for redemption in redemptions_to_update:
                redemption.discount_id = new_discount.id
                session.add(redemption)
                self.transfer_stats["discount_redemptions_updated"] += 1

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
            customer.organization_id = self.target_organization_id
            session.add(customer)
            self.transfer_stats["customers_transferred_directly"] += 1

        await session.flush()

    async def split_customers(self, session: AsyncSession) -> None:
        """Handle customer splitting for customers with mixed purchases."""
        if not self.customers_to_split:
            print("[bold blue]ℹ️  No customers to split[/bold blue]")
            return

        print("[bold yellow]🔄 Starting customer splitting...[/bold yellow]")

        for customer in self.customers_to_split:
            new_customer = await self.create_new_customer_for_split(session, customer)

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
                    )
                )
            )
            benefit_grants_to_update = benefit_grants_result.scalars().all()

            for grant in benefit_grants_to_update:
                grant.customer_id = new_customer.id
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
                session.add(downloadable)
                self.transfer_stats["downloadables_updated"] += 1

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

        # Update trial redemptions
        result = await session.execute(
            select(TrialRedemption).where(
                TrialRedemption.product_id.in_([p.id for p in self.products])
            )
        )
        trial_redemptions_to_update = result.scalars().all()

        for trial_redemption in trial_redemptions_to_update:
            # Trial redemption organization is derived from customer, which should already be updated
            session.add(
                trial_redemption
            )  # Ensure trial redemption is tracked by session
            self.transfer_stats["trial_redemptions_updated"] += 1

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
            # Find all new discounts created in target organization with similar names
            result = await session.execute(
                select(Discount.id).where(
                    and_(
                        Discount.organization_id == self.target_organization_id,
                        Discount.name.in_([d.name for d in self.discounts_to_split]),
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
