"""Read-only sampler: one organization per status, for prod-data review.

The "prod-data e2e" verification the plan calls for means: pull real
organizations spanning every status and exercise the v2 review path
against them. Running the agent against PROD rows would WRITE to prod
(run rows, signal history), which is never acceptable — so the safe,
correct shape is:

  1. (this script) sample real orgs READ-ONLY from a prod read-replica,
  2. then run the graph against *copies* in a local/staging DB.

This script does step 1. It connects with a read-only session,
samples one org per OrganizationStatus, and prints a compact summary.
Point it at production by setting ``POLAR_PROD_READ_DSN`` to a
read-replica DSN; with no env set it self-tests against the local DB
(proving the query path works) — which is how it's verified here,
since this sandbox has no prod connection.

Usage:
    POLAR_PROD_READ_DSN=postgresql+asyncpg://... \
        uv run python scripts/prod_readonly_sample.py
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import select, text

from polar.config import settings
from polar.kit.db.postgres import (
    create_async_engine,
    create_async_sessionmaker,
)
from polar.models.organization import Organization, OrganizationStatus


async def main() -> None:
    dsn = os.environ.get("POLAR_PROD_READ_DSN") or settings.get_postgres_dsn(
        "asyncpg"
    )
    is_prod = "POLAR_PROD_READ_DSN" in os.environ
    print(
        f"# sampling from {'PROD read-replica' if is_prod else 'LOCAL db (self-test)'}"
    )

    engine = create_async_engine(
        dsn=dsn,
        application_name="prod-readonly-sample",
        pool_size=5,
        pool_recycle=3600,
    )
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        # Belt-and-suspenders: refuse to write. A read-replica is
        # already read-only, but enforce it at the session too so a
        # mis-pointed DSN can never mutate prod.
        await session.execute(text("SET TRANSACTION READ ONLY"))

        print(f"{'status':<12} {'count':>7}  example_slug")
        print("-" * 44)
        for status in OrganizationStatus:
            count = (
                await session.execute(
                    select(text("count(*)"))
                    .select_from(Organization)
                    .where(Organization.status == status)
                )
            ).scalar_one()
            example = (
                await session.execute(
                    select(Organization.slug)
                    .where(Organization.status == status)
                    .limit(1)
                )
            ).scalar_one_or_none()
            print(f"{status.value:<12} {count:>7}  {example or '—'}")

    print(
        "\n# Next: copy any sampled org into a local/staging DB and run\n"
        "# scripts/run_graph_e2e.py-style execution against the COPY\n"
        "# (never against prod — the agent writes run + signal rows)."
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        import traceback

        traceback.print_exc(file=sys.stderr)
        print(f"SAMPLE_FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
