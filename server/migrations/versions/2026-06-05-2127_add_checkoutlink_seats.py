"""Add CheckoutLink.seats

Revision ID: 31bc85d4a4c4
Revises: 325c6505b262
Create Date: 2026-06-05 21:27:53.233163

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "31bc85d4a4c4"
down_revision = "325c6505b262"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column("checkout_links", sa.Column("seats", sa.Integer(), nullable=True))


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("checkout_links", "seats")
