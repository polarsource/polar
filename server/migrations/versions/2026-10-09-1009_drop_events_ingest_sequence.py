"""Drop events ingest_sequence

Revision ID: a940ca6a157a
Revises: 801ce082b125
Create Date: 2026-10-09 10:09:59.352362

"""

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a940ca6a157a"
down_revision = "801ce082b125"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # The column is dropped by hand; include_object in env.py ignores it meanwhile.
    pass


def downgrade() -> None:
    pass
