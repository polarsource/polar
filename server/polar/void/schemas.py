from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import Field, PlainSerializer

from polar.kit.schemas import IDSchema

PlainDecimal = Annotated[
    Decimal, PlainSerializer(lambda v: format(v, "f"), return_type=str)
]
"""A decimal that never serializes in scientific notation.

Twelve-scale amounts read from Postgres come back as `Decimal("0E-12")` when
zero, and `str()` keeps that exponent form, which clients parsing a plain
decimal string reject.
"""


class VoidOrganization(IDSchema):
    name: str = Field(description="The organization name.")
    slug: str = Field(description="The organization slug.")
    created_at: datetime = Field(description="The organization creation timestamp.")
    active_deployment_id: UUID | None = Field(
        description="The active deployment, if one has been activated."
    )
    active_version_id: str | None = Field(
        description="The configuration version of the active deployment."
    )
    can_activate: bool = Field(
        description="Whether the organization has passed review and may activate "
        "a deployment."
    )
