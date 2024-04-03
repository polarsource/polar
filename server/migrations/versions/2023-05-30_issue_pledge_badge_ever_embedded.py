"""issue.pledge_badge_ever_embedded

Revision ID: a26480d30322
Revises: b7500de3b0d3
Create Date: 2023-05-30 10:02:47.752802

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a26480d30322"
down_revision = "b7500de3b0d3"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "issues", sa.Column("pledge_badge_ever_embedded", sa.Boolean(), nullable=True)
    )
    op.add_column(
        "issues",
        sa.Column("pledge_badge_currently_embedded", sa.Boolean(), nullable=True),
    )

    op.execute(
        "UPDATE issues SET pledge_badge_currently_embedded='t' WHERE body LIKE '%POLAR PLEDGE BADGE%'"  # noqa: E501
    )
    op.execute(
        "UPDATE issues SET pledge_badge_currently_embedded='f' WHERE pledge_badge_currently_embedded IS NULL"  # noqa: E501
    )
    op.execute(
        "UPDATE issues SET pledge_badge_ever_embedded='t' WHERE pledge_badge_embedded_at IS NOT NULL"  # noqa: E501
    )
    op.execute(
        "UPDATE issues SET pledge_badge_ever_embedded='f' WHERE pledge_badge_ever_embedded IS NULL"  # noqa: E501
    )

    op.alter_column("issues", "pledge_badge_ever_embedded", nullable=False)
    op.alter_column("issues", "pledge_badge_currently_embedded", nullable=False)


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("issues", "pledge_badge_currently_embedded")
    op.drop_column("issues", "pledge_badge_ever_embedded")
    # ### end Alembic commands ###
