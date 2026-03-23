"""Stamp version=1 on existing organization_agent_reviews.report JSONB

Revision ID: a7f3e1c20b94
Revises: 1f3638dfb58f
Create Date: 2026-02-26 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a7f3e1c20b94"
down_revision = "1f3638dfb58f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Stamp all existing rows that don't already have a version key.
    # Uses jsonb_set to add {"version": 1} to the report column.
    op.execute(
        sa.text("""
            UPDATE organization_agent_reviews
            SET report = jsonb_set(report, '{version}', '1'::jsonb)
            WHERE NOT (report ? 'version')
        """)
    )


def downgrade() -> None:
    # Remove the version key from all reports that have version=1.
    op.execute(
        sa.text("""
            UPDATE organization_agent_reviews
            SET report = report - 'version'
            WHERE report->>'version' = '1'
        """)
    )
