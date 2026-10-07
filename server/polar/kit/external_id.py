from typing import Annotated

from pydantic import BaseModel, Field
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.schemas import EmptyStrToNone
from polar.kit.versioning import Version
from polar.version import V2027_01

ExternalIDColumn = Annotated[
    str | None, mapped_column(String, nullable=True, default=None)
]


class ExternalIDMixin:
    external_id: Mapped[ExternalIDColumn]


_description = (
    "An ID from your own system to reference this resource. "
    "It must be unique within the organization for this type of resource."
)
_example = "ext_1337"


class ExternalIDInputMixin(BaseModel):
    external_id: Annotated[
        EmptyStrToNone,
        Version(starting_from=V2027_01),
        Field(description=_description, examples=[_example]),
    ] = None


class ExternalIDOutputMixin(BaseModel):
    external_id: Annotated[
        str | None,
        Version(starting_from=V2027_01),
        Field(description=_description, examples=[_example]),
    ]
