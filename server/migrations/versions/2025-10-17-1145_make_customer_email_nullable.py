"""make_customer_email_nullable

Revision ID: 437c870b943f
Revises: 59a5d45ae3fd
Create Date: 2025-10-17 11:45:42.740616

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "437c870b943f"
down_revision = "59a5d45ae3fd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Make email nullable - NULL email indicates a placeholder customer
    op.alter_column(
        "customers", "email", existing_type=sa.String(length=320), nullable=True
    )


def downgrade() -> None:
    # Revert email to not nullable (this will fail if there are null emails)
    op.alter_column(
        "customers", "email", existing_type=sa.String(length=320), nullable=False
    )
