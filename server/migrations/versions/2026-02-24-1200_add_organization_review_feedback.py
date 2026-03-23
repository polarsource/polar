"""Add organization_review_feedback table

Revision ID: d91eff4975e1
Revises: 138febbc19df
Create Date: 2026-02-24 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d91eff4975e1"
down_revision = "138febbc19df"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_review_feedback",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("agent_review_id", sa.Uuid(), nullable=False),
        sa.Column("reviewer_id", sa.Uuid(), nullable=False),
        sa.Column("ai_verdict", sa.String(), nullable=False),
        sa.Column("human_verdict", sa.String(), nullable=False),
        sa.Column("agreement", sa.String(), nullable=False),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["agent_review_id"],
            ["organization_agent_reviews.id"],
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"],
            ["users.id"],
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_organization_review_feedback_created_at"),
        "organization_review_feedback",
        ["created_at"],
    )
    op.create_index(
        op.f("ix_organization_review_feedback_deleted_at"),
        "organization_review_feedback",
        ["deleted_at"],
    )
    op.create_index(
        op.f("ix_organization_review_feedback_agent_review_id"),
        "organization_review_feedback",
        ["agent_review_id"],
    )
    op.create_index(
        op.f("ix_organization_review_feedback_reviewer_id"),
        "organization_review_feedback",
        ["reviewer_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_organization_review_feedback_reviewer_id"),
        table_name="organization_review_feedback",
    )
    op.drop_index(
        op.f("ix_organization_review_feedback_agent_review_id"),
        table_name="organization_review_feedback",
    )
    op.drop_index(
        op.f("ix_organization_review_feedback_deleted_at"),
        table_name="organization_review_feedback",
    )
    op.drop_index(
        op.f("ix_organization_review_feedback_created_at"),
        table_name="organization_review_feedback",
    )
    op.drop_table("organization_review_feedback")
