"""add organization_facets

Slice 8 foundation: multi-value / hierarchical facets per org.
Replaces (eventually) the free-form ``OrganizationDetails.selling_categories``
+ ``pricing_models`` JSONB arrays. Routing predicates in Slice 3 part
2 pivot on these.

Revision ID: e5f7a8b9c0d1
Revises: d4e6f7a8b9c0
Create Date: 2026-05-23 20:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

revision = "e5f7a8b9c0d1"
down_revision = "d4e6f7a8b9c0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_facets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("namespace", sa.String(length=48), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column(
            "source",
            sa.String(length=32),
            nullable=False,
            server_default="merchant_declared",
        ),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("reviewer_user_id", sa.Uuid(), nullable=True),
        sa.Column("confirmed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("organization_facets_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_user_id"],
            ["users.id"],
            name=op.f("organization_facets_reviewer_user_id_fkey"),
            ondelete="set null",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("organization_facets_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "namespace",
            "value",
            name="organization_facets_org_namespace_value_key",
        ),
    )
    op.create_index(
        op.f("ix_organization_facets_created_at"),
        "organization_facets",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_facets_deleted_at"),
        "organization_facets",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_facets_organization_id"),
        "organization_facets",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_facets_namespace"),
        "organization_facets",
        ["namespace"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_facets_source"),
        "organization_facets",
        ["source"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_organization_facets_source"),
        table_name="organization_facets",
    )
    op.drop_index(
        op.f("ix_organization_facets_namespace"),
        table_name="organization_facets",
    )
    op.drop_index(
        op.f("ix_organization_facets_organization_id"),
        table_name="organization_facets",
    )
    op.drop_index(
        op.f("ix_organization_facets_deleted_at"),
        table_name="organization_facets",
    )
    op.drop_index(
        op.f("ix_organization_facets_created_at"),
        table_name="organization_facets",
    )
    op.drop_table("organization_facets")
