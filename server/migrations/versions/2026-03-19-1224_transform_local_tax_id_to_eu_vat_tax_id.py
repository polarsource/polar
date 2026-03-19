"""Transform local tax_id to EU VAT tax_id

Revision ID: 225269fa2493
Revises: 18f60c8e06f0
Create Date: 2026-03-19 12:24:10.924969

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "225269fa2493"
down_revision = "18f60c8e06f0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    for country, removed_format in (
        ("BG", "bg_uic"),
        ("DE", "de_stn"),
        ("ES", "es_cif"),
        ("HR", "hr_oib"),
        ("HU", "hu_tin"),
        ("RO", "ro_tin"),
        ("SI", "si_tin"),
    ):
        op.execute(
            sa.text(
                """
                UPDATE customers
                SET tax_id = to_jsonb(
                    json_build_array(
                        :country || ((tax_id#>>'{}')::jsonb->>0),
                        :eu_vat_format
                    )::text
                )
                WHERE tax_id != 'null'
                AND (tax_id#>>'{}')::jsonb->>1 = :removed_format
                """
            ).bindparams(
                eu_vat_format="eu_vat",
                removed_format=removed_format,
                country=country,
            )
        )


def downgrade() -> None:
    pass
