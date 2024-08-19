"""license key activations

Revision ID: 09c91e1d4dec
Revises: 11e95720e068
Create Date: 2024-08-16 23:17:08.192900

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "09c91e1d4dec"
down_revision = "11e95720e068"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "license_key_activations",
        sa.Column("license_key_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["license_key_id"],
            ["license_keys.id"],
            name=op.f("license_key_activations_license_key_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("license_key_activations_pkey")),
    )
    op.create_index(
        op.f("ix_license_key_activations_created_at"),
        "license_key_activations",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_license_key_activations_deleted_at"),
        "license_key_activations",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_license_key_activations_license_key_id"),
        "license_key_activations",
        ["license_key_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_license_key_activations_modified_at"),
        "license_key_activations",
        ["modified_at"],
        unique=False,
    )
    op.add_column(
        "license_keys", sa.Column("limit_activations", sa.Integer(), nullable=True)
    )
    op.add_column(
        "license_keys", sa.Column("validations", sa.Integer(), nullable=False)
    )
    op.add_column(
        "license_keys",
        sa.Column("last_validated_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.drop_column("license_keys", "last_activated_at")
    op.drop_column("license_keys", "activation_limit")
    op.drop_column("license_keys", "activations")
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "license_keys",
        sa.Column("activations", sa.INTEGER(), autoincrement=False, nullable=False),
    )
    op.add_column(
        "license_keys",
        sa.Column("activation_limit", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "license_keys",
        sa.Column(
            "last_activated_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.drop_column("license_keys", "last_validated_at")
    op.drop_column("license_keys", "validations")
    op.drop_column("license_keys", "limit_activations")
    op.drop_index(
        op.f("ix_license_key_activations_modified_at"),
        table_name="license_key_activations",
    )
    op.drop_index(
        op.f("ix_license_key_activations_license_key_id"),
        table_name="license_key_activations",
    )
    op.drop_index(
        op.f("ix_license_key_activations_deleted_at"),
        table_name="license_key_activations",
    )
    op.drop_index(
        op.f("ix_license_key_activations_created_at"),
        table_name="license_key_activations",
    )
    op.drop_table("license_key_activations")
    # ### end Alembic commands ###
