"""create issue dependency table

Revision ID: 24d4f9b61d5f
Revises: 85dd30fc27fa
Create Date: 2023-03-29 15:38:09.277599

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "24d4f9b61d5f"
down_revision = "f8589f130a0f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "issue_dependencies",
        sa.Column("dependent_issue_id", sa.UUID(), nullable=False),
        sa.Column("dependency_issue_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["dependency_issue_id"],
            ["issues.id"],
            name=op.f("issue_dependencies_dependency_issue_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["dependent_issue_id"],
            ["issues.id"],
            name=op.f("issue_dependencies_dependent_issue_id_fkey"),
        ),
        sa.PrimaryKeyConstraint(
            "dependent_issue_id",
            "dependency_issue_id",
            name=op.f("issue_dependencies_pkey"),
        ),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("issue_dependencies")
    # ### end Alembic commands ###
