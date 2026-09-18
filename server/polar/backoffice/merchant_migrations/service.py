from collections.abc import Sequence

from redis.exceptions import RedisError

from polar.integrations.stripe.service import stripe as stripe_service
from polar.redis import Redis

from .mrr import MrrBreakdown

USD_RATE_CACHE_TTL_SECONDS = 24 * 60 * 60
_USD_RATE_CACHE_PREFIX = "polar:fx:usd:v1"


def _usd_rate_cache_key(currency: str) -> str:
    return f"{_USD_RATE_CACHE_PREFIX}:{currency}"


class MerchantMigrationsService:
    async def usd_rates(
        self, redis: Redis, breakdowns: Sequence[MrrBreakdown]
    ) -> dict[str, float]:
        """Stripe FX Quotes `base_rate`s, cached 24h per currency."""
        currencies = sorted(
            {
                currency.lower()
                for breakdown in breakdowns
                for currency, amount in breakdown.total.amounts.items()
                if amount and currency.lower() != "usd"
            }
        )
        if not currencies:
            return {}

        rates: dict[str, float] = {}
        missing: list[str] = []
        for currency in currencies:
            try:
                cached = await redis.get(_usd_rate_cache_key(currency))
            except RedisError:
                cached = None
            if cached is None:
                missing.append(currency)
                continue
            try:
                rates[currency] = float(cached)
            except TypeError, ValueError:
                missing.append(currency)

        if not missing:
            return rates

        fetched = await stripe_service.get_usd_base_rates(missing)
        for currency, rate in fetched.items():
            rates[currency] = rate
            try:
                await redis.set(
                    _usd_rate_cache_key(currency),
                    str(rate),
                    ex=USD_RATE_CACHE_TTL_SECONDS,
                )
            except RedisError:
                pass
        return rates


merchant_migrations = MerchantMigrationsService()
