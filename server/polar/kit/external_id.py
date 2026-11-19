from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field, StringConstraints
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.schemas import empty_str_to_none
from polar.kit.versioning import Version
from polar.version import V2027_01

ExternalIDColumn = Annotated[
    str | None, mapped_column(String, nullable=True, default=None)
]

ExternalID = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")]
_rule = (
    "It must start with a letter or digit and contain only "
    "letters, digits, `_`, `-`, `.` and `:`."
)


class ExternalIDMixin:
    external_id: Mapped[ExternalIDColumn]


_description = (
    "An ID from your own system to reference this resource. "
    "It must be unique within the organization for this type of resource."
)
_input_description = f"{_description} {_rule}"
_example = "ext_1337"


class ExternalIDInputMixin(BaseModel):
    external_id: Annotated[
        ExternalID | None,
        BeforeValidator(empty_str_to_none),
        Version(starting_from=V2027_01),
        Field(description=_input_description, examples=[_example]),
    ] = None


class ExternalIDOutputMixin(BaseModel):
    external_id: Annotated[
        str | None,
        Version(starting_from=V2027_01),
        Field(description=_description, examples=[_example]),
    ]
