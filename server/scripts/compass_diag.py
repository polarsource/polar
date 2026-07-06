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

    async with sessionmaker() as session:
        orgs = (await session.execute(select(Organization).limit(20))).scalars().all()
        for org in orgs:
            auth_subject: AuthSubject[Organization] = AuthSubject(
                org, {Scope.metrics_read}, None
            )
            response = await metrics_service.get_metrics(
                session,
                auth_subject,
                start_date=today - timedelta(days=35),
                end_date=today,
                timezone=tz,
                interval=TimeInterval.day,
                organization_id=[org.id],
                metrics=["monthly_recurring_revenue", "active_subscriptions"],
            )
            mrr_now = latest(response, "monthly_recurring_revenue")
            mrr_base = value_n_periods_ago(response, "monthly_recurring_revenue", 30)
            subs = int(latest(response, "active_subscriptions"))
            ctx = DetectorContext(
                organization_id=org.id, timezone=tz, today=today, metrics=response
            )
            insights = [i for d in DETECTORS if (i := d.evaluate(ctx)) is not None]
            titles = [f"{i.title} [{i.severity}]" for i in insights]
            print(
                f"{org.slug:<24} now={mrr_now / 100:>8.2f} "
                f"30d={('n/a' if mrr_base is None else f'{mrr_base / 100:.2f}'):>8} "
                f"subs={subs:>3} -> {titles}"
            )


asyncio.run(main())
