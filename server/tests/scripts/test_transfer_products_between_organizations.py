from uuid import UUID

import pytest
from sqlalchemy import func, select

from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.models import (
    Account,
    BenefitGrant,
    BillingEntry,
    Checkout,
    Customer,
    CustomerSeat,
    CustomerSession,
    Discount,
    DiscountRedemption,
    Downloadable,
    LicenseKey,
    LicenseKeyActivation,
    Member,
    Order,
    Organization,
    Payment,
    PaymentMethod,
    ProductBenefit,
    Refund,
    Subscription,
    SubscriptionUpdate,
    TrialRedemption,
    User,
)
from polar.models.benefit import BenefitType
from polar.models.billing_entry import BillingEntryType
from polar.models.customer import CustomerType
from polar.models.customer_seat import SeatStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.downloadable import DownloadableStatus
from polar.models.file import FileServiceTypes
from polar.models.member import MemberRole
from scripts.transfer_products_between_organizations import (
    CustomerSplitError,
    MixedOrganizationError,
    ProductTransferService,
    TransferValidationError,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_benefit,
    create_benefit_grant,
    create_billing_entry,
    create_checkout,
    create_checkout_link,
    create_customer,
    create_customer_seat,
    create_discount,
    create_discount_redemption,
    create_event,
    create_member,
    create_order,
    create_organization,
    create_payment,
    create_payment_method,
    create_product,
    create_refund,
    create_subscription,
    create_support_case_attachment_file,
    create_trial_redemption,
)


