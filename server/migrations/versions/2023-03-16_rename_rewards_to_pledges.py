"""rename rewards to pledges

Revision ID: 401fef781277
Revises: 7f5224936909
Create Date: 2023-03-16 11:36:45.601383

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "401fef781277"
down_revision = "7f5224936909"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def rename(from_: str, to: str) -> None:
    op.rename_table(from_, to)
    op.execute(f"ALTER INDEX {from_}_pkey RENAME TO {to}_pkey")
    op.execute(f"ALTER INDEX ix_{from_}_email RENAME TO ix_{to}_email")
    op.execute(f"ALTER INDEX ix_{from_}_payment_id RENAME TO ix_{to}_payment_id")


def upgrade() -> None:
    rename("rewards", "pledges")


def downgrade() -> None:
    rename("pledges", "rewards")
