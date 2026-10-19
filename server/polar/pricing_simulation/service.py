from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from dateutil.relativedelta import relativedelta

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.declarative_config.schemas import (
    Config,
    ConfigProduct,
    ConfigProductPriceFixed,
    ConfigProductPriceSeatBased,
    ConfigResource,
)
from polar.declarative_config.service import ConfigAsCodeNotEnabled
from polar.enums import SubscriptionRecurringInterval
from polar.kit.currency import format_currency
from polar.models import Organization, ProductPrice, User
from polar.models.product_price import ProductPriceFixed, ProductPriceSeatUnit
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository

from .repository import BilledRow, PricingSimulationRepository
from .schemas import (
    SimulationBreakdownItem,
    SimulationCounts,
    SimulationNotSimulated,
    SimulationResult,
    SimulationWindow,
)


def months_between(since: datetime, until: datetime) -> float:
    """Whole calendar months, plus the share of the month that's left over."""
    delta = relativedelta(until, since)
    whole = delta.years * 12 + delta.months
    start = since + relativedelta(months=whole)
    return whole + (until - start) / (since + relativedelta(months=whole + 1) - start)


def _amount_type_label(amount_type: str) -> str:
    return amount_type.replace("_based", "-based").replace("_", " ")


def _flat_seat_rate(price: ProductPriceSeatUnit) -> Decimal | None:
    return price.tiers.tiers[0].unit_amount if len(price.tiers.tiers) == 1 else None


def _price_label(price: ProductPrice) -> str:
    if isinstance(price, ProductPriceFixed):
        return format_currency(price.price_amount, price.price_currency)
    if (
        isinstance(price, ProductPriceSeatUnit)
        and (rate := _flat_seat_rate(price)) is not None
    ):
        return f"{format_currency(int(rate), price.price_currency)} per seat"
    return _amount_type_label(price.amount_type)


def _ratio(config: ConfigProduct, price: ProductPrice, row: BilledRow) -> Decimal | str:
    """Proposed rate over billed rate for the price's items, or why it can't be."""
    _, currency, interval, interval_count, _, _ = row
    if (config.recurring_interval, config.recurring_interval_count or 1) != (
        interval,
        interval_count,
    ):
        return "recurring interval changes aren't simulated"
    proposed = [p for p in config.prices if p.price_currency == currency]
    if isinstance(price, ProductPriceFixed):
        fixed = [p for p in proposed if isinstance(p, ConfigProductPriceFixed)]
        if not fixed:
            return f"no fixed {currency.upper()} price in the config"
        billed_rate, proposed_rate = (
            Decimal(price.price_amount),
            Decimal(fixed[0].price_amount),
        )
    elif isinstance(price, ProductPriceSeatUnit):
        seats = [p for p in proposed if isinstance(p, ConfigProductPriceSeatBased)]
        if not seats:
            return f"no seat-based {currency.upper()} price in the config"
        rate = _flat_seat_rate(price)
        if rate is None or len(seats[0].tiers.tiers) != 1:
            return "tiered seat prices aren't supported yet"
        billed_rate, proposed_rate = rate, seats[0].tiers.tiers[0].unit_amount
    else:
        return f"{_price_label(price)} prices aren't supported yet"
    if billed_rate == 0:
        return "free prices aren't supported yet"
    return proposed_rate / billed_rate


