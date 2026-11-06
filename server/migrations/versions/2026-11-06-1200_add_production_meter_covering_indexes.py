"""add production meter covering indexes

Revision ID: a2031c416b6f
Revises: 57e6b4862574
"""

import sqlalchemy as sa
from alembic import op

from polar.config import settings

revision = "a2031c416b6f"
down_revision = "57e6b4862574"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEXES = (
    (
        "ix_events_meter_94c5b1f0_external_cover",
        "3753e789-b30b-48be-b96f-fe4dd689892d",
        "billing_usage",
    ),
    (
        "ix_events_meter_379f7fd6_external_cover",
        "e4a7d515-fd73-4016-b7fe-792816457fd0",
        "bandwidth",
    ),
    (
        "ix_events_meter_7ea36ede_external_cover",
        "3039142f-21f8-4676-a7cf-1609cc831636",
        "allmates-global-credit-usage",
    ),
)


def upgrade() -> None:
    if not settings.is_production():
        return

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for index_name, organization_id, event_name in INDEXES:
                if not op.get_context().as_sql and op.get_bind().scalar(
                    sa.text(
                        "SELECT EXISTS (SELECT 1 FROM pg_index "
                        "WHERE indexrelid = to_regclass(:index_name) AND NOT indisvalid)"
                    ),
                    {"index_name": f"public.{index_name}"},
                ):
                    op.drop_index(
                        index_name,
                        table_name="events",
                        if_exists=True,
                        postgresql_concurrently=True,
                    )
                op.create_index(
                    index_name,
                    "events",
                    ["external_customer_id", "ingested_at"],
                    postgresql_include=["user_metadata"],
                    postgresql_where=(
                        f"organization_id = '{organization_id}'::uuid "
                        f"AND source = 'user' AND name = '{event_name}' "
                        "AND external_customer_id IS NOT NULL"
                    ),
                    postgresql_concurrently=True,
                    if_not_exists=True,
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    if not settings.is_production():
        return

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for index_name, _, _ in INDEXES:
                op.drop_index(
                    index_name,
                    table_name="events",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")
