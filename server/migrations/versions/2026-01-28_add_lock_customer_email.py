"""Add lock_customer_email to checkouts and checkout_links

Revision ID: 4886a9c297b6
Revises: b89845322d11
Create Date: 2026-01-28 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4886a9c297b6"
down_revision = "b89845322d11"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "checkouts",
        sa.Column(
            "lock_customer_email",
            sa.Boolean(),
            nullable=False,
            server_default=sa.sql.expression.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("checkouts", "lock_customer_email")
