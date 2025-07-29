"""add_organization_next_review_threshold_with_constraints

Revision ID: 393cb2f82868
Revises: 24bff4469bc0
Create Date: 2025-07-29 10:24:36.384373

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "393cb2f82868"
down_revision = "24bff4469bc0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add next_review_threshold column to organizations table
    op.add_column(
        "organizations",
        sa.Column("next_review_threshold", sa.Integer(), nullable=True),
    )

    # Copy existing next_review_threshold values from accounts to organizations
    op.execute("""
        UPDATE organizations
        SET next_review_threshold = accounts.next_review_threshold
        FROM accounts
        WHERE organizations.account_id = accounts.id
          AND accounts.next_review_threshold IS NOT NULL
    """)

    # Update any remaining NULL values to 0
    op.execute("""
        UPDATE organizations 
        SET next_review_threshold = 0 
        WHERE next_review_threshold IS NULL
    """)

    # Make the column non-nullable with default 0
    op.alter_column(
        "organizations",
        "next_review_threshold",
        existing_type=sa.Integer(),
        nullable=False,
        server_default="0",
    )

    # Add check constraint to ensure next_review_threshold is not negative
    op.create_check_constraint(
        "next_review_threshold_positive", "organizations", "next_review_threshold >= 0"
    )


def downgrade() -> None:
    # Remove the check constraint
    op.drop_constraint("next_review_threshold_positive", "organizations", type_="check")

    # Remove next_review_threshold column from organizations table
    op.drop_column("organizations", "next_review_threshold")
