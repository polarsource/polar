"""add analytics_metadata to checkout

Revision ID: 69ef1626e8db
Revises: 6145195fc43a
Create Date: 2026-01-20 13:56:05.860812

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "69ef1626e8db"
down_revision = "597080a0dd14"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "checkouts",
        sa.Column("analytics_metadata", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("checkouts", "analytics_metadata")
