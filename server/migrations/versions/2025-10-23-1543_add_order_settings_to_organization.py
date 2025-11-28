"""add order_settings to organizations with invoice_numbering

Revision ID: 9b0f38cdd25d
Revises: 1ac3957fd2cf
Create Date: 2025-10-23 15:43:43.869159

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9b0f38cdd25d"
down_revision = "1ac3957fd2cf"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "order_settings",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE organizations
        SET order_settings = '{"invoice_numbering": "organization"}'::jsonb
        """
    )

    op.alter_column("organizations", "order_settings", nullable=False)


def downgrade() -> None:
    op.drop_column("organizations", "order_settings")
