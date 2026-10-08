"""Add reducer bucket interval index

Revision ID: 839bf237e801
Revises: 4925930eb877
Create Date: 2026-10-08 16:18:02.889110

"""

from alembic import op

revision = "839bf237e801"
down_revision = "4925930eb877"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_reducer_buckets_organization_reducer_bucket_start"


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
                ["organization_id", "reducer_id", "bucket_start"],
                unique=False,
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
