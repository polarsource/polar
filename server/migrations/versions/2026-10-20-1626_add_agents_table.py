"""Add agents table

Revision ID: 387e0ff257d4
Revises: 9d3b7e1f4a62
Create Date: 2026-10-20 16:26:29.456527

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "387e0ff257d4"
down_revision = "9d3b7e1f4a62"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

AGENT_ID_TABLES = ("oauth2_clients", "oauth2_tokens", "oauth2_authorization_codes")


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "agents",
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("claim_email", sa.String(length=320), nullable=True),
        sa.Column("claim_token_hash", sa.String(length=80), nullable=True),
        sa.Column("claim_token_expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("claim_link_token_hash", sa.String(length=80), nullable=True),
        sa.Column("claim_code_hash", sa.String(length=80), nullable=True),
        sa.Column("claim_expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("claimed_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("claimed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["claimed_by_user_id"],
            ["users.id"],
            name=op.f("agents_claimed_by_user_id_fkey"),
            ondelete="set null",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("agents_organization_id_fkey"),
            ondelete="set null",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("agents_pkey")),
        sa.UniqueConstraint(
            "claim_link_token_hash", name=op.f("agents_claim_link_token_hash_key")
        ),
        sa.UniqueConstraint(
            "claim_token_hash", name=op.f("agents_claim_token_hash_key")
        ),
        sa.UniqueConstraint("organization_id", name=op.f("agents_organization_id_key")),
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_agents_claimed_by_user_id"),
        "agents",
        ["claimed_by_user_id"],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_agents_created_at"),
        "agents",
        ["created_at"],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_agents_deleted_at"),
        "agents",
        ["deleted_at"],
        unique=False,
        if_not_exists=True,
    )
    for table in AGENT_ID_TABLES:
        op.add_column(
            table,
            sa.Column("agent_id", sa.Uuid(), nullable=True),
            if_not_exists=True,
        )
        op.drop_constraint(
            op.f(f"{table}_agent_id_fkey"),
            table,
            type_="foreignkey",
            if_exists=True,
        )
        op.create_foreign_key(
            op.f(f"{table}_agent_id_fkey"),
            table,
            "agents",
            ["agent_id"],
            ["id"],
            ondelete="cascade",
            postgresql_not_valid=True,
        )

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            for table in AGENT_ID_TABLES:
                op.execute(
                    f"ALTER TABLE {table} VALIDATE CONSTRAINT {table}_agent_id_fkey"
                )
        finally:
            op.execute("RESET lock_timeout")

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for table in AGENT_ID_TABLES:
                index_name = f"ix_{table}_agent_id"
                op.drop_index(
                    index_name,
                    table_name=table,
                    if_exists=True,
                    postgresql_concurrently=True,
                )
                op.create_index(
                    index_name,
                    table,
                    ["agent_id"],
                    # One OAuth2 client per agent.
                    unique=table == "oauth2_clients",
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    for table in AGENT_ID_TABLES:
        op.drop_column(table, "agent_id")
    op.drop_index(op.f("ix_agents_deleted_at"), table_name="agents")
    op.drop_index(op.f("ix_agents_created_at"), table_name="agents")
    op.drop_index(op.f("ix_agents_claimed_by_user_id"), table_name="agents")
    op.drop_table("agents")
