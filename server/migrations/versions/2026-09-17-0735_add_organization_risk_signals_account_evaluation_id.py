"""add organization_risk_signals account_evaluation_id

Revision ID: c7e2a91b4f18
Revises: 1e1927f940ee
Create Date: 2026-09-17 07:35:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c7e2a91b4f18"
down_revision = "1e1927f940ee"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_organization_risk_signals_account_evaluation_id"

# The index is built non-concurrently on purpose. CREATE INDEX CONCURRENTLY
# waits for every transaction holding a snapshot older than its own, database
# wide, whether or not it touches this table; under a 5s lock_timeout any
# unrelated transaction living longer than that cancels the build. A plain
# CREATE INDEX only needs the ShareLock on this table, which the ADD COLUMN
# above already holds, so it adds no further lock wait. The table is small and
# only written from Stripe risk webhooks, and the predicate matches no row at
# all while the column is brand new, so the build itself is instant.


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "organization_risk_signals",
        sa.Column("account_evaluation_id", sa.String(), nullable=True),
        if_not_exists=True,
    )
    # Drop any INVALID leftover from an earlier interrupted concurrent build:
    # CREATE INDEX IF NOT EXISTS would otherwise adopt it and leave it unusable.
    op.drop_index(
        INDEX_NAME,
        table_name="organization_risk_signals",
        if_exists=True,
    )
    op.create_index(
        INDEX_NAME,
        "organization_risk_signals",
        ["account_evaluation_id"],
        unique=True,
        postgresql_where=sa.text(
            "account_evaluation_id IS NOT NULL AND deleted_at IS NULL"
        ),
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(
        INDEX_NAME,
        table_name="organization_risk_signals",
        if_exists=True,
    )
    op.drop_column("organization_risk_signals", "account_evaluation_id")
