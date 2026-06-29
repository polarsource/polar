import uuid

import structlog

from polar.exceptions import PolarTaskError
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

from .service import pricing_directory as pricing_directory_service

log = structlog.get_logger(__name__)


class PricingDirectoryTaskError(PolarTaskError): ...


@actor(
    actor_name="pricing_directory.scrape_all",
    # Weekly, Mondays at 03:00 UTC. Staggered off other nightly crons.
    cron_trigger=CronTrigger.from_crontab("0 3 * * 1"),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def pricing_directory_scrape_all() -> None:
    """Ensure seed companies exist, then fan out one scrape job per company."""
    async with AsyncSessionMaker() as session:
        await pricing_directory_service.ensure_seed_companies(session)
        company_ids = await pricing_directory_service.list_company_ids(session)

    for company_id in company_ids:
        enqueue_job("pricing_directory.scrape_company", company_id=company_id)


@actor(
    actor_name="pricing_directory.scrape_company",
    priority=TaskPriority.LOW,
    time_limit=120_000,
    max_retries=3,
    min_backoff=60_000,
)
async def pricing_directory_scrape_company(company_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        await pricing_directory_service.scrape_company(session, company_id)
