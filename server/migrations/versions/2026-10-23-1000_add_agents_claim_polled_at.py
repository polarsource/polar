"""add agents.claim_polled_at

Revision ID: 9c3e7a1d5b24
Revises: b0b40701a365
Create Date: 2026-10-23 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9c3e7a1d5b24"
down_revision = "b0b40701a365"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column("claim_polled_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agents", "claim_polled_at")
