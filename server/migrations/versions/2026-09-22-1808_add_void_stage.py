"""add void stage

Revision ID: 574326b29377
Revises: c350ed635faf
Create Date: 2026-09-22 18:08:27.899551

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "574326b29377"
down_revision = "c350ed635faf"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "void_stages",
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column(
            "configuration", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_stages_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_stages_pkey")),
        sa.UniqueConstraint(
            "organization_id", name=op.f("void_stages_organization_id_key")
        ),
    )
    op.create_index(
        op.f("ix_void_stages_created_at"), "void_stages", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_void_stages_deleted_at"), "void_stages", ["deleted_at"], unique=False
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index(op.f("ix_void_stages_deleted_at"), table_name="void_stages")
    op.drop_index(op.f("ix_void_stages_created_at"), table_name="void_stages")
    op.drop_table("void_stages")
