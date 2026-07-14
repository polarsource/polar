from collections.abc import Sequence
from dataclasses import dataclass

import structlog

from polar.enums import TaxBehavior, TaxBehaviorOption, TaxProcessor
from polar.logging import Logger
from polar.models import Customer, Discount, OrderItem, Product, Subscription
from polar.tax.calculation import (
    TaxBreakdownItem,
    TaxCalculation,
    TaxCalculationLogicalError,
)
from polar.tax.calculation import tax_calculation as tax_calculation_service

log: Logger = structlog.get_logger()


@dataclass(frozen=True)
class OrderAmounts:
    """Monetary breakdown of an order: allocates no invoice number, touches no balance."""

    subtotal_amount: int
    discount_amount: int
    tax_amount: int
    net_amount: int
    total_amount: int
    tax_processor: TaxProcessor | None
    tax_behavior: TaxBehavior | None
    tax_calculation_processor_id: str | None
    tax_breakdown: Sequence[TaxBreakdownItem]


async def calculate_tax(
    *,
    reference: str,
    taxable_amount: int,
    tax_behavior_option: TaxBehaviorOption,
    currency: str,
    customer: Customer,
    product: Product,
    tax_exempted: bool,
    allow_silent_failure: bool = True,
) -> tuple[
    TaxProcessor | None,
    TaxBehavior | None,
    str | None,
    int,
    Sequence[TaxBreakdownItem],
]:
    billing_address = customer.billing_address
    tax_id = customer.tax_id

    tax_processor: TaxProcessor | None = None
    tax_behavior: TaxBehavior | None = None
    tax_calculation: TaxCalculation | None = None
    tax_amount = 0
    tax_breakdown: list[TaxBreakdownItem] = []
    tax_calculation_processor_id: str | None = None

    if (
        taxable_amount != 0
        and product.is_tax_applicable
        and billing_address is not None
    ):
        try:
            (
                tax_calculation,
                tax_processor,
            ) = await tax_calculation_service.calculate(
                reference,
                currency,
                # Stripe doesn't support calculating negative tax amounts
                taxable_amount if taxable_amount >= 0 else -taxable_amount,
                tax_behavior_option,
                product.tax_code,
                billing_address,
                [tax_id] if tax_id is not None else [],
                tax_exempted,
            )
        except TaxCalculationLogicalError:
            # The subscription flow tolerates an uncomputable tax (the
            # address is fixed up over the lifecycle). Off-session draft
            # orders persist this result and never recompute it, so a silent
            # zero would charge tax-free — the caller must surface it instead.
            if not allow_silent_failure:
                raise
            log.warning(
                "Failed to calculate tax for subscription order due to invalid or incomplete address",
                reference=reference,
                customer_id=customer.id,
            )
            tax_amount = 0
            tax_calculation_processor_id = None
        else:
            if taxable_amount >= 0:
                tax_calculation_processor_id = tax_calculation["processor_id"]
                tax_amount = tax_calculation["amount"]
            else:
                # When the taxable amount is negative it's usually due to a credit proration
                # this means we "owe" the customer money -- but we don't pay it back at this
                # point. This also means that there's no money transaction going on, and we
                # don't have to record the tax transaction either.
                tax_calculation_processor_id = None
                tax_amount = -tax_calculation["amount"]

        if tax_calculation is not None:
            tax_behavior = tax_calculation["tax_behavior"]
            tax_breakdown = tax_calculation["tax_breakdown"]

    return (
        tax_processor,
        tax_behavior,
        tax_calculation_processor_id,
        tax_amount,
        tax_breakdown,
    )


async def compute_order_amounts(
    subscription: Subscription,
    items: Sequence[OrderItem],
    *,
    reference: str,
    discount: Discount | None,
) -> OrderAmounts:
    customer = subscription.customer

    subtotal_amount = sum(item.amount for item in items)

    discount_amount = 0
    if discount is not None:
        # Discount only applies to cycle and meter items, as prorations
        # use "last month's" discount and so this month's discount
        # shouldn't apply to those.
        discountable_amount = sum(item.amount for item in items if item.discountable)
        discount_amount = discount.get_discount_amount(
            discountable_amount, subscription.currency
        )

    tax_behavior_option = (
        subscription.tax_behavior.to_option()
        if subscription.tax_behavior is not None
        else customer.organization.default_tax_behavior
    )
    (
        tax_processor,
        tax_behavior,
        tax_calculation_processor_id,
        tax_amount,
        tax_breakdown,
    ) = await calculate_tax(
        reference=reference,
        taxable_amount=subtotal_amount - discount_amount,
        tax_behavior_option=tax_behavior_option,
        currency=subscription.currency,
        customer=customer,
        product=subscription.product,
        tax_exempted=subscription.tax_exempted,
    )

    net_amount = (
        subtotal_amount
        - discount_amount
        - (tax_amount if tax_behavior == TaxBehavior.inclusive else 0)
    )

    return OrderAmounts(
        subtotal_amount=subtotal_amount,
        discount_amount=discount_amount,
        tax_amount=tax_amount,
        net_amount=net_amount,
        total_amount=net_amount + tax_amount,
        tax_processor=tax_processor,
        tax_behavior=tax_behavior,
        tax_calculation_processor_id=tax_calculation_processor_id,
        tax_breakdown=tax_breakdown,
    )
