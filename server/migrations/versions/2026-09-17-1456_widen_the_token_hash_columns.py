"""widen the token hash columns

Revision ID: bb1bfb443e9c
Revises: d38387d01757
Create Date: 2026-09-17 14:56:45.314787

This revision was applied on some environments, then the file was deleted
by the emergency revert in #14604. The original DDL is omitted: later
migrations added *_v2 columns instead of widening in place. Keep the
revision id so databases still stamped at bb1bfb443e9c can migrate forward.
"""

# revision identifiers, used by Alembic.
revision = "bb1bfb443e9c"
down_revision = "d38387d01757"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
