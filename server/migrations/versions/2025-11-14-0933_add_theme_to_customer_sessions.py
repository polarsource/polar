"""add theme to customer_sessions

Revision ID: f7a634ceeb55
Revises: 2dfff693f142
Create Date: 2025-11-14 09:33:18.614064

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f7a634ceeb55"
down_revision = "2dfff693f142"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("customer_sessions", sa.Column("theme", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("customer_sessions", "theme")
