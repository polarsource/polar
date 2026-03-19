"""fix_tax_id_double_serialization

Revision ID: 5dd64c82a092
Revises: 225269fa2493
Create Date: 2026-03-19 14:14:39.606268

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5dd64c82a092"
down_revision = "225269fa2493"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Fix JSON null → SQL NULL for tax_id columns
    # op.execute(
    #     """
    #     UPDATE customers
    #     SET tax_id = NULL
    #     WHERE tax_id = 'null'::jsonb
    #     """
    # )
    # op.execute(
    #     """
    #     UPDATE orders
    #     SET tax_id = NULL
    #     WHERE tax_id = 'null'::jsonb
    #     """
    # )
    # op.execute(
    #     """
    #     UPDATE checkouts
    #     SET customer_tax_id = NULL
    #     WHERE customer_tax_id = 'null'::jsonb
    #     """
    # )

    # Fix double-serialized tax_id values.
    # Double-serialized values are stored as a JSON string containing escaped JSON,
    # e.g. '"[\"XXX\", \"es_cif\"]"' (jsonb_typeof = 'string').
    # Correct values are stored as a JSON array,
    # e.g. '["XXX", "es_cif"]' (jsonb_typeof = 'array').
    # We unwrap one level of JSON string encoding using #>>'{}' to get the raw
    # text, then cast back to jsonb.
    op.execute(
        """
        UPDATE customers
        SET tax_id = (tax_id #>> '{}')::jsonb
        WHERE tax_id IS NOT NULL
        AND jsonb_typeof(tax_id) = 'string'
        """
    )
    op.execute(
        """
        UPDATE orders
        SET tax_id = (tax_id #>> '{}')::jsonb
        WHERE tax_id IS NOT NULL
        AND jsonb_typeof(tax_id) = 'string'
        """
    )
    op.execute(
        """
        UPDATE checkouts
        SET customer_tax_id = (customer_tax_id #>> '{}')::jsonb
        WHERE customer_tax_id IS NOT NULL
        AND jsonb_typeof(customer_tax_id) = 'string'
        """
    )


def downgrade() -> None:
    # Re-double-serialize: wrap the JSON array back into a JSON string
    op.execute(
        """
        UPDATE customers
        SET tax_id = to_jsonb(tax_id::text)
        WHERE tax_id IS NOT NULL
        AND jsonb_typeof(tax_id) = 'array'
        """
    )
    op.execute(
        """
        UPDATE orders
        SET tax_id = to_jsonb(tax_id::text)
        WHERE tax_id IS NOT NULL
        AND jsonb_typeof(tax_id) = 'array'
        """
    )
    op.execute(
        """
        UPDATE checkouts
        SET customer_tax_id = to_jsonb(customer_tax_id::text)
        WHERE customer_tax_id IS NOT NULL
        AND jsonb_typeof(customer_tax_id) = 'array'
        """
    )
