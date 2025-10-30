from typing import TypeIs

from polar.models import Checkout, ProductCheckout, WalletTopUpCheckout


def is_product_checkout(checkout: Checkout) -> TypeIs[ProductCheckout]:
    return isinstance(checkout, ProductCheckout)


def is_wallet_top_up_checkout(checkout: Checkout) -> TypeIs[WalletTopUpCheckout]:
    return isinstance(checkout, WalletTopUpCheckout)
