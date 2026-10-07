"""Add reducers and reducer buckets

Revision ID: 847ece08711b
Revises: 200d10ea2bdd
Create Date: 2026-10-07 10:49:53.600185

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "847ece08711b"
down_revision = "200d10ea2bdd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "reducers",
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("filter", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "aggregation",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("reducers_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("reducers_pkey")),
    )
    op.create_index(
        op.f("ix_reducers_deleted_at"), "reducers", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_reducers_organization_id"),
        "reducers",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "reducer_buckets",
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("reducer_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("external_customer_id", sa.String(), nullable=True),
        sa.Column("bucket_start", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("count", sa.BigInteger(), nullable=False),
        sa.Column("sum", sa.Numeric(), nullable=False),
        sa.Column("min", sa.Numeric(), nullable=True),
        sa.Column("max", sa.Numeric(), nullable=True),
        sa.Column("sealed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("generation", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name=op.f("reducer_buckets_customer_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("reducer_buckets_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["reducer_id"],
            ["reducers.id"],
            name=op.f("reducer_buckets_reducer_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("reducer_buckets_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "reducer_id",
            "customer_id",
            "external_customer_id",
            "bucket_start",
            "generation",
            name="reducer_buckets_identity_generation_key",
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_index(
        op.f("ix_reducer_buckets_deleted_at"),
        "reducer_buckets",
        ["deleted_at"],
        unique=False,
    )
    op.create_table(
        "meter_reducers",
        sa.Column("meter_id", sa.Uuid(), nullable=False),
        sa.Column("reducer_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["meter_id"],
            ["meters.id"],
            name=op.f("meter_reducers_meter_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["reducer_id"],
            ["reducers.id"],
            name=op.f("meter_reducers_reducer_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint(
            "meter_id", "reducer_id", name=op.f("meter_reducers_pkey")
        ),
    )
    op.create_index(
        op.f("ix_meter_reducers_reducer_id"),
        "meter_reducers",
        ["reducer_id"],
        unique=False,
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(op.f("ix_meter_reducers_reducer_id"), table_name="meter_reducers")
    op.drop_table("meter_reducers")
    op.drop_index(op.f("ix_reducer_buckets_deleted_at"), table_name="reducer_buckets")
    op.drop_table("reducer_buckets")
    op.drop_index(op.f("ix_reducers_organization_id"), table_name="reducers")
    op.drop_index(op.f("ix_reducers_deleted_at"), table_name="reducers")
    op.drop_table("reducers")
