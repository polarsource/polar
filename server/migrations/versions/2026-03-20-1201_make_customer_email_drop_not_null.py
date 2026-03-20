"""Make customer.email nullable — drop NOT NULL

Revision ID: 1a2e0acc75e3
Revises: cae16e5e72ec
Create Date: 2026-03-20 12:01:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "1a2e0acc75e3"
down_revision = "cae16e5e72ec"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("SET LOCAL lock_timeout = '2s'"))
    op.execute(sa.text("SET LOCAL statement_timeout = '15s'"))

    op.alter_column(
        "customers",
        "email",
        existing_type=sa.String(320),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "customers",
        "email",
        existing_type=sa.String(320),
        nullable=False,
    )
