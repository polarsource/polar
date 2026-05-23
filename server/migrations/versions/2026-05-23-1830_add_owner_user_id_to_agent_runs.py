"""add owner_user_id to organization_review_agent_runs

Slice 3 foundation: per-run ownership for the operator inbox. NULLable
so existing rows + the shadow path stay un-owned by default. Slice 3
part 2 auto-assigns on AWAITING_HUMAN entry via round-robin within a
per-context reviewer pool.

Revision ID: c3d5e6f7a8b9
Revises: b2e4f5d6c789
Create Date: 2026-05-23 18:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c3d5e6f7a8b9"
down_revision = "b2e4f5d6c789"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organization_review_agent_runs",
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        op.f(
            "organization_review_agent_runs_owner_user_id_fkey"
        ),
        "organization_review_agent_runs",
        "users",
        ["owner_user_id"],
        ["id"],
        ondelete="set null",
    )
    op.create_index(
        op.f("ix_organization_review_agent_runs_owner_user_id"),
        "organization_review_agent_runs",
        ["owner_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_organization_review_agent_runs_owner_user_id"),
        table_name="organization_review_agent_runs",
    )
    op.drop_constraint(
        op.f("organization_review_agent_runs_owner_user_id_fkey"),
        "organization_review_agent_runs",
        type_="foreignkey",
    )
    op.drop_column(
        "organization_review_agent_runs", "owner_user_id"
    )
