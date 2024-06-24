import uuid

import structlog
from discord_webhook import AsyncDiscordWebhook, DiscordEmbed

from polar.config import settings
from polar.exceptions import PolarTaskError
from polar.kit.money import get_cents_in_dollar_string
from polar.logging import Logger
from polar.organization.service import organization as organization_service
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from ..product.service.product import product as product_service
from ..product.service.product_price import product_price as product_price_service
from .service import order as order_service

log: Logger = structlog.get_logger()


class OrderTaskError(PolarTaskError): ...


class OrganizationDoesNotExist(OrderTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization with id {organization_id} does not exist."
        super().__init__(message)


class ProductDoesNotExist(OrderTaskError):
    def __init__(self, product_id: uuid.UUID) -> None:
        self.product_id = product_id
        message = f"The product with id {product_id} does not exist."
        super().__init__(message)


class OrderDoesNotExist(OrderTaskError):
    def __init__(self, order_id: uuid.UUID) -> None:
        self.order_id = order_id
        message = f"The order with id {order_id} does not exist."
        super().__init__(message)


class PriceDoesNotExist(OrderTaskError):
    def __init__(self, price_id: uuid.UUID) -> None:
        self.price_id = price_id
        message = f"The price with id {price_id} does not exist."
        super().__init__(message)


@task("order.update_product_benefits_grants")
async def update_product_benefits_grants(
    ctx: JobContext, product_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        product = await product_service.get(session, product_id)
        if product is None:
            raise ProductDoesNotExist(product_id)

        await order_service.update_product_benefits_grants(session, product)


@task("order.discord_notification")
async def order_discord_notification(
    ctx: JobContext, order_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    if not settings.DISCORD_WEBHOOK_URL:
        return

    async with AsyncSessionMaker(ctx) as session:
        order = await order_service.get(session, order_id)
        if order is None:
            raise OrderDoesNotExist(order_id)

        product = await product_service.get(session, order.product_id)
        if not product:
            raise ProductDoesNotExist(order.product_id)

        product_org = await organization_service.get(session, product.organization_id)
        if not product_org:
            raise OrganizationDoesNotExist(product.organization_id)

        webhook = AsyncDiscordWebhook(
            url=settings.DISCORD_WEBHOOK_URL, content="New order"
        )

        price = await product_price_service.get_by_id(session, order.product_price_id)

        if not price:
            raise PriceDoesNotExist(order.product_price_id)

        if price.recurring_interval:
            description = f"${get_cents_in_dollar_string(price.price_amount)}/{price.recurring_interval}"
        else:
            description = f"${get_cents_in_dollar_string(price.price_amount)}"

        embed = DiscordEmbed(
            title=order.product.name,
            description=description,
            color="65280",
        )

        embed.add_embed_field(
            name="Org",
            value=f"[{product_org.name}](https://polar.sh/{product_org.name})",
        )

        webhook.add_embed(embed)
        await webhook.execute()
