"""add_global_invoice_sequence

Revision ID: 1c01dfc86203
Revises: 902dd5c6c2b7
Create Date: 2025-10-21 15:18:00.469806

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "1c01dfc86203"
down_revision = "902dd5c6c2b7"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Buffer to add to max existing invoice number
    # This ensures clean separation between old per-org and new global numbering
    BUFFER_SIZE = 10000

    # Create the global invoice number sequence
    op.execute("CREATE SEQUENCE invoice_number_seq START WITH 1")

    # Initialize sequence to max existing invoice number + buffer
    # Extract numeric part from "PREFIX-0001" format and find the maximum
    op.execute(
        f"""
        SELECT setval('invoice_number_seq',
            COALESCE(
                (SELECT MAX(CAST(SPLIT_PART(invoice_number, '-', 2) AS INTEGER))
                 FROM orders),
                0
            ) + {BUFFER_SIZE}
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP SEQUENCE IF EXISTS invoice_number_seq")
