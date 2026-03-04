"""make checkout_settings non-nullable

Revision ID: 22e0e20d2455
Revises: fbd10f23c6e9
Create Date: 2026-03-04 09:31:50.831469

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "22e0e20d2455"
down_revision = "fbd10f23c6e9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE organizations SET checkout_settings = jsonb_build_object(
         'require_3ds', false
        ) WHERE checkout_settings IS NULL
        """
    )

    op.alter_column(
        "organizations",
        "checkout_settings",
        existing_type=sa.dialects.postgresql.JSONB(astext_type=sa.Text()),
        nullable=False,
        server_default="{}",
    )


def downgrade() -> None:
    op.alter_column(
        "organizations",
        "checkout_settings",
        existing_type=sa.dialects.postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
        server_default=None,
    )
