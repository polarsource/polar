"""Drop event sequences

Revision ID: f9772ac1ba20
Revises: da18c34b0e6f
Create Date: 2026-10-08 16:24:39.249342

"""

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f9772ac1ba20"
down_revision = "da18c34b0e6f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Applied only on test; 801ce082b125 restores what it dropped there.
    pass


def downgrade() -> None:
    pass
