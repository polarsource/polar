"""issue_plus_one_idx_fix

Revision ID: 5df98006e026
Revises: 1170fc9f1510
Create Date: 2023-05-02 15:39:17.796400

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "5df98006e026"
down_revision = "1170fc9f1510"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index("idx_issues_reactions_plus_one", table_name="issues")
    op.create_index(
        "idx_issues_reactions_plus_one",
        "issues",
        [sa.text("((reactions::jsonb ->> 'plus_one')::int)")],
        unique=False,
        postgresql_using="btree",
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(
        "idx_issues_reactions_plus_one", table_name="issues", postgresql_using="btree"
    )
    op.create_index(
        "idx_issues_reactions_plus_one",
        "issues",
        [sa.text("(reactions -> 'plus_one'::text)")],
        unique=False,
    )
    # ### end Alembic commands ###
