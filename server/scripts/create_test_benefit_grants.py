"""
Script to create test benefit grants for testing pagination and search in the customer portal.

Usage:
    cd /home/muddles/Codes/polar/server
    uv run python -m scripts.create_test_benefit_grants --customer-email customer@example.com --org-slug melted-sql --count 50

This will:
1. Find the customer by email
2. Create multiple "custom" type benefits with different descriptions
3. Grant them all to the customer
"""

import asyncio
from datetime import UTC, datetime

import dramatiq
import typer
from sqlalchemy import select

import polar.tasks  # noqa: F401
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import Benefit, BenefitGrant, Customer, Organization, Subscription
from polar.models.benefit import BenefitType
from polar.postgres import create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager

cli = typer.Typer()


BENEFIT_NAMES = [
    "Premium Support",
    "Early Access",
    "Exclusive Content",
    "Priority Queue",
    "Custom Dashboard",
    "API Access",
    "Advanced Analytics",
    "White-label Solution",
    "Dedicated Server",
    "24/7 Support",
    "Beta Features",
    "Custom Integrations",
    "Data Export",
    "Team Collaboration",
    "Unlimited Storage",
    "Custom Branding",
    "Priority Email",
    "Phone Support",
    "Training Sessions",
    "Onboarding Call",
    "Monthly Reports",
    "Quarterly Review",
    "Custom Templates",
    "Workflow Automation",
    "Webhook Access",
    "SSO Integration",
    "Audit Logs",
    "Role Management",
    "Custom Fields",
    "Advanced Filters",
    "Bulk Operations",
    "API Rate Limit Increase",
    "Custom Exports",
    "White Glove Service",
    "Dedicated Account Manager",
    "SLA Guarantee",
    "Custom Development",
    "Migration Assistance",
    "Security Review",
    "Compliance Reports",
    "Backup Service",
    "Disaster Recovery",
    "Load Balancing",
    "CDN Access",
    "Custom Domain",
    "Email Forwarding",
    "Calendar Integration",
    "Slack Integration",
    "Discord Access",
    "Community Forum",
]


@cli.command()
def create_grants(
    customer_email: str = typer.Option(..., help="Email of the customer to grant benefits to"),
    org_slug: str = typer.Option(..., help="Organization slug"),
    count: int = typer.Option(50, help="Number of benefit grants to create"),
) -> None:
    """Create test benefit grants for a customer."""

    async def run() -> None:
        redis = create_redis("app")
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine("script")
            sessionmaker = create_async_sessionmaker(engine)
            async with sessionmaker() as session:
                # Find organization
                org_result = await session.execute(
                    select(Organization).where(Organization.slug == org_slug)
                )
                organization = org_result.scalar_one_or_none()
                if not organization:
                    print(f"❌ Organization '{org_slug}' not found")
                    return

                # Find customer
                customer_result = await session.execute(
                    select(Customer).where(
                        Customer.email == customer_email,
                        Customer.organization_id == organization.id,
                    )
                )
                customer = customer_result.scalar_one_or_none()
                if not customer:
                    print(f"❌ Customer '{customer_email}' not found in org '{org_slug}'")
                    print(f"\n📋 Available customers in '{org_slug}':")
                    
                    # List available customers in this org
                    customers_result = await session.execute(
                        select(Customer.email)
                        .where(Customer.organization_id == organization.id)
                        .order_by(Customer.email)
                    )
                    customers = customers_result.scalars().all()
                    if customers:
                        for email in customers:
                            print(f"   - {email}")
                    else:
                        print("   (no customers found)")
                        print(f"\n💡 You can create a customer via the dashboard at:")
                        print(f"   http://127.0.0.1:3000/{org_slug}/customers")
                    return

                # Find a subscription for this customer (for linking grants)
                sub_result = await session.execute(
                    select(Subscription).where(
                        Subscription.customer_id == customer.id
                    ).limit(1)
                )
                subscription = sub_result.scalar_one_or_none()

                print(f"📦 Creating {count} benefit grants for {customer_email}...")

                for i in range(count):
                    # Create a benefit directly (bypassing service layer auth)
                    benefit_name = BENEFIT_NAMES[i % len(BENEFIT_NAMES)]
                    benefit_description = f"{benefit_name} #{i + 1}"
                    
                    benefit = Benefit(
                        type=BenefitType.custom,
                        description=benefit_description,
                        organization_id=organization.id,
                        is_tax_applicable=True,
                        selectable=False,
                        deletable=True,
                        properties={"note": f"This is a test benefit for {benefit_name}"},
                    )
                    session.add(benefit)
                    await session.flush()

                    # Create a grant directly
                    grant = BenefitGrant(
                        customer_id=customer.id,
                        benefit_id=benefit.id,
                        subscription_id=subscription.id if subscription else None,
                        granted_at=utc_now(),  # is_granted is computed from this
                        revoked_at=None,       # is_revoked is computed from this
                        properties={},
                    )
                    session.add(grant)

                    if (i + 1) % 10 == 0:
                        print(f"  ✅ Created {i + 1}/{count} grants")

                await session.commit()
                print(f"🎉 Successfully created {count} benefit grants!")
                print(f"\n📋 To test, access the customer portal:")
                print(f"   http://127.0.0.1:3000/{org_slug}/portal/overview")
                print(f"\n   You'll need a customer session token. Create one via API:")
                print(f"   POST /v1/customer-sessions with customer_id: {customer.id}")

    asyncio.run(run())


if __name__ == "__main__":
    cli()
