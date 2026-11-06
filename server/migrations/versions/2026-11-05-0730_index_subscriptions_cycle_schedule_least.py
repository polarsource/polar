"""index subscriptions cycle schedule on least period end

Revision ID: 1fd198dfe2bd
Revises: 30bb4db922cb
Create Date: 2026-11-05 07:30:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "1fd198dfe2bd"
down_revision = "30bb4db922cb"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_subscriptions_cycle_schedule"


def _replace_index(definition: str) -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}")
            op.execute(
                f"CREATE INDEX CONCURRENTLY {INDEX_NAME} ON subscriptions {definition}"
            )
        finally:
            op.execute("RESET lock_timeout")


def upgrade() -> None:
    _replace_index(
        "(LEAST(current_period_end, current_meter_period_end)) "
        "WHERE scheduler_locked_at IS NULL "
        "AND status IN ('active', 'past_due', 'trialing') "
        "AND current_period_end IS NOT NULL"
    )


def downgrade() -> None:
    _replace_index(
        "(current_period_end) "
        "WHERE scheduler_locked_at IS NULL "
        "AND status IN ('trialing', 'active') "
        "AND current_period_end IS NOT NULL"
    )
