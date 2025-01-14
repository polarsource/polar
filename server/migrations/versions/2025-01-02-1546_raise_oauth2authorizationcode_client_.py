"""Raise OAuth2AuthorizationCode.client length limit

Revision ID: 7cb32fb2fc26
Revises: d23cb1d45208
Create Date: 2025-01-02 15:46:42.303482

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7cb32fb2fc26"
down_revision = "d23cb1d45208"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "oauth2_authorization_codes",
        "client_id",
        existing_type=sa.VARCHAR(length=48),
        type_=sa.String(length=52),
        nullable=False,
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "oauth2_authorization_codes",
        "client_id",
        existing_type=sa.String(length=52),
        type_=sa.VARCHAR(length=48),
        nullable=True,
    )
    # ### end Alembic commands ###
