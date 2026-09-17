"""replace void senses with judgments

Revision ID: b27d5e91c4a3
Revises: a91c3f4e8b17
Create Date: 2026-09-17 18:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b27d5e91c4a3"
down_revision = "a91c3f4e8b17"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_table("void_sense_observations")
    op.drop_table("void_senses")
    op.create_table(
        "void_judgments",
        sa.Column("version_id", sa.String(), nullable=False),
        sa.Column("external_identity_id", sa.String(), nullable=False),
        sa.Column("meter_slug", sa.String(), nullable=False),
        sa.Column("question_hash", sa.String(), nullable=False),
        sa.Column("state_hash", sa.String(), nullable=False),
        sa.Column("noul", sa.Float(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column(
            "evidence", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("asked_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("judged_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_judgments_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_judgments_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "version_id",
            "external_identity_id",
            "meter_slug",
            "question_hash",
            name=op.f(
                "void_judgments_organization_id_version_id_external_identity_id_meter_slug_question_hash_key"
            ),
        ),
    )
    op.create_index(
        op.f("ix_void_judgments_organization_id"),
        "void_judgments",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_judgments_version_id"),
        "void_judgments",
        ["version_id"],
        unique=False,
    )
    op.create_index(
        "ix_void_events_identity_timestamp",
        "void_events",
        [
            "organization_id",
            sa.literal_column("(payload ->> 'external_identity_id')"),
            "timestamp",
        ],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_void_events_identity_timestamp", table_name="void_events")
    op.drop_index(op.f("ix_void_judgments_version_id"), table_name="void_judgments")
    op.drop_index(
        op.f("ix_void_judgments_organization_id"), table_name="void_judgments"
    )
    op.drop_table("void_judgments")
