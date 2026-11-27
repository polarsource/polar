"""add reducer bucket totals covering index

Revision ID: f1ea578361f3
Revises: b1ddc54830ae
Create Date: 2026-11-27 15:31:00.196777

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f1ea578361f3"
down_revision = "b1ddc54830ae"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

REDUCER_BUCKETS_TOTALS_INDEX = "ix_reducer_buckets_identity_bucket_start_totals"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                REDUCER_BUCKETS_TOTALS_INDEX,
                table_name="reducer_buckets",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                REDUCER_BUCKETS_TOTALS_INDEX,
                "reducer_buckets",
                [
                    "organization_id",
                    "reducer_id",
                    "customer_id",
                    "external_customer_id",
                    "bucket_start",
                ],
                unique=False,
                postgresql_include=["count", "sum", "min", "max"],
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                REDUCER_BUCKETS_TOTALS_INDEX,
                table_name="reducer_buckets",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
