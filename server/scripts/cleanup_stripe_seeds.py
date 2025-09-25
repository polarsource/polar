import asyncio
from functools import wraps

import typer

from polar.config import settings
from polar.integrations.stripe.service import stripe_lib  # type: ignore[attr-defined]

cli = typer.Typer()


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def delete_stripe_payout_accounts(apply: bool = False) -> None:
    accounts = stripe_lib.Account.list()
    for account in accounts.auto_paging_iter():
        print(f"Deleting Stripe Connect account {account.id}... ", end="", flush=True)

        if apply:
            stripe_lib.Account.delete(account.id)
            print("Deleted")
        else:
            print("DRY-RUN: not deleted")


@cli.command("delete-accounts")
@typer_async
async def cmd_delete_stripe_payout_accounts(apply: bool = False) -> None:
    await delete_stripe_payout_accounts(apply=apply)


async def delete_stripe_products(apply: bool = False) -> None:
    products = stripe_lib.Product.list()
    for product in products.auto_paging_iter():
        print(
            f"Deleting Stripe product {product.name} ({product.id})... ",
            end="",
            flush=True,
        )

        if apply:
            stripe_lib.Product.delete(product.id)
            print("Deleted")
        else:
            print("DRY-RUN: not deleted")


@cli.command("delete-products")
@typer_async
async def cmd_delete_products(apply: bool = False) -> None:
    await delete_stripe_products(apply=apply)


async def deactivate_stripe_prices(apply: bool = False) -> None:
    prices = stripe_lib.Price.list()
    for price in prices.auto_paging_iter():
        print(
            f"Deactivating Stripe price {price.nickname} ({price.id})... ",
            end="",
            flush=True,
        )

        if apply:
            stripe_lib.Price.modify(price.id, active=False)
            print("Deactivated")
        else:
            print("DRY-RUN: not deactivated")


@cli.command("deactivate-prices")
@typer_async
async def cmd_deactivate(apply: bool = False) -> None:
    await deactivate_stripe_prices(apply=apply)


if __name__ == "__main__":
    # This is a testing only command
    assert settings.STRIPE_SECRET_KEY.startswith("sk_test_")

    cli()
