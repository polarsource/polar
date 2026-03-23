"""Contract organization_review_feedback: drop legacy columns

Revision ID: a7b3c9d2e1f0
Revises: 9807b1404905
Create Date: 2026-02-27 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a7b3c9d2e1f0"
down_revision = "9807b1404905"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Drop legacy columns that have been replaced by new ones:
    #   ai_verdict    -> verdict
    #   human_verdict -> decision (when actor_type='human')
    #   agreement     -> derivable from verdict + decision
    #   override_reason -> reason
    #   reviewed_at   -> created_at (from RecordModel base)
    op.drop_column("organization_review_feedback", "ai_verdict")
    op.drop_column("organization_review_feedback", "human_verdict")
    op.drop_column("organization_review_feedback", "agreement")
    op.drop_column("organization_review_feedback", "override_reason")
    op.drop_column("organization_review_feedback", "reviewed_at")


def downgrade() -> None:
    # Re-add legacy columns as nullable (they were made nullable in the expand phase)
    op.add_column(
        "organization_review_feedback",
        sa.Column("reviewed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("override_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("agreement", sa.String(), nullable=True),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("human_verdict", sa.String(), nullable=True),
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("ai_verdict", sa.String(), nullable=True),
    )

    # Backfill legacy columns from new columns
    op.execute(
        sa.text("""
            UPDATE organization_review_feedback
            SET
                ai_verdict = verdict,
                human_verdict = CASE WHEN actor_type = 'human' THEN decision ELSE NULL END,
                override_reason = reason,
                reviewed_at = created_at
        """)
    )
