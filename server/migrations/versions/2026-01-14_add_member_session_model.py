"""Add MemberSession model

Revision ID: ab473a734057
Revises: 3f4a5b6c7d8e
Create Date: 2026-01-14

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "ab473a734057"
down_revision = "3f4a5b6c7d8e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "member_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("token", sa.CHAR(64), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("return_url", sa.String(), nullable=True),
        sa.Column("member_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["members.id"],
            name=op.f("member_sessions_member_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("member_sessions_pkey")),
        sa.UniqueConstraint("token", name=op.f("member_sessions_token_key")),
    )
    op.create_index(
        op.f("ix_member_sessions_created_at"),
        "member_sessions",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_member_sessions_deleted_at"),
        "member_sessions",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_member_sessions_expires_at"),
        "member_sessions",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_member_sessions_member_id"),
        "member_sessions",
        ["member_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_member_sessions_member_id"), table_name="member_sessions")
    op.drop_index(op.f("ix_member_sessions_expires_at"), table_name="member_sessions")
    op.drop_index(op.f("ix_member_sessions_deleted_at"), table_name="member_sessions")
    op.drop_index(op.f("ix_member_sessions_created_at"), table_name="member_sessions")
    op.drop_table("member_sessions")
