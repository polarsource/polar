"""Add organization details

Revision ID: 9be29fe8ca0f
Revises: cb77e86b9e13
Create Date: 2025-02-26 09:51:44.509902

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9be29fe8ca0f"
down_revision = "68717eb3943c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def migrate_organizations() -> None:
    # Historic activations have provided business details via support email
    # so set them as submitted despite `details` being empty
    # to avoid creating a hard submission requirement for all active
    # organizations.
    op.execute(
        """
        WITH active_organizations AS (
            SELECT
                organizations.id,
                accounts.modified_at AS submitted_at
            FROM accounts
            JOIN organizations ON organizations.account_id = accounts.id
            WHERE 1 = 1
                AND accounts.status = 'active'
                -- Just activate organizations with proper, historic, reviews
                AND accounts.next_review_threshold != 0
        )
        UPDATE organizations
        SET
            details_submitted_at = active_organizations.submitted_at
        FROM active_organizations
        WHERE 1 = 1
            AND organizations.id = active_organizations.id
        """
    )


def upgrade() -> None:
    op.add_column("organizations", sa.Column("website", sa.String(), nullable=True))
    op.add_column(
        "organizations",
        sa.Column(
            "socials",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "organizations",
        sa.Column(
            "details",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )
    op.add_column(
        "organizations",
        sa.Column(
            "details_submitted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    migrate_organizations()


def downgrade() -> None:
    op.drop_column("organizations", "details")
    op.drop_column("organizations", "details_submitted_at")
    op.drop_column("organizations", "socials")
    op.drop_column("organizations", "website")
