"""Add first_applied_at to discount_redemptions

Revision ID: 9d5e6f7a8b9c
Revises: 8c4a2b3d5e6f
Create Date: 2025-12-29 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9d5e6f7a8b9c"
down_revision = "8c4a2b3d5e6f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "discount_redemptions",
        sa.Column(
            "first_applied_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "discount_redemptions",
        sa.Column(
            "first_applied_billing_entry_id",
            sa.Uuid(),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_discount_redemptions_first_applied_billing_entry",
        "discount_redemptions",
        "billing_entries",
        ["first_applied_billing_entry_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_discount_redemptions_first_applied_billing_entry",
        "discount_redemptions",
        type_="foreignkey",
    )
    op.drop_column("discount_redemptions", "first_applied_billing_entry_id")
    op.drop_column("discount_redemptions", "first_applied_at")
