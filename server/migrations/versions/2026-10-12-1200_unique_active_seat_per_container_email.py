"""unique active seat per container and email

Revision ID: 35487315a54f
Revises: 839bf237e801
Create Date: 2026-10-12 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "35487315a54f"
down_revision = "839bf237e801"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


INDEXES = {
    "customer_seats_subscription_id_lower_email_active_key": ("subscription_id"),
    "customer_seats_order_id_lower_email_active_key": "order_id",
}


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for name, column in INDEXES.items():
            # Drop any INVALID leftover from an interrupted concurrent build first.
            op.drop_index(
                name,
                table_name="customer_seats",
                postgresql_concurrently=True,
                if_exists=True,
            )
            op.create_index(
                name,
                "customer_seats",
                [column, sa.text("lower(email)")],
                unique=True,
                postgresql_where=sa.text("status != 'revoked'"),
                postgresql_concurrently=True,
            )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name in INDEXES:
            op.drop_index(
                name,
                table_name="customer_seats",
                postgresql_concurrently=True,
                if_exists=True,
            )
