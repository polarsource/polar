"""drop dead columns from issue_rewards

Revision ID: a1e9c3b8d027
Revises: c7f2a91e4d38
Create Date: 2026-08-19 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1e9c3b8d027"
down_revision = "c7f2a91e4d38"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "issue_rewards_issue_reference_github_username_key",
        "issue_rewards",
        type_="unique",
    )
    op.drop_constraint(
        "issue_rewards_issue_reference_organization_id_key",
        "issue_rewards",
        type_="unique",
    )
    op.drop_constraint(
        "issue_rewards_issue_reference_user_id_key",
        "issue_rewards",
        type_="unique",
    )
    op.drop_index("ix_issue_rewards_organization_id", table_name="issue_rewards")
    op.drop_constraint(
        "issue_rewards_organization_id_fkey",
        "issue_rewards",
        type_="foreignkey",
    )
    op.drop_constraint(
        "issue_rewards_user_id_fkey",
        "issue_rewards",
        type_="foreignkey",
    )
    op.drop_column("issue_rewards", "organization_id")
    op.drop_column("issue_rewards", "github_username")
    op.drop_column("issue_rewards", "user_id")


def downgrade() -> None:
    op.add_column(
        "issue_rewards",
        sa.Column("user_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "issue_rewards",
        sa.Column("github_username", sa.String(), nullable=True),
    )
    op.add_column(
        "issue_rewards",
        sa.Column("organization_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "issue_rewards_user_id_fkey",
        "issue_rewards",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_foreign_key(
        "issue_rewards_organization_id_fkey",
        "issue_rewards",
        "organizations",
        ["organization_id"],
        ["id"],
    )
    op.create_index(
        "ix_issue_rewards_organization_id",
        "issue_rewards",
        ["organization_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "issue_rewards_issue_reference_user_id_key",
        "issue_rewards",
        ["issue_reference", "user_id"],
    )
    op.create_unique_constraint(
        "issue_rewards_issue_reference_organization_id_key",
        "issue_rewards",
        ["issue_reference", "organization_id"],
    )
    op.create_unique_constraint(
        "issue_rewards_issue_reference_github_username_key",
        "issue_rewards",
        ["issue_reference", "github_username"],
    )
