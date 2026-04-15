"""add audit_logs table

Revision ID: b4c5d6e7f8a9
Revises: a1b2c3d4e5f2
Create Date: 2026-04-15 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b4c5d6e7f8a9"
down_revision = "a1b2c3d4e5f2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource_type", sa.String(), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=False),
        sa.Column("actor_type", sa.String(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("actor_name", sa.String(), nullable=True),
        sa.Column("changes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("audit_logs_organization_id_fkey"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name=op.f("audit_logs_actor_id_fkey"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("audit_logs_pkey")),
    )
    # Primary query: "show all audit entries for this org, newest first"
    op.create_index(
        "ix_audit_logs_org_created_id",
        "audit_logs",
        ["organization_id", sa.text("created_at DESC"), "id"],
    )
    # Filtered query: "show all product changes for this org"
    op.create_index(
        "ix_audit_logs_org_resource_type_created",
        "audit_logs",
        ["organization_id", "resource_type", sa.text("created_at DESC")],
    )
    # User activity query: "what did this user do?"
    op.create_index(
        "ix_audit_logs_actor_created",
        "audit_logs",
        ["actor_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_actor_created", table_name="audit_logs")
    op.drop_index(
        "ix_audit_logs_org_resource_type_created", table_name="audit_logs"
    )
    op.drop_index("ix_audit_logs_org_created_id", table_name="audit_logs")
    op.drop_table("audit_logs")
