"""Expand organization_review_feedback with decision tracking columns

Revision ID: 908c6d81bb3f
Revises: d91eff4975e1
Create Date: 2026-02-25 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "908c6d81bb3f"
down_revision = "d91eff4975e1"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # --- Add new columns (all nullable) ---
    op.add_column(
        "organization_review_feedback",
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="cascade"),
            nullable=True,
        ),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("actor_type", sa.String(), nullable=True),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("decision", sa.String(), nullable=True),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("verdict", sa.String(), nullable=True),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("risk_score", sa.Float(), nullable=True),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("review_context", sa.String(), nullable=True),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("is_current", sa.Boolean(), server_default="false", nullable=True),
    )

    # --- Make existing columns nullable (needed for agent decisions) ---
    op.alter_column(
        "organization_review_feedback",
        "agent_review_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )
    op.alter_column(
        "organization_review_feedback",
        "reviewer_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )
    op.alter_column(
        "organization_review_feedback",
        "ai_verdict",
        existing_type=sa.String(),
        nullable=True,
    )
    op.alter_column(
        "organization_review_feedback",
        "human_verdict",
        existing_type=sa.String(),
        nullable=True,
    )
    op.alter_column(
        "organization_review_feedback",
        "agreement",
        existing_type=sa.String(),
        nullable=True,
    )
    op.alter_column(
        "organization_review_feedback",
        "reviewed_at",
        existing_type=sa.TIMESTAMP(timezone=True),
        nullable=True,
    )

    # --- Add indexes ---
    op.create_index(
        op.f("ix_organization_review_feedback_organization_id"),
        "organization_review_feedback",
        ["organization_id"],
    )

    # Partial unique index: only one is_current=true per org (among non-deleted rows)
    op.create_index(
        "organization_review_feedback_one_current_per_org",
        "organization_review_feedback",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("is_current = true AND deleted_at IS NULL"),
    )

    # --- Backfill existing rows ---
    # Set new columns from existing data by joining agent_reviews to get organization_id
    op.execute(
        sa.text("""
            UPDATE organization_review_feedback AS f
            SET
                organization_id = oar.organization_id,
                actor_type = 'human',
                decision = f.human_verdict,
                verdict = f.ai_verdict,
                reason = f.override_reason,
                review_context = 'manual'
            FROM organization_agent_reviews AS oar
            WHERE oar.id = f.agent_review_id
              AND f.organization_id IS NULL
        """)
    )

    # Set is_current=true for the most recent row per organization
    op.execute(
        sa.text("""
            UPDATE organization_review_feedback AS f
            SET is_current = true
            FROM (
                SELECT DISTINCT ON (f2.organization_id) f2.id
                FROM organization_review_feedback f2
                WHERE f2.organization_id IS NOT NULL
                  AND f2.deleted_at IS NULL
                ORDER BY f2.organization_id, f2.created_at DESC
            ) AS latest
            WHERE f.id = latest.id
        """)
    )


def downgrade() -> None:
    # Drop partial unique index
    op.drop_index(
        "organization_review_feedback_one_current_per_org",
        table_name="organization_review_feedback",
    )

    # Drop organization_id index
    op.drop_index(
        op.f("ix_organization_review_feedback_organization_id"),
        table_name="organization_review_feedback",
    )

    # Restore NOT NULL on existing columns
    op.alter_column(
        "organization_review_feedback",
        "reviewed_at",
        existing_type=sa.TIMESTAMP(timezone=True),
        nullable=False,
    )
    op.alter_column(
        "organization_review_feedback",
        "agreement",
        existing_type=sa.String(),
        nullable=False,
    )
    op.alter_column(
        "organization_review_feedback",
        "human_verdict",
        existing_type=sa.String(),
        nullable=False,
    )
    op.alter_column(
        "organization_review_feedback",
        "ai_verdict",
        existing_type=sa.String(),
        nullable=False,
    )
    op.alter_column(
        "organization_review_feedback",
        "reviewer_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )
    op.alter_column(
        "organization_review_feedback",
        "agent_review_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )

    # Drop new columns
    op.drop_column("organization_review_feedback", "is_current")
    op.drop_column("organization_review_feedback", "reason")
    op.drop_column("organization_review_feedback", "review_context")
    op.drop_column("organization_review_feedback", "risk_score")
    op.drop_column("organization_review_feedback", "verdict")
    op.drop_column("organization_review_feedback", "decision")
    op.drop_column("organization_review_feedback", "actor_type")
    op.drop_column("organization_review_feedback", "organization_id")
