"""drop organization refunds_blocked column

Revision ID: d3f5e1a7b2c4
Revises: befcfa872c35
Create Date: 2026-04-22 13:28:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d3f5e1a7b2c4"
down_revision = "befcfa872c35"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Fail fast on lock contention. Requires `backfill_org_capabilities.py
    # --execute` to have run first; otherwise SET NOT NULL errors.
    op.execute("SET lock_timeout = '2s'")

    op.alter_column("organizations", "capabilities", nullable=False)
    op.drop_column("organizations", "refunds_blocked")


def downgrade() -> None:
    op.execute("SET lock_timeout = '2s'")
    op.add_column(
        "organizations",
        sa.Column(
            "refunds_blocked",
            sa.Boolean(),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE organizations
        SET refunds_blocked = NOT (capabilities->>'refunds')::boolean
        """
    )
    op.alter_column("organizations", "refunds_blocked", nullable=False)
    op.alter_column(
        "organizations",
        "capabilities",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
    )
