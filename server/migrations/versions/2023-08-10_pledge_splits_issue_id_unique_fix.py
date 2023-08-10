"""pledge_splits.issue_id_unique_fix

Revision ID: 449476826250
Revises: a50e52aea4ec
Create Date: 2023-08-10 15:44:15.226430

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = '449476826250'
down_revision = 'a50e52aea4ec'
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint('pledge_splits_issue_id_key', 'pledge_splits', type_='unique')
    op.create_unique_constraint(op.f('pledge_splits_issue_id_github_username_key'), 'pledge_splits', ['issue_id', 'github_username'])
    op.create_unique_constraint(op.f('pledge_splits_issue_id_organization_id_key'), 'pledge_splits', ['issue_id', 'organization_id'])
    op.create_unique_constraint(op.f('pledge_splits_issue_id_user_id_key'), 'pledge_splits', ['issue_id', 'user_id'])
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(op.f('pledge_splits_issue_id_user_id_key'), 'pledge_splits', type_='unique')
    op.drop_constraint(op.f('pledge_splits_issue_id_organization_id_key'), 'pledge_splits', type_='unique')
    op.drop_constraint(op.f('pledge_splits_issue_id_github_username_key'), 'pledge_splits', type_='unique')
    op.create_unique_constraint('pledge_splits_issue_id_key', 'pledge_splits', ['issue_id'])
    # ### end Alembic commands ###