class PricingSimulationService:
    async def simulate(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        config: Config,
        since: datetime,
        until: datetime,
    ) -> list[SimulationResult]:
        organization = await get_payload_organization(session, auth_subject, config)
        for permission in (
            OrganizationPermission.products_read,
            OrganizationPermission.sales_read,
        ):
            await assert_organization_permission(
                session, auth_subject, organization.id, permission
            )
        if not organization.is_config_as_code_enabled:
            raise ConfigAsCodeNotEnabled()

        configs = {
            product.external_id: product
            for product in config.products
            if product.recurring_interval is not None
        }
        products = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, list(configs))
        product_configs = {
            product.id: configs[product.external_id]
            for product in products
            if product.external_id is not None
        }
        repository = PricingSimulationRepository.from_session(session)
        rows = await repository.get_billed(set(product_configs), since, until)
        prices = {
            price.id: price
            for price in await repository.get_prices({row[4] for row in rows})
        }

        billed: dict[UUID, str] = {}
        deltas: dict[UUID, Decimal] = defaultdict(Decimal)
        breakdown: dict[
            tuple[str, UUID, SubscriptionRecurringInterval, int],
            list[tuple[UUID, Decimal, Decimal]],
        ] = defaultdict(list)
        unrepriced: set[tuple[UUID, UUID]] = set()
        skipped: dict[tuple[str, str, str], set[UUID]] = defaultdict(set)
        for row in rows:
            subscription_id, currency, interval, interval_count, price_id, amount = row
            price = prices[price_id]
            product_config = product_configs[price.product_id]
            billed[subscription_id] = currency
            for config_price in product_config.prices:
                if config_price.price_currency == currency and not isinstance(
                    config_price, ConfigProductPriceFixed | ConfigProductPriceSeatBased
                ):
                    reason = f"{_amount_type_label(config_price.amount_type)} prices aren't supported yet"
                    skipped[(currency, product_config.external_id, reason)].add(
                        subscription_id
                    )
                    unrepriced.add((subscription_id, price.product_id))
            ratio = _ratio(product_config, price, row)
            if isinstance(ratio, str):
                skipped[(currency, product_config.external_id, ratio)].add(
                    subscription_id
                )
                unrepriced.add((subscription_id, price.product_id))
                continue
            breakdown[(currency, price_id, interval, interval_count)].append(
                (subscription_id, amount, amount * ratio)
            )
            deltas[subscription_id] += amount * ratio - amount

        months = months_between(since, until)
        results: dict[str, SimulationResult] = {}

        def result(currency: str) -> SimulationResult:
            return results.setdefault(
                currency,
                SimulationResult(
                    window=SimulationWindow(since=since, until=until, months=months),
                    currency=currency,
                    baseline=0,
                    proposed=0,
                    monthly_delta=0,
                    counts=SimulationCounts(
                        more=0, less=0, same=0, no_history=0, not_simulated=0
                    ),
                    breakdown=[],
                    not_simulated=[],
                ),
            )

        for (
            currency,
            price_id,
            interval,
            interval_count,
        ), members in breakdown.items():
            price = prices[price_id]
            baseline = round(sum(amount for _, amount, _ in members))
            proposed = round(sum(amount for _, _, amount in members))
            item = SimulationBreakdownItem(
                product_external_id=product_configs[price.product_id].external_id,
                price_label=_price_label(price),
                archived=price.is_archived,
                partial=any(
                    (subscription_id, price.product_id) in unrepriced
                    for subscription_id, _, _ in members
                ),
                recurring_interval=interval,
                recurring_interval_count=interval_count,
                subscribers=len(members),
                baseline=baseline,
                proposed=proposed,
            )
            currency_result = result(currency)
            currency_result.breakdown.append(item)
            currency_result.baseline += baseline
            currency_result.proposed += proposed

        for subscription_id, currency in billed.items():
            counts = result(currency).counts
            if subscription_id not in deltas:
                counts.not_simulated += 1
            elif deltas[subscription_id] > 0:
                counts.more += 1
            elif deltas[subscription_id] < 0:
                counts.less += 1
            else:
                counts.same += 1

        for subscription in await repository.get_subscribers(set(product_configs)):
            if subscription.id not in billed:
                result(subscription.currency).counts.no_history += 1
                skipped[
                    (
                        subscription.currency,
                        product_configs[subscription.product_id].external_id,
                        "nothing billed in the window",
                    )
                ].add(subscription.id)

        for (currency, external_id, reason), subscription_ids in skipped.items():
            result(currency).not_simulated.append(
                SimulationNotSimulated(
                    resource=ConfigResource.product,
                    external_id=external_id,
                    reason=reason,
                    subscribers=len(subscription_ids),
                )
            )

        for currency_result in results.values():
            currency_result.monthly_delta = round(
                (currency_result.proposed - currency_result.baseline) / months
            )
        return list(results.values())


pricing_simulation = PricingSimulationService()
