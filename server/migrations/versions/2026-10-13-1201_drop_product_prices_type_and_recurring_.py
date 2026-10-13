"""drop product_prices type and recurring_interval indexes

Revision ID: dbdabb804bde
Revises: a95df2da94c0
Create Date: 2026-10-13 11:59:41.454896

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "dbdabb804bde"
down_revision = "a95df2da94c0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


INDEXES = {
    "ix_product_prices_type": "type",
    "ix_product_prices_recurring_interval": "recurring_interval",
}


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for name in INDEXES:
                op.drop_index(
                    name,
                    table_name="product_prices",
                    postgresql_concurrently=True,
                    if_exists=True,
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for name, column in INDEXES.items():
                op.drop_index(
                    name,
                    table_name="product_prices",
                    postgresql_concurrently=True,
                    if_exists=True,
                )
                op.create_index(
                    name,
                    "product_prices",
                    [column],
                    unique=False,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")
