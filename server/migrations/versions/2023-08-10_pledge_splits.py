"""pledge_splits

Revision ID: 832d6aef46d6
Revises: bba60300e351
Create Date: 2023-08-10 13:40:25.137042

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "832d6aef46d6"
down_revision = "bba60300e351"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "pledge_splits",
        sa.Column("issue_id", sa.UUID(), nullable=False),
        sa.Column("share", sa.BigInteger(), nullable=False),
        sa.Column("github_username", sa.String(), nullable=True),
        sa.Column("organization_id", sa.UUID(), nullable=True),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["issue_id"], ["issues.id"], name=op.f("pledge_splits_issue_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("pledge_splits_organization_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("pledge_splits_user_id_fkey")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pledge_splits_pkey")),
    )
    op.add_column(
        "issues",
        sa.Column("confirmed_solved_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column("issues", sa.Column("confirmed_solved_by", sa.UUID(), nullable=True))
    op.create_foreign_key(
        op.f("issues_confirmed_solved_by_fkey"),
        "issues",
        "users",
        ["confirmed_solved_by"],
        ["id"],
    )
    op.add_column(
        "pledge_transactions", sa.Column("pledge_split_id", sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        op.f("pledge_transactions_pledge_split_id_fkey"),
        "pledge_transactions",
        "pledge_splits",
        ["pledge_split_id"],
        ["id"],
    )

    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        op.f("pledge_transactions_pledge_split_id_fkey"),
        "pledge_transactions",
        type_="foreignkey",
    )
    op.drop_column("pledge_transactions", "pledge_split_id")
    op.drop_constraint(
        op.f("issues_confirmed_solved_by_fkey"), "issues", type_="foreignkey"
    )
    op.drop_column("issues", "confirmed_solved_by")
    op.drop_column("issues", "confirmed_solved_at")
    op.drop_table("pledge_splits")
    # ### end Alembic commands ###
