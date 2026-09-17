"""add void sense tables

Revision ID: a91c3f4e8b17
Revises: 7c4e1a90b2d8
Create Date: 2026-09-17 15:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a91c3f4e8b17"
down_revision = "7c4e1a90b2d8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "void_senses",
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("version_id", sa.String(), nullable=False),
        sa.Column("activity_id", sa.Uuid(), nullable=False),
        sa.Column("activity_slug", sa.String(), nullable=False),
        sa.Column("when", sa.String(), nullable=False),
        sa.Column("over_type", sa.String(), nullable=False),
        sa.Column("window_amount", sa.Integer(), nullable=True),
        sa.Column("window_unit", sa.String(), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id", "activity_id"],
            ["void_activities.organization_id", "void_activities.id"],
            name=op.f("void_senses_organization_id_activity_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_senses_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_senses_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "id",
            name=op.f("void_senses_organization_id_id_key"),
        ),
        sa.UniqueConstraint(
            "organization_id",
            "slug",
            "version_id",
            name=op.f("void_senses_organization_id_slug_version_id_key"),
        ),
    )
    op.create_index(
        op.f("ix_void_senses_activity_id"), "void_senses", ["activity_id"], unique=False
    )
    op.create_index(
        op.f("ix_void_senses_created_at"), "void_senses", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_void_senses_deleted_at"), "void_senses", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_void_senses_organization_id"),
        "void_senses",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_senses_version_id"), "void_senses", ["version_id"], unique=False
    )
    op.create_table(
        "void_sense_observations",
        sa.Column("sense_id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.String(), nullable=False),
        sa.Column("external_identity_id", sa.String(), nullable=False),
        sa.Column("external_root_id", sa.String(), nullable=True),
        sa.Column("run_key", sa.String(), nullable=False),
        sa.Column("noul", sa.Float(), nullable=False),
        sa.Column("state_hash", sa.String(), nullable=False),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("span_count", sa.Integer(), nullable=False),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("mix", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("evaluated_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id", "sense_id"],
            ["void_senses.organization_id", "void_senses.id"],
            name=op.f("void_sense_observations_organization_id_sense_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_sense_observations_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_sense_observations_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "version_id",
            "sense_id",
            "external_identity_id",
            "run_key",
            name=op.f(
                "void_sense_observations_organization_id_version_id_sense_id_external_identity_id_run_key_key"
            ),
        ),
    )
    op.create_index(
        op.f("ix_void_sense_observations_created_at"),
        "void_sense_observations",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_sense_observations_deleted_at"),
        "void_sense_observations",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_void_sense_observations_identity",
        "void_sense_observations",
        ["organization_id", "version_id", "external_identity_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_sense_observations_organization_id"),
        "void_sense_observations",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_void_sense_observations_root",
        "void_sense_observations",
        ["organization_id", "version_id", "external_root_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_sense_observations_sense_id"),
        "void_sense_observations",
        ["sense_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_sense_observations_version_id"),
        "void_sense_observations",
        ["version_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_void_sense_observations_version_id"),
        table_name="void_sense_observations",
    )
    op.drop_index(
        op.f("ix_void_sense_observations_sense_id"),
        table_name="void_sense_observations",
    )
    op.drop_index(
        "ix_void_sense_observations_root", table_name="void_sense_observations"
    )
    op.drop_index(
        op.f("ix_void_sense_observations_organization_id"),
        table_name="void_sense_observations",
    )
    op.drop_index(
        "ix_void_sense_observations_identity", table_name="void_sense_observations"
    )
    op.drop_index(
        op.f("ix_void_sense_observations_deleted_at"),
        table_name="void_sense_observations",
    )
    op.drop_index(
        op.f("ix_void_sense_observations_created_at"),
        table_name="void_sense_observations",
    )
    op.drop_table("void_sense_observations")
    op.drop_index(op.f("ix_void_senses_version_id"), table_name="void_senses")
    op.drop_index(op.f("ix_void_senses_organization_id"), table_name="void_senses")
    op.drop_index(op.f("ix_void_senses_deleted_at"), table_name="void_senses")
    op.drop_index(op.f("ix_void_senses_created_at"), table_name="void_senses")
    op.drop_index(op.f("ix_void_senses_activity_id"), table_name="void_senses")
    op.drop_table("void_senses")
