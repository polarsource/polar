"""Add meter buckets

Revision ID: 847ece08711b
Revises: 200d10ea2bdd
Create Date: 2026-10-06 16:21:08.695787

"""

import sqlalchemy as sa
from alembic import op

revision = "847ece08711b"
down_revision = "200d10ea2bdd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "meter_buckets",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("meter_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("external_customer_id", sa.String(), nullable=True),
        sa.Column("bucket_start", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("generation", sa.Integer(), nullable=False),
        sa.Column("count", sa.BigInteger(), nullable=False),
        sa.Column("sum", sa.Numeric(), nullable=False),
        sa.Column("min", sa.Numeric(), nullable=True),
        sa.Column("max", sa.Numeric(), nullable=True),
        sa.Column("sealed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name=op.f("meter_buckets_customer_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["meter_id"],
            ["meters.id"],
            name=op.f("meter_buckets_meter_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("meter_buckets_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("meter_buckets_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "meter_id",
            "customer_id",
            "external_customer_id",
            "bucket_start",
            "generation",
            name="meter_buckets_identity_generation_key",
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_index(
        op.f("ix_meter_buckets_deleted_at"),
        "meter_buckets",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(op.f("ix_meter_buckets_deleted_at"), table_name="meter_buckets")
    op.drop_table("meter_buckets")
