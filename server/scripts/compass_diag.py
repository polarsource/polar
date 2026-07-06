import asyncio
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.compass.detectors import DETECTORS
from polar.compass.detectors.base import DetectorContext
from polar.compass.signals import latest, value_n_periods_ago
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.time_queries import TimeInterval
from polar.metrics.service import metrics as metrics_service
from polar.models import Organization
from polar.postgres import create_async_engine


async def main() -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    tz = ZoneInfo("UTC")
    today = date.today()

    slugs = sorted({slug for d in DETECTORS for slug in d.metric_slugs})
    days = max(d.lookback_days for d in DETECTORS) + 5
    probe = [
        *slugs,
        "gross_margin_percentage",
        "cost_per_user",
        "costs",
        "revenue",
    ]

    async with sessionmaker() as session:
        orgs = (await session.execute(select(Organization).limit(20))).scalars().all()
        for org in orgs:
            auth_subject: AuthSubject[Organization] = AuthSubject(
                org, {Scope.metrics_read}, None
            )
            response = await metrics_service.get_metrics(
                session,
                auth_subject,
                start_date=today - timedelta(days=days),
                end_date=today,
                timezone=tz,
                interval=TimeInterval.day,
                organization_id=[org.id],
                metrics=sorted(set(probe)),
            )
            ctx = DetectorContext(
                organization_id=org.id, timezone=tz, today=today, metrics=response
            )
            insights = [i for d in DETECTORS if (i := d.evaluate(ctx)) is not None]
            titles = [f"{i.title} [{i.severity}]" for i in insights]
            margin_now = latest(response, "gross_margin_percentage")
            margin_base = value_n_periods_ago(response, "gross_margin_percentage", 30)
            cpu_now = latest(response, "cost_per_user")
            cpu_base = value_n_periods_ago(response, "cost_per_user", 30)
            print(
                f"{org.slug:<24} "
                f"margin={margin_now:>6.3f} (30d={margin_base}) "
                f"cost/user={cpu_now / 100:>7.2f} (30d="
                f"{'n/a' if cpu_base is None else f'{cpu_base / 100:.2f}'}) "
                f"-> {titles}"
            )


asyncio.run(main())
