"""remove locale column length constraint

Revision ID: b43b68670937
Revises: 2026_02_09_1500
Create Date: 2026-02-10 10:11:13.876119

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b43b68670937"
down_revision = "2026_02_09_1500"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "checkouts", "locale", type_=sa.String(), existing_type=sa.String(5)
    )
    op.alter_column(
        "customers", "locale", type_=sa.String(), existing_type=sa.String(5)
    )


def downgrade() -> None:
    op.alter_column(
        "checkouts", "locale", type_=sa.String(5), existing_type=sa.String()
    )
    op.alter_column(
        "customers", "locale", type_=sa.String(5), existing_type=sa.String()
    )
