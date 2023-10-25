"""external_issue_reference

Revision ID: 9630755cf256
Revises: dc19b85fe8a6
Create Date: 2023-03-22 09:27:10.135938

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "9630755cf256"
down_revision = "dc19b85fe8a6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # This is the easy way out...
    op.execute("TRUNCATE TABLE issue_references")

    op.drop_constraint("issue_references_pkey", "issue_references")

    op.add_column(
        "issue_references",
        sa.Column(
            "reference_type",
            sa.String,
            nullable=False,
        ),
    )

    op.add_column(
        "issue_references", sa.Column("external_id", sa.String(), nullable=False)
    )
    op.add_column(
        "issue_references",
        sa.Column(
            "external_source", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )
    op.alter_column(
        "issue_references", "pull_request_id", existing_type=sa.UUID(), nullable=True
    )

    op.create_primary_key(
        "issue_references_pkey",
        "issue_references",
        ["issue_id", "reference_type", "external_id"],
    )


def downgrade() -> None:
    op.execute("TRUNCATE TABLE issue_references")
    op.drop_constraint("issue_references_pkey", "issue_references")

    op.alter_column(
        "issue_references", "pull_request_id", existing_type=sa.UUID(), nullable=False
    )
    op.drop_column("issue_references", "external_source")
    op.drop_column("issue_references", "external_id")
    op.drop_column("issue_references", "reference_type")

    op.create_primary_key(
        "issue_references_pkey",
        "issue_references",
        ["issue_id", "pull_request_id"],
    )