@pytest.mark.anyio
class TestProductTransferService:
    """Test the ProductTransferService class."""

    async def test_validate_organizations_exist_success(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test successful organization validation."""
        source_org = organization
        target_org = await create_organization(save_fixture, account_second)

        service = ProductTransferService(source_org.id, target_org.id)

        # Should not raise an exception
        await service.validate_organizations_exist(session)

        assert service.source_organization_id == source_org.id
        assert service.target_organization_id == target_org.id

    async def test_validate_organizations_exist_source_not_found(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test validation fails when source organization doesn't exist."""
        target_org = await create_organization(save_fixture, account_second)

        service = ProductTransferService(
            UUID("123e4567-e89b-12d3-a456-426614174000"), target_org.id
        )

        with pytest.raises(
            TransferValidationError, match="Source organization.*does not exist"
        ):
            await service.validate_organizations_exist(session)

    async def test_validate_organizations_exist_target_not_found(
        self, save_fixture: SaveFixture, session: AsyncSession, account: Account
    ) -> None:
        """Test validation fails when target organization doesn't exist."""
        source_org = await create_organization(save_fixture, account)

        service = ProductTransferService(
            source_org.id, UUID("123e4567-e89b-12d3-a456-426614174000")
        )

        with pytest.raises(
            TransferValidationError, match="Target organization.*does not exist"
        ):
            await service.validate_organizations_exist(session)

    async def test_validate_products_belong_to_same_organization_success(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test successful product validation when all products belong to same organization."""
        product1 = await create_product(
            save_fixture,
            organization=organization,
            name="Product 1",
            recurring_interval=None,
        )
        product2 = await create_product(
            save_fixture,
            organization=organization,
            name="Product 2",
            recurring_interval=None,
        )

        service = ProductTransferService(organization.id, organization.id)

        # Should not raise an exception
        await service.validate_products_belong_to_same_organization(
            session, [product1.id, product2.id]
        )

        assert len(service.products) == 2
        assert product1.id in [p.id for p in service.products]
        assert product2.id in [p.id for p in service.products]

    async def test_validate_products_belong_to_same_organization_mixed_orgs(
        self, save_fixture: SaveFixture, session: AsyncSession, user: User
    ) -> None:
        """Test validation fails when products belong to different organizations."""
        org1 = await create_organization(
            save_fixture, await create_account(save_fixture, user)
        )
        org2 = await create_organization(
            save_fixture, await create_account(save_fixture, user)
        )

        product1 = await create_product(
            save_fixture, organization=org1, name="Product 1", recurring_interval=None
        )
        product2 = await create_product(
            save_fixture, organization=org2, name="Product 2", recurring_interval=None
        )

        service = ProductTransferService(org1.id, org1.id)

        with pytest.raises(
            MixedOrganizationError, match="Products belong to multiple organizations"
        ):
            await service.validate_products_belong_to_same_organization(
                session, [product1.id, product2.id]
            )

    async def test_validate_products_not_found(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test validation fails when products don't exist."""
        service = ProductTransferService(organization.id, organization.id)

        with pytest.raises(TransferValidationError, match="No products found"):
            await service.validate_products_belong_to_same_organization(
                session, [UUID("123e4567-e89b-12d3-a456-426614174000")]
            )

    async def test_analyze_affected_data_no_customers_to_split(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test analysis when no customers need splitting."""
        # Create products
        product1 = await create_product(
            save_fixture,
            organization=organization,
            name="Product 1",
            recurring_interval=None,
        )
        product2 = await create_product(
            save_fixture,
            organization=organization,
            name="Product 2",
            recurring_interval=None,
        )

        # Create a customer with orders only for the products being transferred
        customer = await create_customer(save_fixture, organization=organization)
        order1 = await create_order(save_fixture, customer=customer, product=product1)
        order2 = await create_order(save_fixture, customer=customer, product=product2)

        service = ProductTransferService(organization.id, organization.id)
        service.products = [product1, product2]

        await service.analyze_affected_data(session)

        assert len(service.benefits_to_transfer) >= 0  # May have benefits
        assert len(service.customers_to_split) == 0  # No customers to split
        assert (
            len(service.customers_to_transfer) == 1
        )  # Customer should be transferred directly
        assert service.transfer_stats["products"] == 2
        assert service.transfer_stats["customers_to_transfer"] == 1

    async def test_analyze_affected_data_with_customers_to_split(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test analysis when customers need splitting."""
        # Create products - some will be transferred, some won't
        product_transfer1 = await create_product(
            save_fixture,
            organization=organization,
            name="Transfer Product 1",
            recurring_interval=None,
        )
        product_transfer2 = await create_product(
            save_fixture,
            organization=organization,
            name="Transfer Product 2",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=organization,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create a customer with orders for both transferring and non-transferring products
        customer = await create_customer(save_fixture, organization=organization)
        order_transfer1 = await create_order(
            save_fixture, customer=customer, product=product_transfer1
        )
        order_transfer2 = await create_order(
            save_fixture, customer=customer, product=product_transfer2
        )
        order_stay = await create_order(
            save_fixture, customer=customer, product=product_stay
        )

        service = ProductTransferService(organization.id, organization.id)
        service.products = [product_transfer1, product_transfer2]

        await service.analyze_affected_data(session)

        assert len(service.customers_to_split) == 1  # This customer needs splitting
        assert service.transfer_stats["products"] == 2
        assert service.transfer_stats["customers_to_split"] == 1

    async def test_customer_splitting_creates_new_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that customer splitting creates new customer records."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        # Create customer with order for the product
        customer = await create_customer(
            save_fixture,
            organization=source_org,
            user_metadata={"reference": "customer-123", "priority": 2},
        )
        order = await create_order(save_fixture, customer=customer, product=product)

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_split = [customer]

        await service.split_customers(session)

        # Check that a new customer was created in target organization
        assert len(service.new_customers_map) == 1
        new_customer = service.new_customers_map[customer.id]
        assert new_customer.organization_id == target_org.id
        assert new_customer.email == customer.email
        assert new_customer.name == customer.name
        await session.refresh(new_customer)
        assert new_customer.user_metadata == customer.user_metadata
        assert new_customer.user_metadata is not customer.user_metadata

        # Check that the order was updated to reference the new customer
        await session.refresh(order)
        assert order.customer_id == new_customer.id

    @pytest.mark.parametrize("target_match", [None, "email", "external_id"])
    async def test_customer_splitting_copies_members_and_remaps_entitlements(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        target_match: str | None,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="team@example.com" if target_match else None,
        )
        customer.type = CustomerType.team
        owner = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
            email="owner@example.com",
            external_id="owner-123",
        )
        owner._oauth_accounts = {
            "github:123": {"account_id": "123", "access_token": "test-token"},
            "discord:123": {"account_id": "123", "access_token": "discord-token"},
        }
        target_customer = None
        target_member = None
        if target_match:
            target_customer = await create_customer(
                save_fixture, organization=organization_second, email=customer.email
            )
            target_customer.type = CustomerType.team
            target_member = await create_member(
                save_fixture,
                customer=target_customer,
                organization=organization_second,
                email="OWNER@example.com"
                if target_match == "email"
                else "renamed@example.com",
                external_id=None if target_match == "email" else owner.external_id,
                role=MemberRole.billing_manager,
            )
            target_member._oauth_accounts = {
                "github:123": {"account_id": "123", "access_token": "target-token"},
                "github:456": {"account_id": "456", "access_token": "other-token"},
            }
        deleted_member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="deleted@example.com",
        )
        deleted_member.deleted_at = func.now()
        file = await create_support_case_attachment_file(
            save_fixture, organization, service=FileServiceTypes.downloadable
        )
        service = ProductTransferService(organization.id, organization_second.id)
        transferred: list[BenefitGrant | LicenseKey | Downloadable | CustomerSeat] = []
        staying: list[BenefitGrant | LicenseKey | Downloadable | CustomerSeat] = []
        for entities in (transferred, staying):
            product = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
            )
            subscription = await create_subscription(
                save_fixture, product=product, customer=customer
            )
            order = await create_order(save_fixture, product=product, customer=customer)
            license_benefit = await create_benefit(
                save_fixture, organization=organization, type=BenefitType.license_keys
            )
            download_benefit = await create_benefit(
                save_fixture, organization=organization, type=BenefitType.downloadables
            )
            for benefit in (license_benefit, download_benefit):
                entities.append(
                    await create_benefit_grant(
                        save_fixture,
                        customer,
                        benefit,
                        member=owner,
                        subscription=subscription,
                    )
                )
            license_key = LicenseKey(
                organization=organization,
                customer=customer,
                member=owner,
                benefit=license_benefit,
                key=f"license-{product.id}",
            )
            await save_fixture(license_key)
            downloadable = Downloadable(
                file=file,
                customer=customer,
                member=owner,
                benefit=download_benefit,
                status=DownloadableStatus.granted,
            )
            await save_fixture(downloadable)
            subscription_seat = await create_customer_seat(
                save_fixture,
                subscription=subscription,
                customer=customer,
                member=owner,
                status=SeatStatus.claimed,
            )
            order_seat = await create_customer_seat(
                save_fixture,
                order=order,
                customer=customer,
                member=owner,
                status=SeatStatus.claimed,
            )
            entities.extend([license_key, downloadable, subscription_seat, order_seat])
            if entities is transferred:
                service.products = [product]
                service.benefits_to_transfer = [license_benefit, download_benefit]

        service.customers_to_split = [customer]
        await service.split_customers(session)
        await session.flush()

        new_customer = target_customer or service.new_customers_map[customer.id]
        await session.refresh(new_customer)
        assert new_customer.type == CustomerType.team
        copied_members = (
            await session.scalars(
                select(Member).where(Member.customer_id == new_customer.id)
            )
        ).all()
        assert len(copied_members) == 2
        copied_owner = next(m for m in copied_members if m.deleted_at is None)
        assert copied_owner.id != owner.id
        if target_member:
            assert copied_owner.id == target_member.id
            assert copied_owner.role == MemberRole.billing_manager
            assert copied_owner.external_id == owner.external_id
            assert copied_owner.oauth_accounts == {
                "github:123": {"account_id": "123", "access_token": "target-token"},
                "github:456": {"account_id": "456", "access_token": "other-token"},
                "discord:123": {"account_id": "123", "access_token": "discord-token"},
            }
            assert service.transfer_stats["members_reused"] == 1
            assert service.transfer_stats["members_copied"] == 1
        else:
            assert copied_owner.email == owner.email
            assert copied_owner.name == owner.name
            assert copied_owner.external_id == owner.external_id
            assert copied_owner.oauth_accounts == owner.oauth_accounts
            assert copied_owner.role == MemberRole.owner
        assert all(m.organization_id == organization_second.id for m in copied_members)
        assert next(
            m for m in copied_members if m.email == deleted_member.email
        ).deleted_at
        for entity in transferred:
            await session.refresh(entity)
            assert entity.customer_id == new_customer.id
            assert entity.member_id == copied_owner.id
        for entity in staying:
            await session.refresh(entity)
            assert entity.customer_id == customer.id
            assert entity.member_id == owner.id
        await session.refresh(owner)
        assert owner.customer_id == customer.id
        assert owner.organization_id == organization.id

    @pytest.mark.parametrize("collision", ["different_members", "external_id", "owner"])
    async def test_customer_splitting_rejects_conflicting_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        collision: str,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        target_customer = await create_customer(
            save_fixture, organization=organization_second, email=customer.email
        )
        source_member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="owner@example.com",
            external_id="source-member",
            role=MemberRole.owner,
        )
        target_member = await create_member(
            save_fixture,
            customer=target_customer,
            organization=organization_second,
            email="other@example.com" if collision == "owner" else source_member.email,
            external_id="target-member",
            role=MemberRole.owner,
        )
        if collision == "different_members":
            await create_member(
                save_fixture,
                customer=target_customer,
                organization=organization_second,
                email="second@example.com",
                external_id=source_member.external_id,
            )
        service = ProductTransferService(organization.id, organization_second.id)
        service.customers_to_split = [customer]
        expected_message = {
            "different_members": "matches different target members",
            "external_id": "conflicting target identity",
            "owner": "already has a different owner",
        }[collision]

        with pytest.raises(CustomerSplitError, match=expected_message):
            await service.split_customers(session)

        for member in (source_member, target_member):
            await session.refresh(member)
            assert member.role == MemberRole.owner
        assert source_member.customer_id == customer.id
        assert target_member.customer_id == target_customer.id

    async def test_customer_splitting_with_existing_email_in_target(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that when splitting customers, if target customer exists with same email, use that instead of creating new."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        # Create customer in source org
        source_customer = await create_customer(
            save_fixture, organization=source_org, email="test@example.com"
        )
        order = await create_order(
            save_fixture, customer=source_customer, product=product
        )

        # Create customer with same email in target org
        target_customer = await create_customer(
            save_fixture, organization=target_org, email="test@example.com"
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_split = [source_customer]

        await service.split_customers(session)

        # Check that no new customer was created (existing target customer was used)
        assert len(service.new_customers_map) == 0

        # Check that the order was updated to reference the existing target customer
        await session.refresh(order)
        assert order.customer_id == target_customer.id

        # Check that source customer was NOT soft-deleted (since this is a split, not direct transfer)
        await session.refresh(source_customer)
        assert source_customer.deleted_at is None

    async def test_transfer_benefits_updates_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that benefits are transferred to target organization."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create product with benefit
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )
        benefit = await create_benefit(
            save_fixture, organization=source_org, type=BenefitType.custom
        )
        product_benefit = ProductBenefit(product=product, benefit=benefit, order=0)
        await save_fixture(product_benefit)

        service = ProductTransferService(source_org.id, target_org.id)
        service.benefits_to_transfer = [benefit]

        await service.transfer_benefits(session)

        # Check that benefit organization was updated
        await session.refresh(benefit)
        assert benefit.organization_id == target_org.id

    async def test_transfer_products_updates_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that products are transferred to target organization."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products
        product1 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 1",
            recurring_interval=None,
        )
        product2 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 2",
            recurring_interval=None,
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product1, product2]

        await service.transfer_products(session)

        # Check that products organization was updated
        await session.refresh(product1)
        await session.refresh(product2)
        assert product1.organization_id == target_org.id
        assert product2.organization_id == target_org.id

    async def test_transfer_customers_directly(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that customers with only transferring products are transferred directly."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create a product
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        # Create customer with order for only the transferring product
        customer = await create_customer(save_fixture, organization=source_org)
        order = await create_order(save_fixture, customer=customer, product=product)
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=source_org,
            role=MemberRole.owner,
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.customers_to_transfer = [customer]

        await service.transfer_customers_directly(session)

        # Check that customer organization was updated
        await session.refresh(customer)
        assert customer.organization_id == target_org.id
        assert service.transfer_stats["customers_transferred_directly"] == 1

        # Check that the order still belongs to the customer (should not be changed)
        await session.refresh(order)
        assert order.customer_id == customer.id
        await session.refresh(member)
        assert member.customer_id == customer.id
        assert member.organization_id == target_org.id
        assert member.role == MemberRole.owner

    async def test_transfer_customers_directly_with_existing_email_in_target(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that when a customer with the same email exists in target org, related objects are wired to the existing customer."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create a product
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        # Create customer in source org
        source_customer = await create_customer(
            save_fixture, organization=source_org, email="test@example.com"
        )
        order = await create_order(
            save_fixture, customer=source_customer, product=product
        )

        # Create customer with same email in target org
        target_customer = await create_customer(
            save_fixture, organization=target_org, email="test@example.com"
        )
        member = await create_member(
            save_fixture,
            customer=source_customer,
            organization=source_org,
            role=MemberRole.owner,
        )
        seat = await create_customer_seat(
            save_fixture,
            order=order,
            customer=source_customer,
            member=member,
            status=SeatStatus.claimed,
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.customers_to_transfer = [source_customer]

        await service.transfer_customers_directly(session)

        # Check that source customer was soft-deleted (since target customer exists)
        await session.refresh(source_customer)
        assert source_customer.deleted_at is not None
        assert source_customer.organization_id == source_org.id  # Still in source org

        # Check that order was updated to reference the target customer
        await session.refresh(order)
        assert order.customer_id == target_customer.id
        await session.refresh(member)
        assert member.customer_id == target_customer.id
        assert member.organization_id == target_org.id
        assert member.role == MemberRole.owner
        await session.refresh(seat)
        assert seat.customer_id == target_customer.id
        assert seat.member_id == member.id

        # Check stats
        assert service.transfer_stats["customers_transferred_directly"] == 0
        assert service.transfer_stats["customers_merged"] == 1

    @pytest.mark.parametrize("split_customer", [False, True])
    async def test_customer_without_email_does_not_match_target_customers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        split_customer: bool,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email=None
        )
        target_customers = [
            await create_customer(
                save_fixture, organization=organization_second, email=None
            )
            for _ in range(2)
        ]
        service = ProductTransferService(organization.id, organization_second.id)

        if split_customer:
            transferred_customer = await service.create_new_customer_for_split(
                session, customer
            )
            assert transferred_customer.id != customer.id
            assert customer.organization_id == organization.id
        else:
            service.customers_to_transfer = [customer]
            await service.transfer_customers_directly(session)
            transferred_customer = customer

        await session.refresh(transferred_customer)
        assert transferred_customer.organization_id == organization_second.id
        assert transferred_customer.email is None
        assert transferred_customer.deleted_at is None
        assert transferred_customer.id not in [c.id for c in target_customers]
        assert not service.customers_to_merge

    @pytest.mark.parametrize("existing_target", [False, True])
    async def test_split_customer_copies_payment_methods(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        existing_target: bool,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        default_method = await create_payment_method(
            save_fixture, customer, method_metadata={"last4": "4242"}
        )
        subscription_method = await create_payment_method(save_fixture, customer)
        customer.default_payment_method = default_method
        existing_method = None
        if existing_target:
            target_customer = await create_customer(
                save_fixture,
                organization=organization_second,
                stripe_customer_id=None,
            )
            existing_method = await create_payment_method(
                save_fixture,
                target_customer,
                processor_id=subscription_method.processor_id,
            )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        staying_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=subscription_method,
        )
        staying_subscription = await create_subscription(
            save_fixture,
            product=staying_product,
            customer=customer,
            payment_method=subscription_method,
        )
        service = ProductTransferService(organization.id, organization_second.id)
        service.products = [product]
        await service.execute_transfer(session)

        await session.refresh(subscription)
        await session.refresh(staying_subscription)
        await session.refresh(customer)
        new_customer = await session.get(Customer, subscription.customer_id)
        assert new_customer is not None
        assert new_customer.stripe_customer_id == customer.stripe_customer_id
        target_methods = (
            await session.scalars(
                select(PaymentMethod).where(
                    PaymentMethod.customer_id == new_customer.id
                )
            )
        ).all()
        assert len(target_methods) == 2
        copied_default = next(
            method
            for method in target_methods
            if method.processor_id == default_method.processor_id
        )
        copied_subscription_method = next(
            method
            for method in target_methods
            if method.processor_id == subscription_method.processor_id
        )
        assert copied_default.id != default_method.id
        assert copied_default.method_metadata == default_method.method_metadata
        assert copied_default.type == default_method.type
        assert copied_default.processor == default_method.processor
        assert new_customer.default_payment_method_id == copied_default.id
        assert subscription.payment_method_id == copied_subscription_method.id
        if existing_method is not None:
            assert copied_subscription_method.id == existing_method.id
        assert staying_subscription.payment_method_id == subscription_method.id
        assert customer.default_payment_method_id == default_method.id
        for original_method in (default_method, subscription_method):
            await session.refresh(original_method)
            assert original_method.customer_id == customer.id

    async def test_copy_payment_methods_rejects_different_stripe_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        target_customer = await create_customer(
            save_fixture,
            organization=organization_second,
            stripe_customer_id="cus_other",
        )
        service = ProductTransferService(organization.id, organization_second.id)
        with pytest.raises(CustomerSplitError, match="different Stripe customer ID"):
            await service.copy_payment_methods(session, customer, target_customer, [])
        assert target_customer.stripe_customer_id == "cus_other"

    async def test_transfer_discounts_directly(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that discounts used only by transferring products are transferred directly."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create a product
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        # Create a discount using the helper function
        from polar.models.discount import DiscountDuration, DiscountType

        discount = await create_discount(
            save_fixture,
            organization=source_org,
            products=[product],
            type=DiscountType.fixed,
            amounts={"usd": 1000},
            duration=DiscountDuration.once,
        )

        # For this test, we'll just verify the discount transfer functionality
        # without creating complex checkout structures. The analysis phase would
        # normally find discounts linked to transferring products via redemptions.
        # Here we directly test the transfer logic.

        service = ProductTransferService(source_org.id, target_org.id)
        service.discounts_to_transfer = [discount]

        await service.transfer_discounts_directly(session)

        # Check that discount organization was updated
        await session.refresh(discount)
        assert discount.organization_id == target_org.id
        assert service.transfer_stats["discounts_transferred_directly"] == 1

    @pytest.mark.parametrize(
        "discount_type", [DiscountType.fixed, DiscountType.percentage]
    )
    async def test_split_discounts(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        discount_type: DiscountType,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        product_transfer = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        product_stay = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        discount: Discount
        if discount_type == DiscountType.fixed:
            discount = await create_discount(
                save_fixture,
                organization=organization,
                products=[product_transfer, product_stay],
                type=DiscountType.fixed,
                amounts={"usd": 1000, "eur": 900},
                duration=DiscountDuration.repeating,
                duration_in_months=3,
            )
        else:
            discount = await create_discount(
                save_fixture,
                organization=organization,
                products=[product_transfer, product_stay],
                type=DiscountType.percentage,
                basis_points=2500,
                duration=DiscountDuration.repeating,
                duration_in_months=3,
            )
        discount.code = "SAVE"
        discount.external_id = "save-discount"
        discount.user_metadata = {"campaign": "launch"}
        discount.max_redemptions = 8
        discount.max_redemptions_per_customer = 3
        await create_discount(
            save_fixture,
            organization=organization_second,
            name=discount.name,
            type=DiscountType.fixed,
            amounts={"usd": 500},
            duration=DiscountDuration.once,
        )
        transferred: list[
            Checkout
            | Order
            | Subscription
            | BillingEntry
            | SubscriptionUpdate
            | DiscountRedemption
        ] = []
        staying: list[
            Checkout
            | Order
            | Subscription
            | BillingEntry
            | SubscriptionUpdate
            | DiscountRedemption
        ] = []
        for product, references in (
            (product_transfer, transferred),
            (product_stay, staying),
        ):
            checkout = await create_checkout(
                save_fixture, products=[product], customer=customer, discount=discount
            )
            subscription = await create_subscription(
                save_fixture, product=product, customer=customer, discount=discount
            )
            order = await create_order(
                save_fixture,
                product=product,
                customer=customer,
                subscription=subscription,
                checkout=checkout,
                discount=discount,
            )
            billing_entry = await create_billing_entry(
                save_fixture,
                type=BillingEntryType.cycle,
                customer=customer,
                product_price=product.prices[0],
                subscription=subscription,
            )
            billing_entry.discount = discount
            pending_update = SubscriptionUpdate(
                subscription=subscription,
                product=product,
                discount=discount,
                applies_at=subscription.current_period_end,
                proration_behavior=SubscriptionProrationBehavior.next_period,
            )
            await save_fixture(pending_update)
            checkout_redemption = await create_discount_redemption(
                save_fixture, discount=discount, checkout=checkout
            )
            subscription_redemption = await create_discount_redemption(
                save_fixture, discount=discount, subscription=subscription
            )
            references.extend(
                [
                    checkout,
                    subscription,
                    order,
                    billing_entry,
                    pending_update,
                    checkout_redemption,
                    subscription_redemption,
                ]
            )

        service = ProductTransferService(organization.id, organization_second.id)
        service.products = [product_transfer]
        await session.flush()
        await session.refresh(discount, attribute_names=["type"])
        assert type(discount.type) is str
        await service.execute_transfer(session)

        new_discount = service.new_discounts_map[discount.id]
        await session.refresh(new_discount)
        await session.refresh(discount)
        assert new_discount.organization_id == organization_second.id
        assert discount.organization_id == organization.id
        for attribute in (
            "code",
            "external_id",
            "user_metadata",
            "type",
            "duration",
            "duration_in_months",
            "max_redemptions",
            "max_redemptions_per_customer",
        ):
            assert getattr(new_discount, attribute) == getattr(discount, attribute)
        for currency in ("usd", "eur"):
            assert new_discount.get_discount_amount(
                5000, currency
            ) == discount.get_discount_amount(5000, currency)
        assert new_discount.redemptions_count == 2
        assert discount.redemptions_count == 2
        assert [p.id for p in new_discount.products] == [product_transfer.id]
        assert [p.id for p in discount.products] == [product_stay.id]
        for reference in transferred:
            await session.refresh(reference)
            assert reference.discount_id == new_discount.id
        for reference in staying:
            await session.refresh(reference)
            assert reference.discount_id == discount.id

    @pytest.mark.parametrize("with_redemptions", [False, True])
    async def test_analyze_discounts(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
        with_redemptions: bool,
    ) -> None:
        """Test that discount analysis correctly categorizes discounts."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create discount only for transferring product (should be transferred directly)
        discount_direct = await create_discount(
            save_fixture,
            organization=source_org,
            products=[product_transfer],  # Only transferring product
            type=DiscountType.fixed,
            amounts={"usd": 1000},
            duration=DiscountDuration.once,
            code="DIRECT10",
        )

        # Create discount for both products (should be split)
        discount_split = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10000,
            duration=DiscountDuration.once,
            organization=source_org,
            products=[product_transfer, product_stay],  # Both products
        )

        # Create discount only for staying product (should not be transferred)
        discount_stay = await create_discount(
            save_fixture,
            organization=source_org,
            products=[product_stay],  # Only staying product
            type=DiscountType.fixed,
            amounts={"usd": 500},
            duration=DiscountDuration.once,
            code="STAY5",
        )

        discount_global = await create_discount(
            save_fixture,
            organization=source_org,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
        )
        if with_redemptions:
            checkout_transfer = await create_checkout(
                save_fixture, products=[product_transfer], product=product_transfer
            )
            checkout_stay = await create_checkout(
                save_fixture, products=[product_stay], product=product_stay
            )
            await create_discount_redemption(
                save_fixture, discount=discount_direct, checkout=checkout_transfer
            )
            await create_discount_redemption(
                save_fixture, discount=discount_split, checkout=checkout_transfer
            )
            await create_discount_redemption(
                save_fixture, discount=discount_split, checkout=checkout_stay
            )
            await create_discount_redemption(
                save_fixture, discount=discount_stay, checkout=checkout_stay
            )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product_transfer]

        await service._analyze_discounts(session)

        assert service.discounts_to_transfer == [discount_direct]
        assert {d.id for d in service.discounts_to_split} == {
            discount_split.id,
            discount_global.id,
        }

    @pytest.mark.parametrize("restriction", ["global", "transferred", "retained"])
    async def test_split_discount_does_not_broaden_product_restrictions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        restriction: str,
    ) -> None:
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        staying_product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        products = {
            "global": [],
            "transferred": [product],
            "retained": [staying_product],
        }[restriction]
        discount = await create_discount(
            save_fixture,
            organization=organization,
            products=products,
            type=DiscountType.fixed,
            amounts={"usd": 1000},
            duration=DiscountDuration.once,
        )
        customer = await create_customer(save_fixture, organization=organization)
        order = await create_order(
            save_fixture, product=product, customer=customer, discount=discount
        )
        staying_order = await create_order(
            save_fixture, customer=customer, discount=discount
        )
        service = ProductTransferService(organization.id, organization_second.id)
        service.products = [product]
        await service._analyze_discounts(session)
        assert service.discounts_to_split == [discount]
        await service.split_discounts(session)

        copied_discount = service.new_discounts_map[discount.id]
        await session.refresh(order)
        await session.refresh(staying_order)
        assert order.discount_id == copied_discount.id
        assert staying_order.discount_id == discount.id
        assert (discount.deleted_at is not None) == (restriction == "transferred")
        assert (copied_discount.deleted_at is not None) == (restriction == "retained")
        assert [p.id for p in copied_discount.products] == (
            [product.id] if restriction == "transferred" else []
        )
        assert [p.id for p in discount.products] == (
            [staying_product.id] if restriction == "retained" else []
        )

    async def test_validate_transfer_success(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test successful transfer validation."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products
        product1 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 1",
            recurring_interval=None,
        )
        product2 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 2",
            recurring_interval=None,
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product1, product2]
        service.benefits_to_transfer = []  # No benefits to transfer
        service.customers_to_transfer = []  # No customers to transfer

        # Manually update the products to target org (simulating transfer)
        product1.organization_id = target_org.id
        product2.organization_id = target_org.id
        await session.flush()

        # Validation should pass
        await service.validate_transfer(session)

    async def test_validate_transfer_with_existing_customers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test transfer validation when customers with existing emails are handled."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        # Create customer in source org
        source_customer = await create_customer(
            save_fixture, organization=source_org, email="test@example.com"
        )
        order = await create_order(
            save_fixture, customer=source_customer, product=product
        )

        # Create customer with same email in target org
        target_customer = await create_customer(
            save_fixture, organization=target_org, email="test@example.com"
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.benefits_to_transfer = []
        service.customers_to_transfer = []  # No customers to transfer directly
        service.customers_to_merge = [source_customer]  # This customer should be merged

        # Simulate the transfer: source customer is soft-deleted, order wired to target customer
        source_customer.deleted_at = func.now()
        order.customer_id = target_customer.id
        product.organization_id = target_org.id
        await session.flush()

        # Validation should pass - source customer was merged (soft-deleted)
        await service.validate_transfer(session)

    async def test_validate_transfer_failure(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test transfer validation fails when not all products were transferred."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products
        product1 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 1",
            recurring_interval=None,
        )
        product2 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 2",
            recurring_interval=None,
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product1, product2]
        service.benefits_to_transfer = []

        # Only transfer one product (simulating partial transfer)
        product1.organization_id = target_org.id
        await session.flush()

        # Validation should fail
        with pytest.raises(
            TransferValidationError, match="Not all products were transferred"
        ):
            await service.validate_transfer(session)

    async def test_analyze_checkout_links(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that checkout links containing transferring products are identified."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create checkout link with transferring product
        checkout_link_with_transfer = await create_checkout_link(
            save_fixture,
            products=[product_transfer],
        )

        # Create checkout link with staying product
        checkout_link_with_stay = await create_checkout_link(
            save_fixture,
            products=[product_stay],
        )

        # Create checkout link with both products
        checkout_link_with_both = await create_checkout_link(
            save_fixture,
            products=[product_transfer, product_stay],
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product_transfer]

        await service._analyze_checkout_links(session)

        # Should find checkout links that contain the transferring product
        assert len(service.checkout_links_to_update) == 2
        assert checkout_link_with_transfer in service.checkout_links_to_update
        assert checkout_link_with_both in service.checkout_links_to_update
        assert checkout_link_with_stay not in service.checkout_links_to_update

        assert service.transfer_stats["checkout_links_to_update"] == 2

    async def test_update_checkout_links(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that checkout links are updated by removing transferring products."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create checkout link with both products
        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product_transfer, product_stay],
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product_transfer]
        service.checkout_links_to_update = [checkout_link]

        await service._update_checkout_links(session)

        # Verify the checkout link was updated
        await session.refresh(checkout_link)
        assert len(checkout_link.checkout_link_products) == 1
        assert checkout_link.checkout_link_products[0].product_id == product_stay.id

        assert service.transfer_stats["checkout_links_updated"] == 1

    async def test_update_checkout_links_soft_delete_when_empty(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that checkout links are soft deleted when all products are removed."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create a single product
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )

        # Create checkout link with only the transferring product
        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product_transfer],
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product_transfer]
        service.checkout_links_to_update = [checkout_link]

        await service._update_checkout_links(session)

        # Verify the checkout link was soft deleted
        await session.refresh(checkout_link)
        assert checkout_link.deleted_at is not None

        assert service.transfer_stats["checkout_links_soft_deleted"] == 1

    async def test_analyze_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that events are properly analyzed for transfer."""
        # Setup: Create source and target orgs, products, customers, and events
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)
        product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )

        # Customer with only transferring product (should have events transferred)
        customer_direct = await create_customer(
            save_fixture, organization=source_org, email="customer_direct@example.com"
        )
        await create_order(save_fixture, customer=customer_direct, product=product)

        # Create events for the direct customer
        event1 = await create_event(
            save_fixture, customer=customer_direct, organization=source_org
        )
        event2 = await create_event(
            save_fixture, customer=customer_direct, organization=source_org
        )

        # Customer with mixed purchases (should NOT have events transferred)
        customer_split = await create_customer(
            save_fixture, organization=source_org, email="customer_split@example.com"
        )
        other_product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )
        await create_order(save_fixture, customer=customer_split, product=product)
        await create_order(save_fixture, customer=customer_split, product=other_product)
        await create_event(
            save_fixture, customer=customer_split, organization=source_org
        )

        # Test
        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_transfer = [customer_direct]
        service.customers_to_split = [customer_split]

        await service._analyze_events(session)

        # Verify
        assert len(service.events_to_transfer) == 2
        assert {event1.id, event2.id} == {e.id for e in service.events_to_transfer}

    async def test_transfer_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that events are properly transferred."""
        # Setup
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)
        product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )
        customer = await create_customer(
            save_fixture, organization=source_org, email="customer_test@example.com"
        )
        await create_order(save_fixture, customer=customer, product=product)

        event1 = await create_event(
            save_fixture, customer=customer, organization=source_org
        )
        event2 = await create_event(
            save_fixture, customer=customer, organization=source_org
        )

        # Test
        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_transfer = [customer]
        service.events_to_transfer = [event1, event2]

        await service.transfer_events(session)

        # Verify events are updated
        await session.refresh(event1)
        await session.refresh(event2)

        assert event1.organization_id == target_org.id
        assert event2.organization_id == target_org.id
        assert service.transfer_stats["events_transferred"] == 2

    async def test_events_not_transferred_for_split_customers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that events for split customers are NOT transferred."""
        # Setup
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)
        product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )
        other_product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )

        customer = await create_customer(
            save_fixture,
            organization=source_org,
            email="customer_split_test@example.com",
        )
        await create_order(save_fixture, customer=customer, product=product)
        await create_order(save_fixture, customer=customer, product=other_product)

        event = await create_event(
            save_fixture, customer=customer, organization=source_org
        )

        # Test
        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_split = [customer]  # This is a split customer

        await service._analyze_events(session)

        # Verify no events are selected for transfer
        assert len(service.events_to_transfer) == 0

    async def test_events_transferred_for_merged_customers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test that events for merged customers ARE transferred."""
        # Setup
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)
        product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )

        # Create customer in source org
        source_customer = await create_customer(
            save_fixture, organization=source_org, email="merge_test@example.com"
        )
        await create_order(save_fixture, customer=source_customer, product=product)

        # Create customer with same email in target org
        target_customer = await create_customer(
            save_fixture, organization=target_org, email="merge_test@example.com"
        )

        # Create events for the source customer
        event1 = await create_event(
            save_fixture, customer=source_customer, organization=source_org
        )
        event2 = await create_event(
            save_fixture, customer=source_customer, organization=source_org
        )

        # Test
        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_transfer = [source_customer]
        service.customers_to_merge = []  # Will be populated during transfer

        # Simulate the transfer process
        await service._analyze_events(session)  # Analyze events first
        await service.transfer_customers_directly(session)

        # Verify events were found for transfer (including merged customer)
        assert len(service.events_to_transfer) == 2
        assert event1.id in [e.id for e in service.events_to_transfer]
        assert event2.id in [e.id for e in service.events_to_transfer]


@pytest.mark.anyio
class TestProductTransferIntegration:
    """Integration tests for the complete product transfer workflow."""

    @pytest.mark.parametrize("mode", ["direct", "merge", "split"])
    async def test_license_keys_follow_transferred_benefits(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        mode: str,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        target_customer = None
        if mode == "merge":
            target_customer = await create_customer(
                save_fixture, organization=organization_second, email=customer.email
            )
        staying_customer = (
            customer
            if mode == "split"
            else await create_customer(
                save_fixture, organization=organization, email="staying@example.com"
            )
        )
        keys = []
        for current_customer in (customer, staying_customer):
            product = await create_product(
                save_fixture, organization=organization, recurring_interval=None
            )
            benefit = await create_benefit(
                save_fixture, organization=organization, type=BenefitType.license_keys
            )
            await save_fixture(
                ProductBenefit(product=product, benefit=benefit, order=0)
            )
            order = await create_order(
                save_fixture, customer=current_customer, product=product
            )
            key = LicenseKey(
                customer=current_customer,
                organization=organization,
                benefit=benefit,
                key=f"key-{product.id}",
                usage=3,
                limit_usage=10,
            )
            await save_fixture(key)
            grant = await create_benefit_grant(
                save_fixture,
                current_customer,
                benefit,
                order=order,
                properties={"license_key_id": str(key.id)},
            )
            activation = LicenseKeyActivation(license_key=key, label="Existing device")
            await save_fixture(activation)
            keys.append((product, benefit, key, grant, activation))
        service = ProductTransferService(organization.id, organization_second.id)
        service.products = [keys[0][0]]

        await service.execute_transfer(session)

        expected_customer = (
            service.new_customers_map[customer.id]
            if mode == "split"
            else target_customer or customer
        )
        for index, (_, benefit, key, grant, activation) in enumerate(keys):
            for entity in (benefit, key, grant, activation):
                await session.refresh(entity)
            expected_org = organization_second if index == 0 else organization
            assert benefit.organization_id == key.organization_id == expected_org.id
            assert (
                key.customer_id
                == grant.customer_id
                == (expected_customer.id if index == 0 else staying_customer.id)
            )
            assert key.benefit_id == grant.benefit_id == benefit.id
            assert grant.properties.get("license_key_id") == str(key.id)
            assert activation.license_key_id == key.id
            assert key.usage == 3
            assert key.limit_usage == 10

    @pytest.mark.parametrize("retained_association", [False, True])
    @pytest.mark.parametrize(
        "benefit_type",
        [BenefitType.custom, BenefitType.license_keys, BenefitType.downloadables],
    )
    async def test_shared_benefits_preserve_retained_entitlements(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        benefit_type: BenefitType,
        retained_association: bool,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        member = await create_member(
            save_fixture, customer=customer, organization=organization
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        staying_product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        order = await create_order(
            save_fixture, product=staying_product, customer=customer
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=benefit_type,
            external_id="shared-benefit",
            selectable=False,
            deletable=False,
        )
        benefit.user_metadata = {"source": "shared"}
        await save_fixture(ProductBenefit(product=product, benefit=benefit, order=0))
        if retained_association:
            await save_fixture(
                ProductBenefit(product=staying_product, benefit=benefit, order=0)
            )
        moving_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit,
            member=member,
            subscription=subscription,
            granted=True,
        )
        staying_grant = await create_benefit_grant(
            save_fixture, customer, benefit, member=member, order=order, granted=False
        )
        keys = []
        activations = []
        downloadable = None
        customer_downloadable = None
        if benefit_type == BenefitType.license_keys:
            for grant in (moving_grant, staying_grant):
                key = LicenseKey(
                    customer=customer,
                    member=member,
                    organization=organization,
                    benefit=benefit,
                    key=f"key-{grant.id}",
                )
                await save_fixture(key)
                grant.properties = {"license_key_id": str(key.id)}
                activation = LicenseKeyActivation(
                    license_key=key, label="Existing device"
                )
                await save_fixture(activation)
                keys.append(key)
                activations.append(activation)
        elif benefit_type == BenefitType.downloadables:
            file = await create_support_case_attachment_file(
                save_fixture, organization, service=FileServiceTypes.downloadable
            )
            benefit.properties = {"files": [str(file.id)], "archived": {}}
            downloadable = Downloadable(
                customer=customer,
                member=member,
                benefit=benefit,
                file=file,
                status=DownloadableStatus.granted,
                downloaded=7,
            )
            await save_fixture(downloadable)
            for grant in (moving_grant, staying_grant):
                grant.properties = {"files": [str(file.id)]}
            await create_benefit_grant(
                save_fixture,
                customer,
                benefit,
                subscription=subscription,
                properties={"files": [str(file.id)]},
            )
            customer_downloadable = Downloadable(
                customer=customer,
                benefit=benefit,
                file=file,
                status=DownloadableStatus.granted,
            )
            await save_fixture(customer_downloadable)
        await session.flush()
        service = ProductTransferService(organization.id, organization_second.id)
        service.products = [product]

        await service.execute_transfer(session)

        new_benefit = service.new_benefits_map[benefit.id]
        new_customer = service.new_customers_map[customer.id]
        for entity in (benefit, new_benefit, moving_grant, staying_grant):
            await session.refresh(entity)
        assert benefit.organization_id == organization.id
        assert new_benefit.organization_id == organization_second.id
        for attribute in (
            "type",
            "description",
            "is_tax_applicable",
            "selectable",
            "deletable",
            "visibility",
            "external_id",
            "properties",
            "user_metadata",
        ):
            assert getattr(new_benefit, attribute) == getattr(benefit, attribute)
        assert moving_grant.benefit_id == new_benefit.id
        assert moving_grant.customer_id == new_customer.id
        assert moving_grant.member_id != member.id
        assert moving_grant.granted_at is not None
        assert staying_grant.benefit_id == benefit.id
        assert staying_grant.customer_id == customer.id
        assert staying_grant.member_id == member.id
        assert staying_grant.revoked_at is not None
        associations = (
            await session.scalars(
                select(ProductBenefit).where(
                    ProductBenefit.product_id.in_([product.id, staying_product.id])
                )
            )
        ).all()
        assert {
            (association.product_id, association.benefit_id)
            for association in associations
        } == (
            {(product.id, new_benefit.id), (staying_product.id, benefit.id)}
            if retained_association
            else {(product.id, new_benefit.id)}
        )
        for index, (key, activation) in enumerate(zip(keys, activations, strict=True)):
            await session.refresh(key)
            await session.refresh(activation)
            grant = moving_grant if index == 0 else staying_grant
            assert key.benefit_id == grant.benefit_id
            assert key.customer_id == grant.customer_id
            assert key.member_id == grant.member_id
            assert key.organization_id == (
                organization_second.id if index == 0 else organization.id
            )
            assert grant.properties.get("license_key_id") == str(key.id)
            assert activation.license_key_id == key.id
        if downloadable is not None:
            await session.refresh(downloadable)
            copied = (
                await session.scalars(
                    select(Downloadable).where(
                        Downloadable.benefit_id == new_benefit.id,
                        Downloadable.member_id == moving_grant.member_id,
                    )
                )
            ).one()
            assert downloadable.customer_id == customer.id
            assert downloadable.member_id == member.id
            assert downloadable.benefit_id == benefit.id
            assert copied.id != downloadable.id
            assert copied.customer_id == new_customer.id
            assert copied.member_id == moving_grant.member_id
            assert copied.file_id == downloadable.file_id
            assert copied.downloaded == downloadable.downloaded == 7
            assert copied.status == downloadable.status
            assert customer_downloadable is not None
            await session.refresh(customer_downloadable)
            assert customer_downloadable.benefit_id == new_benefit.id
            assert customer_downloadable.customer_id == new_customer.id
            assert customer_downloadable.member_id is None

    async def test_historical_benefit_discovery_and_shared_key_rejection(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        benefit = await create_benefit(
            save_fixture, organization=organization, type=BenefitType.license_keys
        )
        key = LicenseKey(
            customer=customer,
            organization=organization,
            benefit=benefit,
            key="shared-key",
        )
        await save_fixture(key)
        products = []
        for _ in range(2):
            product = await create_product(
                save_fixture, organization=organization, recurring_interval=None
            )
            order = await create_order(save_fixture, customer=customer, product=product)
            await create_benefit_grant(
                save_fixture,
                customer,
                benefit,
                order=order,
                properties={"license_key_id": str(key.id)},
            )
            products.append(product)
        service = ProductTransferService(organization.id, organization_second.id)
        service.products = products[:1]

        await service.analyze_affected_data(session)

        assert service.benefits_to_split == [benefit]
        assert service.benefits_to_transfer == []
        with pytest.raises(TransferValidationError, match="license key shared"):
            await service.split_benefits(session)
        await session.refresh(key)
        assert key.organization_id == organization.id
        assert key.benefit_id == benefit.id

    @pytest.mark.parametrize("mode", ["merge", "split_new", "split_existing"])
    @pytest.mark.parametrize("target_external_id", [None, "target_customer"])
    async def test_customer_references_follow_transferred_purchases(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        mode: str,
        target_external_id: str | None,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, external_id="source_customer"
        )
        target_customer = None
        if mode != "split_new":
            target_customer = await create_customer(
                save_fixture,
                organization=organization_second,
                email=customer.email,
                external_id=target_external_id,
            )
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        staying_product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        staying_customer = (
            customer
            if mode.startswith("split")
            else await create_customer(
                save_fixture, organization=organization, email="staying@example.com"
            )
        )
        moving_references: list[Checkout | Order | Refund | TrialRedemption] = []
        staying_references: list[Checkout | Order | Refund | TrialRedemption] = []
        for current_product, current_customer, references in (
            (product, customer, moving_references),
            (staying_product, staying_customer, staying_references),
        ):
            checkout = await create_checkout(
                save_fixture,
                products=[current_product],
                customer=current_customer,
                external_customer_id=current_customer.external_id,
            )
            external_checkout = await create_checkout(
                save_fixture,
                products=[current_product],
                external_customer_id=current_customer.external_id,
            )
            order = await create_order(
                save_fixture, product=current_product, customer=current_customer
            )
            references.extend([checkout, external_checkout, order])
            for payment in (
                await create_payment(save_fixture, organization, order=order),
                await create_payment(save_fixture, organization, checkout=checkout),
            ):
                references.append(
                    await create_refund(
                        save_fixture,
                        order,
                        payment,
                        processor_id=f"refund_{payment.id}",
                    )
                )
            references.append(
                await create_trial_redemption(
                    save_fixture,
                    customer=current_customer,
                    customer_email="customer@example.com",
                    product=current_product,
                )
            )
        customer_session = CustomerSession(customer=customer, token="source_session")
        await save_fixture(customer_session)
        events = [
            await create_event(
                save_fixture, organization=organization, customer=customer
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id=customer.external_id,
            ),
        ]
        staying_customer_ids = [
            reference.customer_id for reference in staying_references
        ]

        service = ProductTransferService(organization.id, organization_second.id)
        service.products = [product]
        await service.execute_transfer(session)

        if target_customer is None:
            target_customer = service.new_customers_map[customer.id]
        for reference in moving_references:
            await session.refresh(reference)
            assert reference.customer_id == target_customer.id
            if isinstance(reference, Checkout):
                assert reference.external_customer_id == target_customer.external_id
        for reference, original_customer_id in zip(
            staying_references, staying_customer_ids, strict=True
        ):
            await session.refresh(reference)
            assert reference.customer_id == original_customer_id
        await session.refresh(customer_session)
        assert customer_session.customer_id == (
            target_customer.id if mode == "merge" else customer.id
        )
        for event in events:
            await session.refresh(event)
        if mode == "merge":
            for event in events:
                assert event.customer_id == target_customer.id
                assert event.external_customer_id == target_customer.external_id
                assert event.organization_id == organization_second.id
        else:
            assert events[0].customer_id == customer.id
            assert events[1].customer_id is None
            assert events[1].external_customer_id == customer.external_id
            assert all(event.organization_id == organization.id for event in events)

    @pytest.mark.parametrize("split_customer", [False, True])
    async def test_complete_transfer_updates_organization_ownership(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
        split_customer: bool,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        staying_customer = (
            customer
            if split_customer
            else await create_customer(
                save_fixture, organization=organization, email="staying@example.com"
            )
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        staying_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        transferred_entities: list[
            Subscription | Checkout | Order | Payment | Refund
        ] = []
        staying_entities: list[Subscription | Checkout | Order | Payment | Refund] = []
        for current_product, current_customer, entities in (
            (product, customer, transferred_entities),
            (staying_product, staying_customer, staying_entities),
        ):
            subscription = await create_subscription(
                save_fixture, product=current_product, customer=current_customer
            )
            checkout = await create_checkout(
                save_fixture, products=[current_product], customer=current_customer
            )
            order = await create_order(
                save_fixture,
                product=current_product,
                customer=current_customer,
                subscription=subscription,
                checkout=checkout,
            )
            payment = await create_payment(save_fixture, organization, order=order)
            checkout_payment = await create_payment(
                save_fixture, organization, checkout=checkout
            )
            refund = await create_refund(
                save_fixture, order, payment, processor_id=f"refund_{order.id}"
            )
            entities.extend(
                [subscription, checkout, order, payment, checkout_payment, refund]
            )

        service = ProductTransferService(organization.id, organization_second.id)
        await service.validate_products_belong_to_same_organization(
            session, [product.id]
        )
        await service.execute_transfer(session)

        for entity in transferred_entities:
            await session.refresh(entity)
            assert entity.organization_id == organization_second.id
        for entity in staying_entities:
            await session.refresh(entity)
            assert entity.organization_id == organization.id

    async def test_complete_transfer_workflow_simple_case(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test complete transfer workflow for simple case with no customer splitting."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create a product
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        service = ProductTransferService(source_org.id, target_org.id)

        # Validate organizations
        await service.validate_organizations_exist(session)

        # Validate products
        await service.validate_products_belong_to_same_organization(
            session, [product.id]
        )

        # Analyze affected data
        await service.analyze_affected_data(session)

        # Execute the transfer
        await service.split_customers(session)
        await service.transfer_benefits(session)
        await service.transfer_products(session)
        await service.update_related_entities(session)
        await service.validate_transfer(session)

        # Verify the transfer
        await session.refresh(product)
        assert product.organization_id == target_org.id
        assert service.transfer_stats["products_transferred"] == 1

    async def test_complete_transfer_workflow_with_customer_splitting(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test complete transfer workflow with customer splitting."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products - one to transfer, one to stay
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create customer with orders for both products
        customer = await create_customer(save_fixture, organization=source_org)
        order_transfer = await create_order(
            save_fixture, customer=customer, product=product_transfer
        )
        order_stay = await create_order(
            save_fixture, customer=customer, product=product_stay
        )

        service = ProductTransferService(source_org.id, target_org.id)

        # Validate and analyze
        await service.validate_organizations_exist(session)
        await service.validate_products_belong_to_same_organization(
            session, [product_transfer.id]
        )
        await service.analyze_affected_data(session)

        # Execute the transfer
        await service.split_customers(session)
        await service.transfer_benefits(session)
        await service.transfer_products(session)
        await service.update_related_entities(session)
        await service.validate_transfer(session)

        # Verify results
        await session.refresh(product_transfer)
        assert product_transfer.organization_id == target_org.id

        # Verify customer splitting
        assert len(service.new_customers_map) == 1
        new_customer = service.new_customers_map[customer.id]
        assert new_customer.organization_id == target_org.id

        # Verify order was updated
        await session.refresh(order_transfer)
        assert order_transfer.customer_id == new_customer.id

        # Verify original order still exists with original customer
        await session.refresh(order_stay)
        assert order_stay.customer_id == customer.id

    async def test_complete_transfer_workflow_with_checkout_links(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test complete transfer workflow with checkout links."""
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)

        # Create products - one to transfer, one to stay
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create checkout link with both products
        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product_transfer, product_stay],
        )

        service = ProductTransferService(source_org.id, target_org.id)

        # Validate and analyze
        await service.validate_organizations_exist(session)
        await service.validate_products_belong_to_same_organization(
            session, [product_transfer.id]
        )
        await service.analyze_affected_data(session)

        # Execute the transfer
        await service.split_customers(session)
        await service.transfer_benefits(session)
        await service.transfer_products(session)
        await service.update_related_entities(session)
        await service.validate_transfer(session)

        # Verify results
        await session.refresh(product_transfer)
        assert product_transfer.organization_id == target_org.id

        # Verify checkout link was updated
        await session.refresh(checkout_link)
        assert len(checkout_link.checkout_link_products) == 1
        assert checkout_link.checkout_link_products[0].product_id == product_stay.id

        # Verify stats
        assert service.transfer_stats["checkout_links_updated"] == 1

    async def test_complete_transfer_workflow_with_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        """Test complete transfer workflow including event transfer."""
        # Setup
        source_org = await create_organization(save_fixture, account)
        target_org = await create_organization(save_fixture, account_second)
        product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )

        customer = await create_customer(
            save_fixture, organization=source_org, email="customer_workflow@example.com"
        )
        await create_order(save_fixture, customer=customer, product=product)

        # Create events for the customer
        event1 = await create_event(
            save_fixture, customer=customer, organization=source_org
        )
        event2 = await create_event(
            save_fixture, customer=customer, organization=source_org
        )

        # Initialize service
        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_transfer = [customer]
        service.events_to_transfer = [event1, event2]

        # Execute the transfer
        await service.transfer_customers_directly(session)
        await service.transfer_events(session)
        await service.transfer_benefits(session)
        await service.transfer_products(session)
        await service.update_related_entities(session)
        await service.validate_transfer(session)

        # Verify events were transferred
        await session.refresh(event1)
        await session.refresh(event2)
        assert event1.organization_id == target_org.id
        assert event2.organization_id == target_org.id
        assert service.transfer_stats["events_transferred"] == 2
