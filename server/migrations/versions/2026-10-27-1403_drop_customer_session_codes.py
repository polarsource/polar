"""drop customer_session_codes

Revision ID: 63f5f40b47d9
Revises: f49a44e66c0c
Create Date: 2026-10-27 14:03:24.750045

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "63f5f40b47d9"
down_revision = "f49a44e66c0c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(
        op.f("ix_customer_session_codes_created_at"),
        table_name="customer_session_codes",
    )
    op.drop_index(
        op.f("ix_customer_session_codes_customer_id"),
        table_name="customer_session_codes",
    )
    op.drop_index(
        op.f("ix_customer_session_codes_deleted_at"),
        table_name="customer_session_codes",
    )
    op.drop_index(
        op.f("ix_customer_session_codes_expires_at"),
        table_name="customer_session_codes",
    )
    op.drop_table("customer_session_codes")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "customer_session_codes",
        sa.Column(
            "expires_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("email", sa.VARCHAR(length=320), autoincrement=False, nullable=False),
        sa.Column("customer_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "code_v2", sa.VARCHAR(length=80), autoincrement=False, nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name=op.f("customer_session_codes_customer_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("customer_session_codes_pkey")),
        sa.UniqueConstraint(
            "code_v2",
            name=op.f("customer_session_codes_code_v2_key"),
            postgresql_include=[],
            postgresql_nulls_not_distinct=False,
        ),
    )
    op.create_index(
        op.f("ix_customer_session_codes_expires_at"),
        "customer_session_codes",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_session_codes_deleted_at"),
        "customer_session_codes",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_session_codes_customer_id"),
        "customer_session_codes",
        ["customer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_session_codes_created_at"),
        "customer_session_codes",
        ["created_at"],
        unique=False,
    )
