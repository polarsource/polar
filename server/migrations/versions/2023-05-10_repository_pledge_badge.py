"""repository pledge badge

Revision ID: 5c26cad1bf3b
Revises: 77467f8f6202
Create Date: 2023-05-10 14:19:14.575872

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5c26cad1bf3b"
down_revision = "77467f8f6202"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_column("organizations", "pledge_badge_retroactive")
    op.add_column(
        "repositories",
        sa.Column(
            "pledge_badge",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # Even though default is false, we've operated as if it was true up until now
    op.execute("UPDATE repositories SET pledge_badge = true")


def downgrade() -> None:
    op.drop_column("repositories", "pledge_badge")
    op.add_column(
        "organizations",
        sa.Column(
            "pledge_badge_retroactive",
            sa.BOOLEAN(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
