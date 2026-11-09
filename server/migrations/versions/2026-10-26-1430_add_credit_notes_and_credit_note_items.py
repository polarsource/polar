"""Add credit notes and credit note items

Revision ID: 08de7c939c47
Revises: 9c7e4a1f2b38
Create Date: 2026-10-26 14:30:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "08de7c939c47"
down_revision = "9c7e4a1f2b38"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "credit_notes",
        sa.Column("number", sa.String(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("tax_amount", sa.BigInteger(), nullable=False),
        sa.Column("billing_name", sa.String(), nullable=True),
        sa.Column(
            "billing_address",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "tax_id",
            postgresql.JSONB(none_as_null=True, astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("path", sa.String(), nullable=True),
        sa.Column("checksum", sa.String(), nullable=True),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.id"], name=op.f("credit_notes_order_id_fkey")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("credit_notes_pkey")),
        sa.UniqueConstraint("number", name=op.f("credit_notes_number_key")),
    )
    op.create_index(
        op.f("ix_credit_notes_created_at"), "credit_notes", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_credit_notes_deleted_at"), "credit_notes", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_credit_notes_order_id"), "credit_notes", ["order_id"], unique=False
    )
    op.create_table(
        "credit_note_items",
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("tax_amount", sa.BigInteger(), nullable=False),
        sa.Column(
            "tax_details",
            postgresql.JSONB(none_as_null=True, astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("credit_note_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["credit_note_id"],
            ["credit_notes.id"],
            name=op.f("credit_note_items_credit_note_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("credit_note_items_pkey")),
    )
    op.create_index(
        op.f("ix_credit_note_items_created_at"),
        "credit_note_items",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_credit_note_items_credit_note_id"),
        "credit_note_items",
        ["credit_note_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_credit_note_items_deleted_at"),
        "credit_note_items",
        ["deleted_at"],
        unique=False,
    )
    op.add_column("refunds", sa.Column("credit_note_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("refunds_credit_note_id_fkey"),
        "refunds",
        "credit_notes",
        ["credit_note_id"],
        ["id"],
        postgresql_not_valid=True,
    )

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                op.f("ix_refunds_credit_note_id"),
                table_name="refunds",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                op.f("ix_refunds_credit_note_id"),
                "refunds",
                ["credit_note_id"],
                unique=False,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute("ALTER TABLE refunds VALIDATE CONSTRAINT refunds_credit_note_id_fkey")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        op.f("refunds_credit_note_id_fkey"), "refunds", type_="foreignkey"
    )
    op.drop_index(op.f("ix_refunds_credit_note_id"), table_name="refunds")
    op.drop_column("refunds", "credit_note_id")
    op.drop_index(
        op.f("ix_credit_note_items_deleted_at"), table_name="credit_note_items"
    )
    op.drop_index(
        op.f("ix_credit_note_items_credit_note_id"), table_name="credit_note_items"
    )
    op.drop_index(
        op.f("ix_credit_note_items_created_at"), table_name="credit_note_items"
    )
    op.drop_table("credit_note_items")
    op.drop_index(op.f("ix_credit_notes_order_id"), table_name="credit_notes")
    op.drop_index(op.f("ix_credit_notes_deleted_at"), table_name="credit_notes")
    op.drop_index(op.f("ix_credit_notes_created_at"), table_name="credit_notes")
    op.drop_table("credit_notes")
