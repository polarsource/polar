"""backfill trial_ended_reactivation_period in subscription settings

Revision ID: 130908012c24
Revises: 3c1e7a9d52f4
Create Date: 2026-11-23 13:57:12.601151

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "130908012c24"
down_revision = "3c1e7a9d52f4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    # scripts.backfill_trial_ended_reactivation_period does the real work first;
    # this only catches rows it missed.
    op.execute(
        """
        UPDATE organizations
        SET subscription_settings = '{"trial_ended_reactivation_period": 14}'::jsonb
            || subscription_settings
        WHERE NOT subscription_settings ? 'trial_ended_reactivation_period'
        """
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
