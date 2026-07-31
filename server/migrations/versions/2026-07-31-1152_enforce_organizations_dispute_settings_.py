"""enforce organizations dispute_settings not null

Revision ID: 5a95b59f156b
Revises: 98f971463e5d
Create Date: 2026-07-31 11:52:34.032752

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5a95b59f156b"
down_revision = "98f971463e5d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    # `organizations` is a busy table: allow longer to acquire the lock.
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.execute(
        """
        UPDATE organizations
        SET dispute_settings = '{"auto_accept_below_amount": null, "auto_accept_currency": null}'
        WHERE dispute_settings IS NULL
        """
    )
    op.alter_column(
        "organizations",
        "dispute_settings",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=False,
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    # `organizations` is a busy table: allow longer to acquire the lock.
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.alter_column(
        "organizations",
        "dispute_settings",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
    )
