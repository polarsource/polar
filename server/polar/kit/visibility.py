from enum import StrEnum

from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.extensions.sqlalchemy import StringEnum


class Visibility(StrEnum):
    draft = "draft"
    private = "private"
    public = "public"


class VisibilityMixin:
    visibility: Mapped[Visibility] = mapped_column(
        StringEnum(Visibility),
        nullable=False,
        default=Visibility.public,
    )
