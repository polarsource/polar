"""add precheck_report to merchant_migrations

Revision ID: b7f3a9c21d84
Revises: fef393bb1f53
Create Date: 2026-07-02 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b7f3a9c21d84"
down_revision = "fef393bb1f53"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "merchant_migrations",
        sa.Column(
            "precheck_report",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("merchant_migrations", "precheck_report")
