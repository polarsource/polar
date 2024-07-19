"""Remove UserOrganization.is_admin

Revision ID: b0c7409f8489
Revises: 4fb5c2b88e8c
Create Date: 2024-07-18 14:51:27.659531

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "b0c7409f8489"
down_revision = "4fb5c2b88e8c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.execute(
        """
        DELETE FROM user_organizations
        WHERE is_admin IS FALSE;
        """
    )

    op.drop_column("user_organizations", "is_admin")
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "user_organizations",
        sa.Column("is_admin", sa.BOOLEAN(), autoincrement=False, nullable=True),
    )

    op.execute(
        """
        UPDATE user_organizations
        SET is_admin = TRUE;
        """
    )

    op.alter_column(
        "user_organizations",
        "is_admin",
        existing_type=sa.BOOLEAN(),
        nullable=False,
    )

    # ### end Alembic commands ###
