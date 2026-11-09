"""add trgm indexes on customers search columns

Revision ID: edad465d12f6
Revises: 81181ca186b1
Create Date: 2026-11-05 10:01:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "edad465d12f6"
down_revision = "81181ca186b1"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

COLUMNS = ("email", "name", "billing_name", "external_id")


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for column in COLUMNS:
                index_name = f"ix_customers_{column}_trgm"
                op.drop_index(
                    index_name,
                    table_name="customers",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
                op.create_index(
                    index_name,
                    "customers",
                    [sa.text(f"{column} gin_trgm_ops")],
                    postgresql_concurrently=True,
                    postgresql_using="gin",
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for column in COLUMNS:
                op.drop_index(
                    f"ix_customers_{column}_trgm",
                    table_name="customers",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")
