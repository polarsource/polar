"""add accepted_tos_at and ip to users

Revision ID: 8a3f1b2c4d5e
Revises: a6ed3955abe9
Create Date: 2026-03-25 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8a3f1b2c4d5e"
down_revision = "a6ed3955abe9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "accepted_terms_of_service_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "accepted_terms_of_service_ip",
            sa.String(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "accepted_terms_of_service_ip")
    op.drop_column("users", "accepted_terms_of_service_at")
