"""add void activity tables

Revision ID: 7c4e1a90b2d8
Revises: e358bb809167
Create Date: 2026-09-17 08:42:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7c4e1a90b2d8"
down_revision = "e358bb809167"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "void_activities",
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("version_id", sa.String(), nullable=False),
        sa.Column("event_name", sa.String(), nullable=False),
        sa.Column("group_by", sa.String(), nullable=False),
        sa.Column("run_by", sa.String(), nullable=True),
        sa.Column("taxonomy", sa.String(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_activities_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_activities_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "id",
            name=op.f("void_activities_organization_id_id_key"),
        ),
        sa.UniqueConstraint(
            "organization_id",
            "slug",
            "version_id",
            name=op.f("void_activities_organization_id_slug_version_id_key"),
        ),
    )
    op.create_index(
        op.f("ix_void_activities_created_at"),
        "void_activities",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_activities_deleted_at"),
        "void_activities",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_activities_organization_id"),
        "void_activities",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_activities_version_id"),
        "void_activities",
        ["version_id"],
        unique=False,
    )
    op.create_table(
        "void_activity_spans",
        sa.Column("activity_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.String(), nullable=False),
        sa.Column("taxonomy", sa.String(), nullable=False),
        sa.Column("span_key", sa.String(), nullable=False),
        sa.Column("event_name", sa.String(), nullable=False),
        sa.Column("external_identity_id", sa.String(), nullable=True),
        sa.Column("external_root_id", sa.String(), nullable=True),
        sa.Column("run_key", sa.String(), nullable=True),
        sa.Column("activity", sa.String(), nullable=False),
        sa.Column("activity_confidence", sa.Float(), nullable=True),
        sa.Column(
            "activity_probabilities",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("waste", sa.Float(), nullable=True),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("event_count", sa.Integer(), nullable=False),
        sa.Column("first_event_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("last_event_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("state_hash", sa.String(), nullable=False),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("classified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id", "activity_id"],
            ["void_activities.organization_id", "void_activities.id"],
            name=op.f("void_activity_spans_organization_id_activity_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_activity_spans_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_activity_spans_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "version_id",
            "span_key",
            name=op.f("void_activity_spans_organization_id_version_id_span_key_key"),
        ),
    )
    op.create_index(
        op.f("ix_void_activity_spans_activity_id"),
        "void_activity_spans",
        ["activity_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_activity_spans_created_at"),
        "void_activity_spans",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_activity_spans_deleted_at"),
        "void_activity_spans",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_void_activity_spans_identity_window",
        "void_activity_spans",
        ["organization_id", "external_identity_id", "last_event_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_activity_spans_organization_id"),
        "void_activity_spans",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_activity_spans_version_id"),
        "void_activity_spans",
        ["version_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_void_activity_spans_version_id"), table_name="void_activity_spans"
    )
    op.drop_index(
        op.f("ix_void_activity_spans_organization_id"),
        table_name="void_activity_spans",
    )
    op.drop_index(
        "ix_void_activity_spans_identity_window", table_name="void_activity_spans"
    )
    op.drop_index(
        op.f("ix_void_activity_spans_deleted_at"), table_name="void_activity_spans"
    )
    op.drop_index(
        op.f("ix_void_activity_spans_created_at"), table_name="void_activity_spans"
    )
    op.drop_index(
        op.f("ix_void_activity_spans_activity_id"), table_name="void_activity_spans"
    )
    op.drop_table("void_activity_spans")
    op.drop_index(op.f("ix_void_activities_version_id"), table_name="void_activities")
    op.drop_index(
        op.f("ix_void_activities_organization_id"), table_name="void_activities"
    )
    op.drop_index(op.f("ix_void_activities_deleted_at"), table_name="void_activities")
    op.drop_index(op.f("ix_void_activities_created_at"), table_name="void_activities")
    op.drop_table("void_activities")
