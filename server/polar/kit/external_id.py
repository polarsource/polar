from typing import Annotated

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

ExternalIDColumn = Annotated[
    str | None, mapped_column(String, nullable=True, default=None)
]


class ExternalIDMixin:
    external_id: Mapped[ExternalIDColumn]
