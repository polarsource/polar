"""add customer session authentication sessions and email otps

Revision ID: f49a44e66c0c
Revises: e4c93484fe51
Create Date: 2026-10-27 10:33:09.019814

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f49a44e66c0c"
down_revision = "e4c93484fe51"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "customer_session_authentication_sessions",
        sa.Column("token_hash", sa.CHAR(length=64), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("step", sa.SmallInteger(), nullable=False),
        sa.Column(
            "authentication_method_references",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "used_factors", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("identity_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["identity_id"],
            ["members.id"],
            name=op.f("customer_session_authentication_sessions_identity_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint(
            "id", name=op.f("customer_session_authentication_sessions_pkey")
        ),
        sa.UniqueConstraint(
            "token_hash",
            name=op.f("customer_session_authentication_sessions_token_hash_key"),
        ),
    )
    op.create_index(
        op.f("ix_customer_session_authentication_sessions_created_at"),
        "customer_session_authentication_sessions",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_session_authentication_sessions_deleted_at"),
        "customer_session_authentication_sessions",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_session_authentication_sessions_expires_at"),
        "customer_session_authentication_sessions",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_session_authentication_sessions_identity_id"),
        "customer_session_authentication_sessions",
        ["identity_id"],
        unique=False,
    )
    op.create_table(
        "customer_session_email_otps",
        sa.Column("code_hash", sa.CHAR(length=64), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("identity_id", sa.Uuid(), nullable=False),
        sa.Column("authentication_session_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["authentication_session_id"],
            ["customer_session_authentication_sessions.id"],
            name=op.f("customer_session_email_otps_authentication_session_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["identity_id"],
            ["members.id"],
            name=op.f("customer_session_email_otps_identity_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("customer_session_email_otps_pkey")),
    )
    op.create_index(
        op.f("ix_customer_session_email_otps_authentication_session_id"),
        "customer_session_email_otps",
        ["authentication_session_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_session_email_otps_created_at"),
        "customer_session_email_otps",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_session_email_otps_deleted_at"),
        "customer_session_email_otps",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_session_email_otps_expires_at"),
        "customer_session_email_otps",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_session_email_otps_identity_id"),
        "customer_session_email_otps",
        ["identity_id"],
        unique=False,
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(
        op.f("ix_customer_session_email_otps_identity_id"),
        table_name="customer_session_email_otps",
    )
    op.drop_index(
        op.f("ix_customer_session_email_otps_expires_at"),
        table_name="customer_session_email_otps",
    )
    op.drop_index(
        op.f("ix_customer_session_email_otps_deleted_at"),
        table_name="customer_session_email_otps",
    )
    op.drop_index(
        op.f("ix_customer_session_email_otps_created_at"),
        table_name="customer_session_email_otps",
    )
    op.drop_index(
        op.f("ix_customer_session_email_otps_authentication_session_id"),
        table_name="customer_session_email_otps",
    )
    op.drop_table("customer_session_email_otps")
    op.drop_index(
        op.f("ix_customer_session_authentication_sessions_identity_id"),
        table_name="customer_session_authentication_sessions",
    )
    op.drop_index(
        op.f("ix_customer_session_authentication_sessions_expires_at"),
        table_name="customer_session_authentication_sessions",
    )
    op.drop_index(
        op.f("ix_customer_session_authentication_sessions_deleted_at"),
        table_name="customer_session_authentication_sessions",
    )
    op.drop_index(
        op.f("ix_customer_session_authentication_sessions_created_at"),
        table_name="customer_session_authentication_sessions",
    )
    op.drop_table("customer_session_authentication_sessions")
