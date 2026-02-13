"""Create organization_agent_reviews table

Revision ID: a1c2d3e4f567
Revises: b7a3d4baf848
Create Date: 2026-02-13 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1c2d3e4f567"
down_revision = "b7a3d4baf848"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_agent_reviews",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("report", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("model_used", sa.String(), nullable=False),
        sa.Column(
            "reviewed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("organization_agent_reviews_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("organization_agent_reviews_pkey")),
    )
    op.create_index(
        op.f("ix_organization_agent_reviews_created_at"),
        "organization_agent_reviews",
        ["created_at"],
    )
    op.create_index(
        op.f("ix_organization_agent_reviews_deleted_at"),
        "organization_agent_reviews",
        ["deleted_at"],
    )
    op.create_index(
        op.f("ix_organization_agent_reviews_organization_id"),
        "organization_agent_reviews",
        ["organization_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_organization_agent_reviews_organization_id"),
        table_name="organization_agent_reviews",
    )
    op.drop_index(
        op.f("ix_organization_agent_reviews_deleted_at"),
        table_name="organization_agent_reviews",
    )
    op.drop_index(
        op.f("ix_organization_agent_reviews_created_at"),
        table_name="organization_agent_reviews",
    )
    op.drop_table("organization_agent_reviews")
