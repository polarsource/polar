"""add organization_risk_signals account_evaluation_id

Revision ID: c7e2a91b4f18
Revises: 38a9961f9d09
Create Date: 2026-09-15 13:50:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c7e2a91b4f18"
down_revision = "38a9961f9d09"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_organization_risk_signals_account_evaluation_id"


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "organization_risk_signals",
        sa.Column("account_evaluation_id", sa.String(), nullable=True),
        if_not_exists=True,
    )

    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            INDEX_NAME,
            table_name="organization_risk_signals",
            postgresql_concurrently=True,
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
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX_NAME,
            table_name="organization_risk_signals",
            postgresql_concurrently=True,
            if_exists=True,
        )

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("organization_risk_signals", "account_evaluation_id")
