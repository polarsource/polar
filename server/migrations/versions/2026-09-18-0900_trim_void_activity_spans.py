"""trim void activity spans

Activity definitions move into the deployment configuration; spans carry
group_by themselves and queue their own classification through due_at.

Revision ID: c3a7f2d81e64
Revises: b27d5e91c4a3
Create Date: 2026-09-18 09:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c3a7f2d81e64"
down_revision = "b27d5e91c4a3"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        op.f("void_activity_spans_organization_id_activity_id_fkey"),
        "void_activity_spans",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_void_activity_spans_activity_id"), table_name="void_activity_spans"
    )
    op.add_column(
        "void_activity_spans",
        sa.Column("group_by", sa.String(), nullable=False, server_default="call_id"),
    )
    op.alter_column("void_activity_spans", "group_by", server_default=None)
    op.add_column(
        "void_activity_spans",
        sa.Column("due_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_void_activity_spans_due_at",
        "void_activity_spans",
        ["due_at"],
        unique=False,
        postgresql_where=sa.text("due_at IS NOT NULL"),
    )
    op.drop_column("void_activity_spans", "activity_id")
    op.drop_column("void_activity_spans", "taxonomy")
    op.drop_column("void_activity_spans", "run_key")
    op.drop_column("void_activity_spans", "activity_probabilities")

    op.drop_index(op.f("ix_void_activities_version_id"), table_name="void_activities")
    op.drop_index(
        op.f("ix_void_activities_organization_id"), table_name="void_activities"
    )
    op.drop_index(op.f("ix_void_activities_deleted_at"), table_name="void_activities")
    op.drop_index(op.f("ix_void_activities_created_at"), table_name="void_activities")
    op.drop_table("void_activities")

    op.create_index(
        "ix_void_events_metadata",
        "void_events",
        [sa.text("((payload ->> 'metadata')::jsonb)")],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"((payload ->> 'metadata')::jsonb)": "jsonb_path_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_void_events_metadata", table_name="void_events")
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
    for column in ("created_at", "deleted_at", "organization_id", "version_id"):
        op.create_index(
            op.f(f"ix_void_activities_{column}"),
            "void_activities",
            [column],
            unique=False,
        )
    op.drop_index("ix_void_activity_spans_due_at", table_name="void_activity_spans")
    op.drop_column("void_activity_spans", "due_at")
    op.drop_column("void_activity_spans", "group_by")
    op.add_column(
        "void_activity_spans",
        sa.Column(
            "activity_probabilities", sa.dialects.postgresql.JSONB(), nullable=True
        ),
    )
    op.add_column(
        "void_activity_spans", sa.Column("run_key", sa.String(), nullable=True)
    )
    op.add_column(
        "void_activity_spans",
        sa.Column(
            "taxonomy", sa.String(), nullable=False, server_default="polar.agent/v1"
        ),
    )
    op.add_column(
        "void_activity_spans", sa.Column("activity_id", sa.Uuid(), nullable=True)
    )
