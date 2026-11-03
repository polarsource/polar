"""Add reducer bucket unsealed index

Revision ID: 0b6d1f3c9a2e
Revises: f7b3f7545a6c
Create Date: 2026-10-13 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "0b6d1f3c9a2e"
down_revision = "f7b3f7545a6c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_reducer_buckets_unsealed_identity"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="reducer_buckets",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                INDEX_NAME,
                "reducer_buckets",
                [
                    "organization_id",
                    "reducer_id",
                    "customer_id",
                    "external_customer_id",
                    "bucket_end",
                ],
                unique=False,
                postgresql_where=sa.text("sealed_at IS NULL"),
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="reducer_buckets",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
