"""add due_at to organization_review_agent_runs

Slice 5 foundation: SLA contract on AWAITING_HUMAN runs parked at
AwaitMerchantNode. The cron-driven SLA scanner reads this column to
fire ``auto_deny`` / ``auto_close_approve`` / ``escalate`` actions
when ``due_at`` passes without a merchant reply landing.

Revision ID: d4e6f7a8b9c0
Revises: c3d5e6f7a8b9
Create Date: 2026-05-23 19:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d4e6f7a8b9c0"
down_revision = "c3d5e6f7a8b9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organization_review_agent_runs",
        sa.Column(
            "due_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "organization_review_agent_runs",
        sa.Column(
            "on_timeout",
            sa.String(length=32),
            nullable=True,
        ),
    )
    op.create_index(
        op.f("ix_organization_review_agent_runs_due_at"),
        "organization_review_agent_runs",
        ["due_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_organization_review_agent_runs_due_at"),
        table_name="organization_review_agent_runs",
    )
    op.drop_column(
        "organization_review_agent_runs", "on_timeout"
    )
    op.drop_column(
        "organization_review_agent_runs", "due_at"
    )
