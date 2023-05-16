"""issue polling columns

Revision ID: efb661a66bb4
Revises: f39358a2df88
Create Date: 2023-05-16 15:09:38.654051

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = 'efb661a66bb4'
down_revision = 'f39358a2df88'
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column('issues', sa.Column('github_issue_etag', sa.String(), nullable=True))
    op.alter_column('issues', 'github_timeline_fetched_at', new_column_name='github_issue_fetched_at')


def downgrade() -> None:
    op.alter_column('issues', 'github_issue_fetched_at', new_column_name='github_timeline_fetched_at')
    op.drop_column('issues', 'github_issue_etag')
