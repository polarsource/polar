"""add merchant_migrations and merchant_migration_records

Revision ID: 2ccabcca866d
Revises: e7118c4ae5d8
Create Date: 2026-06-29 11:48:08.998494

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "2ccabcca866d"
down_revision = "e7118c4ae5d8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "merchant_migrations",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("source_platform", sa.String(length=32), nullable=False),
        sa.Column("step", sa.String(length=32), nullable=False),
        sa.Column(
            "source_credentials",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "pan_transfer_steps",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("merchant_migrations_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("merchant_migrations_pkey")),
    )
    op.create_index(
        op.f("ix_merchant_migrations_created_at"),
        "merchant_migrations",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_merchant_migrations_deleted_at"),
        "merchant_migrations",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_merchant_migrations_organization_id"),
        "merchant_migrations",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "merchant_migration_records",
        sa.Column("merchant_migration_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=True),
        sa.Column("canonical", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["merchant_migration_id"],
            ["merchant_migrations.id"],
            name=op.f("merchant_migration_records_merchant_migration_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("merchant_migration_records_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("merchant_migration_records_pkey")),
    )
    op.create_index(
        op.f("ix_merchant_migration_records_created_at"),
        "merchant_migration_records",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_merchant_migration_records_deleted_at"),
        "merchant_migration_records",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_merchant_migration_records_merchant_migration_id"),
        "merchant_migration_records",
        ["merchant_migration_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_merchant_migration_records_organization_id"),
        "merchant_migration_records",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_merchant_migration_records_organization_id_type_source_id",
        "merchant_migration_records",
        ["organization_id", "type", "source_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(
        "ix_merchant_migration_records_organization_id_type_source_id",
        table_name="merchant_migration_records",
    )
    op.drop_index(
        op.f("ix_merchant_migration_records_organization_id"),
        table_name="merchant_migration_records",
    )
    op.drop_index(
        op.f("ix_merchant_migration_records_merchant_migration_id"),
        table_name="merchant_migration_records",
    )
    op.drop_index(
        op.f("ix_merchant_migration_records_deleted_at"),
        table_name="merchant_migration_records",
    )
    op.drop_index(
        op.f("ix_merchant_migration_records_created_at"),
        table_name="merchant_migration_records",
    )
    op.drop_table("merchant_migration_records")
    op.drop_index(
        op.f("ix_merchant_migrations_organization_id"),
        table_name="merchant_migrations",
    )
    op.drop_index(
        op.f("ix_merchant_migrations_deleted_at"),
        table_name="merchant_migrations",
    )
    op.drop_index(
        op.f("ix_merchant_migrations_created_at"),
        table_name="merchant_migrations",
    )
    op.drop_table("merchant_migrations")
