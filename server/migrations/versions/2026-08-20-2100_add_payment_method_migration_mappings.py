"""add payment method migration mappings

Revision ID: 4f6d7a8b9c10
Revises: a83cf131398d
Create Date: 2026-08-20 21:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4f6d7a8b9c10"
down_revision = "a83cf131398d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "merchant_migration_payment_method_mappings",
        sa.Column("merchant_migration_id", sa.Uuid(), nullable=False),
        sa.Column("source_customer_id", sa.String(), nullable=False),
        sa.Column("source_payment_method_id", sa.String(), nullable=False),
        sa.Column("destination_customer_id", sa.String(), nullable=False),
        sa.Column("destination_payment_method_id", sa.String(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["merchant_migration_id"],
            ["merchant_migrations.id"],
            name=op.f(
                "merchant_migration_payment_method_mappings_merchant_migration_id_fkey"
            ),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint(
            "id", name=op.f("merchant_migration_payment_method_mappings_pkey")
        ),
    )
    op.create_index(
        op.f("ix_merchant_migration_payment_method_mappings_created_at"),
        "merchant_migration_payment_method_mappings",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_merchant_migration_payment_method_mappings_deleted_at"),
        "merchant_migration_payment_method_mappings",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_merchant_migration_payment_method_mappings_destination",
        "merchant_migration_payment_method_mappings",
        ["merchant_migration_id", "destination_payment_method_id"],
        unique=True,
    )
    op.create_index(
        op.f(
            "ix_merchant_migration_payment_method_mappings_merchant_migration_id"
        ),
        "merchant_migration_payment_method_mappings",
        ["merchant_migration_id"],
        unique=False,
    )
    op.create_index(
        "ix_merchant_migration_payment_method_mappings_source",
        "merchant_migration_payment_method_mappings",
        ["merchant_migration_id", "source_payment_method_id"],
        unique=True,
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_table("merchant_migration_payment_method_mappings")
