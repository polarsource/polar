"""add billing_emails to customers

Revision ID: 3f8a2c6d9e15
Revises: 9d3b7e1f4a62
Create Date: 2026-10-20 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3f8a2c6d9e15"
down_revision = "9d3b7e1f4a62"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "customers",
        sa.Column(
            "billing_emails",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("customers", "billing_emails")
