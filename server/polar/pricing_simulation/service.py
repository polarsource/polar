from collections import defaultdict
from uuid import UUID

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.declarative_config.schemas import (
    Config,
    ConfigProduct,
    ConfigProductPriceFixed,
    ConfigResource,
)
from polar.declarative_config.service import ConfigAsCodeNotEnabled
from polar.enums import SubscriptionRecurringInterval
from polar.kit.currency import format_currency
from polar.models import Organization, ProductPrice, Subscription, User
from polar.models.product_price import ProductPriceFixed
from polar.models.subscription import SubscriptionStatus
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository

from .repository import PricingSimulationRepository
from .schemas import (
    SimulationCohort,
    SimulationComponent,
    SimulationCounts,
    SimulationNotSimulated,
    SimulationResult,
)

# Weeks and days are averaged over a calendar month, like the backoffice MRR.
_MONTHS_PER_INTERVAL = {
    SubscriptionRecurringInterval.day: 1 / 30.44,
    SubscriptionRecurringInterval.week: 7 / 30.44,
    SubscriptionRecurringInterval.month: 1.0,
    SubscriptionRecurringInterval.year: 12.0,
}


def monthly(amount: int, interval: SubscriptionRecurringInterval, count: int) -> int:
    return round(amount / (_MONTHS_PER_INTERVAL[interval] * count))


def _amount_type_label(amount_type: str) -> str:
    return amount_type.replace("_based", "-based").replace("_", " ")


def _price_label(price: ProductPrice) -> str:
    if isinstance(price, ProductPriceFixed):
        return format_currency(price.price_amount, price.price_currency)
    return _amount_type_label(price.amount_type)


def _not_simulated(
    result: SimulationResult, external_id: str, reason: str, subscribers: int
) -> None:
    for item in result.not_simulated:
        if (item.external_id, item.reason) == (external_id, reason):
            item.subscribers += subscribers
            return
    result.not_simulated.append(
        SimulationNotSimulated(
            resource=ConfigResource.product,
            external_id=external_id,
            reason=reason,
            subscribers=subscribers,
        )
    )


def _add_cohort(
    result: SimulationResult,
    config: ConfigProduct,
    subscription: Subscription,
    subscribers: int,
) -> None:
    currency = subscription.currency
    if (config.recurring_interval, config.recurring_interval_count or 1) != (
        subscription.recurring_interval,
        subscription.recurring_interval_count,
    ):
        _not_simulated(
            result,
            config.external_id,
            "recurring interval changes aren't simulated",
            subscribers,
        )
        result.counts.not_simulated += subscribers
        return

    reasons: dict[str, None] = {}
    proposed_fixed: ConfigProductPriceFixed | None = None
    for proposed in config.prices:
        if proposed.price_currency != currency:
            continue
        if isinstance(proposed, ConfigProductPriceFixed):
            proposed_fixed = proposed
        else:
            reasons[
                f"{_amount_type_label(proposed.amount_type)} prices aren't supported yet"
            ] = None

    components: list[SimulationComponent] = []
    for price in subscription.prices:
        if not isinstance(price, ProductPriceFixed):
            reasons[f"{_price_label(price)} prices aren't supported yet"] = None
        elif proposed_fixed is None:
            reasons[f"no fixed {currency.upper()} price in the config"] = None
        else:
            components.append(
                SimulationComponent(
                    label="Fixed price",
                    kind="fee",
                    baseline=monthly(
                        price.price_amount,
                        subscription.recurring_interval,
                        subscription.recurring_interval_count,
                    )
                    * subscribers,
                    proposed=monthly(
                        proposed_fixed.price_amount,
                        subscription.recurring_interval,
                        subscription.recurring_interval_count,
                    )
                    * subscribers,
                )
            )
    for reason in reasons:
        _not_simulated(result, config.external_id, reason, subscribers)
    if not components:
        result.counts.not_simulated += subscribers
        return

    cohort = SimulationCohort(
        product_external_id=config.external_id,
        price_label=" + ".join(_price_label(price) for price in subscription.prices),
        archived=any(price.is_archived for price in subscription.prices),
        partial=bool(reasons),
        recurring_interval=subscription.recurring_interval,
        recurring_interval_count=subscription.recurring_interval_count,
        subscribers=subscribers,
        baseline_monthly=sum(component.baseline for component in components),
        proposed_monthly=sum(component.proposed for component in components),
        components=components,
    )
    result.cohorts.append(cohort)
    delta = cohort.proposed_monthly - cohort.baseline_monthly
    result.monthly_delta += delta
    if delta > 0:
        result.counts.more += subscribers
    elif delta < 0:
        result.counts.less += subscribers
    else:
        result.counts.same += subscribers


class PricingSimulationService:
    async def simulate(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        config: Config,
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
        subscriptions = await PricingSimulationRepository.from_session(
            session
        ).get_subscribers(set(product_configs))

        results: dict[str, SimulationResult] = {}
        cohorts: dict[tuple[UUID, frozenset[UUID]], list[Subscription]] = defaultdict(
            list
        )
        no_history: dict[tuple[str, str], int] = defaultdict(int)
        for subscription in subscriptions:
            result = results.setdefault(
                subscription.currency,
                SimulationResult(
                    monthly_delta=0,
                    currency=subscription.currency,
                    counts=SimulationCounts(
                        more=0, less=0, same=0, no_history=0, not_simulated=0
                    ),
                    cohorts=[],
                    not_simulated=[],
                ),
            )
            if subscription.status == SubscriptionStatus.trialing:
                result.counts.no_history += 1
                no_history[
                    (
                        subscription.currency,
                        product_configs[subscription.product_id].external_id,
                    )
                ] += 1
                continue
            price_ids = frozenset(price.id for price in subscription.prices)
            cohorts[(subscription.product_id, price_ids)].append(subscription)

        for (product_id, _), subscribers in cohorts.items():
            subscription = subscribers[0]
            _add_cohort(
                results[subscription.currency],
                product_configs[product_id],
                subscription,
                len(subscribers),
            )
        for (currency, external_id), count in no_history.items():
            _not_simulated(
                results[currency], external_id, "no closed period yet", count
            )
        return list(results.values())


pricing_simulation = PricingSimulationService()
