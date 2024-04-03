"""Add selectable and deletable to SubscriptionBenefit

Revision ID: 263c2d960ed4
Revises: 9df4f42400cd
Create Date: 2023-12-07 09:25:59.798368

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "263c2d960ed4"
down_revision = "9df4f42400cd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "subscription_benefits", sa.Column("selectable", sa.Boolean(), nullable=True)
    )
    op.add_column(
        "subscription_benefits", sa.Column("deletable", sa.Boolean(), nullable=True)
    )

    op.execute("UPDATE subscription_benefits SET selectable = TRUE, deletable = TRUE;")

    op.alter_column(
        "subscription_benefits",
        "selectable",
        nullable=False,
        existing_nullable=True,
        type=sa.Boolean,
    )

    op.alter_column(
        "subscription_benefits",
        "deletable",
        nullable=False,
        existing_nullable=True,
        type=sa.Boolean,
    )

    op.execute(
        """
        UPDATE subscription_benefits
        SET selectable = FALSE, deletable = FALSE
        WHERE type = 'articles' AND CAST (properties ->> 'paid_articles' AS BOOLEAN) IS FALSE;
    """
    )

    op.execute(
        """
        UPDATE subscription_benefits
        SET selectable = TRUE, deletable = FALSE
        WHERE type = 'articles' AND CAST (properties ->> 'paid_articles' AS BOOLEAN) IS TRUE;
    """
    )

    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("subscription_benefits", "deletable")
    op.drop_column("subscription_benefits", "selectable")
    # ### end Alembic commands ###
