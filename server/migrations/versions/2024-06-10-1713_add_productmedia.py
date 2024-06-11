"""Add ProductMedia

Revision ID: 5a92c17b033d
Revises: 26ccc98e38f1
Create Date: 2024-06-10 17:13:38.850974

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "5a92c17b033d"
down_revision = "26ccc98e38f1"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "product_medias",
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("file_id", sa.UUID(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["files.id"],
            name=op.f("product_medias_file_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name=op.f("product_medias_product_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint(
            "product_id", "file_id", "id", name=op.f("product_medias_pkey")
        ),
        sa.UniqueConstraint(
            "product_id", "order", name=op.f("product_medias_product_id_order_key")
        ),
    )
    op.create_index(
        op.f("ix_product_medias_created_at"),
        "product_medias",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_medias_deleted_at"),
        "product_medias",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_medias_modified_at"),
        "product_medias",
        ["modified_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_medias_order"), "product_medias", ["order"], unique=False
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f("ix_product_medias_order"), table_name="product_medias")
    op.drop_index(op.f("ix_product_medias_modified_at"), table_name="product_medias")
    op.drop_index(op.f("ix_product_medias_deleted_at"), table_name="product_medias")
    op.drop_index(op.f("ix_product_medias_created_at"), table_name="product_medias")
    op.drop_table("product_medias")
    # ### end Alembic commands ###
