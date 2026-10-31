"""index checkouts for list queries

Revision ID: ccfe473b6484
Revises: 9c7e4a1f2b38
Create Date: 2026-10-26 14:21:22.967004

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "ccfe473b6484"
down_revision = "9c7e4a1f2b38"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEXES: list[tuple[str, list[str], str]] = [
    (
        "ix_checkouts_organization_id_created_at",
        ["organization_id", "created_at"],
        "deleted_at IS NULL",
    ),
    ("ix_checkouts_customer_id", ["customer_id"], "customer_id IS NOT NULL"),
]


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for name, columns, where in INDEXES:
                # Recover an invalid index left by an interrupted concurrent build.
                op.drop_index(
                    name,
                    table_name="checkouts",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
                op.create_index(
                    name,
                    "checkouts",
                    columns,
                    unique=False,
                    postgresql_where=sa.text(where),
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for name, _, _ in INDEXES:
                op.drop_index(
                    name,
                    table_name="checkouts",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")
