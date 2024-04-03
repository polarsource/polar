"""pledge.paid_as_pending

Revision ID: 8e016e17cb37
Revises: 720f07435609
Create Date: 2023-08-11 15:26:02.280764

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "8e016e17cb37"
down_revision = "720f07435609"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        "pledge_splits_issue_id_github_username_key", "issue_rewards", type_="unique"
    )
    op.drop_constraint(
        "pledge_splits_issue_id_organization_id_key", "issue_rewards", type_="unique"
    )
    op.drop_constraint(
        "pledge_splits_issue_id_user_id_key", "issue_rewards", type_="unique"
    )
    op.create_unique_constraint(
        op.f("issue_rewards_issue_id_github_username_key"),
        "issue_rewards",
        ["issue_id", "github_username"],
    )
    op.create_unique_constraint(
        op.f("issue_rewards_issue_id_organization_id_key"),
        "issue_rewards",
        ["issue_id", "organization_id"],
    )
    op.create_unique_constraint(
        op.f("issue_rewards_issue_id_user_id_key"),
        "issue_rewards",
        ["issue_id", "user_id"],
    )

    # paid state does no longer exist
    op.execute(
        """
               UPDATE pledges SET state = 'pending' WHERE state = 'paid'
               """
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        op.f("issue_rewards_issue_id_user_id_key"), "issue_rewards", type_="unique"
    )
    op.drop_constraint(
        op.f("issue_rewards_issue_id_organization_id_key"),
        "issue_rewards",
        type_="unique",
    )
    op.drop_constraint(
        op.f("issue_rewards_issue_id_github_username_key"),
        "issue_rewards",
        type_="unique",
    )
    op.create_unique_constraint(
        "pledge_splits_issue_id_user_id_key", "issue_rewards", ["issue_id", "user_id"]
    )
    op.create_unique_constraint(
        "pledge_splits_issue_id_organization_id_key",
        "issue_rewards",
        ["issue_id", "organization_id"],
    )
    op.create_unique_constraint(
        "pledge_splits_issue_id_github_username_key",
        "issue_rewards",
        ["issue_id", "github_username"],
    )
    # ### end Alembic commands ###
