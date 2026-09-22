"""Prepare a local organization for the Stagehand E2E checkout test.

Driven by `dev e2e setup`, which picks the organization and stores the output.
"""

import asyncio

import dramatiq
import typer
from sqlalchemy import select

import polar.tasks  # noqa: F401
from polar.auth.models import AuthSubject
from polar.checkout_link.service import CHECKOUT_LINK_CLIENT_SECRET_PREFIX
from polar.enums import (
    PaymentProcessor,
    SubscriptionRecurringInterval,
    TaxBehaviorOption,
)
from polar.kit.crypto import generate_token
from polar.kit.currency import PresentmentCurrency
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.trial import TrialInterval
from polar.models import (
    CheckoutLink,
    CheckoutLinkProduct,
    Organization,
    Product,
    User,
    UserOrganization,
)
from polar.models.product_price import ProductPriceAmountType
from polar.postgres import AsyncSession, create_async_engine
from polar.product.schemas import ProductCreateRecurring, ProductPriceFixedCreate
from polar.product.service import product as product_service
from polar.redis import create_redis
from polar.worker import JobQueueManager

PRODUCT_NAME = "E2E Trial"
LINK_LABEL = "E2E test checkout"
TRIAL = (TrialInterval.day, 7)

cli = typer.Typer()


@cli.command(name="list-orgs")
def list_orgs() -> None:
    """Print `slug<TAB>name` for every organization that can take a checkout."""

    async def run() -> None:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session:
            organizations = await session.execute(
                select(Organization.slug, Organization.name)
                .where(Organization.can_authenticate)
                .order_by(Organization.slug)
            )
            for slug, name in organizations.all():
                typer.echo(f"{slug}\t{name}")

    asyncio.run(run())


async def _get_organization(session: AsyncSession, slug: str) -> Organization:
    organization = (
        (await session.execute(select(Organization).where(Organization.slug == slug)))
        .unique()
        .scalar_one_or_none()
    )
    if organization is None:
        typer.echo(f"Organization '{slug}' not found.", err=True)
        raise typer.Exit(1)
    if not organization.can_authenticate:
        typer.echo(
            f"Organization '{slug}' cannot take payments. "
            f"Run `dev enable-payments {slug}` first.",
            err=True,
        )
        raise typer.Exit(1)
    return organization


async def _get_member(session: AsyncSession, organization: Organization) -> User:
    user = (
        (
            await session.execute(
                select(User)
                .join(UserOrganization, UserOrganization.user_id == User.id)
                .where(UserOrganization.organization_id == organization.id)
                .limit(1)
            )
        )
        .unique()
        .scalar_one_or_none()
    )
    if user is None:
        typer.echo(f"Organization '{organization.slug}' has no members.", err=True)
        raise typer.Exit(1)
    return user


async def _get_or_create_product(
    session: AsyncSession, organization: Organization, user: User
) -> Product:
    product = (
        (
            await session.execute(
                select(Product).where(
                    Product.organization_id == organization.id,
                    Product.name == PRODUCT_NAME,
                    Product.is_archived.is_(False),
                )
            )
        )
        .unique()
        .scalar_one_or_none()
    )
    if product is None:
        return await product_service.create(
            session,
            ProductCreateRecurring(
                name=PRODUCT_NAME,
                description="Subscription with a free trial, used by the E2E tests",
                organization_id=organization.id,
                recurring_interval=SubscriptionRecurringInterval.month,
                trial_interval=TRIAL[0],
                trial_interval_count=TRIAL[1],
                prices=[
                    ProductPriceFixedCreate(
                        amount_type=ProductPriceAmountType.fixed,
                        tax_behavior=TaxBehaviorOption.exclusive,
                        price_amount=1000,
                        price_currency=PresentmentCurrency.usd,
                    )
                ],
            ),
            AuthSubject(subject=user, scopes=set(), session=None),
            notify=False,
        )
    if product.trial_interval is None:
        product.trial_interval, product.trial_interval_count = TRIAL
        session.add(product)
    return product


async def _get_or_create_link(
    session: AsyncSession, organization: Organization, product: Product
) -> CheckoutLink:
    link = (
        (
            await session.execute(
                select(CheckoutLink).where(
                    CheckoutLink.organization_id == organization.id,
                    CheckoutLink.label == LINK_LABEL,
                    CheckoutLink.deleted_at.is_(None),
                )
            )
        )
        .unique()
        .scalar_one_or_none()
    )
    if link is None:
        link = CheckoutLink(
            payment_processor=PaymentProcessor.stripe,
            client_secret=generate_token(prefix=CHECKOUT_LINK_CLIENT_SECRET_PREFIX),
            organization=organization,
            label=LINK_LABEL,
            allow_discount_codes=False,
            checkout_link_products=[CheckoutLinkProduct(product=product, order=0)],
        )
        session.add(link)
    return link


@cli.command()
def setup(org: str = typer.Option(..., "--org", help="Organization slug")) -> None:
    """Create the trial product and checkout link, and allow repeated trials."""

    async def run() -> None:
        redis = create_redis("app")
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            engine = create_async_engine("script")
            sessionmaker = create_async_sessionmaker(engine)
            async with sessionmaker() as session:
                organization = await _get_organization(session, org)
                user = await _get_member(session, organization)
                product = await _get_or_create_product(session, organization, user)
                link = await _get_or_create_link(session, organization, product)
                organization.subscription_settings = {
                    **organization.subscription_settings,
                    "prevent_trial_abuse": False,
                }
                session.add(organization)
                await session.commit()

                typer.echo(f"ORGANIZATION_SLUG={organization.slug}")
                typer.echo(f"PRODUCT_NAME={product.name}")
                typer.echo(f"E2E_CHECKOUT_LINK={link.client_secret}")

    asyncio.run(run())


if __name__ == "__main__":
    cli()
