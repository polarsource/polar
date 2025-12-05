from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

import stripe as stripe_lib
from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ColumnElement,
    String,
    UniqueConstraint,
    type_coerce,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import StrEnumType


class ExternalEventSource(StrEnum):
    stripe = "stripe"
    chargeback_stop = "chargeback_stop"


class ExternalEvent(RecordModel):
    __tablename__ = "external_events"
    __table_args__ = (UniqueConstraint("source", "external_id"),)

    source: Mapped[ExternalEventSource] = mapped_column(
        StrEnumType(ExternalEventSource), nullable=False, index=True
    )
    handled_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None, index=True
    )
    task_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    data: Mapped[dict[str, Any]] = mapped_column("data", JSONB, nullable=False)

    @hybrid_property
    def is_handled(self) -> bool:
        return self.handled_at is not None

    @is_handled.inplace.expression
    @classmethod
    def _is_handled_expression(cls) -> ColumnElement[bool]:
        return type_coerce(cls.handled_at.is_not(None), Boolean)

    __mapper_args__ = {
        "polymorphic_on": "source",
    }


class StripeEvent(ExternalEvent):
    source: Mapped[Literal[ExternalEventSource.stripe]] = mapped_column(  # pyright: ignore
        use_existing_column=True, default=ExternalEventSource.stripe
    )

    @property
    def stripe_data(self) -> stripe_lib.Event:
        return stripe_lib.Event.construct_from(self.data, key=None)

    __mapper_args__ = {
        "polymorphic_identity": ExternalEventSource.stripe,
        "polymorphic_load": "inline",
    }


class ChargebackStopEvent(ExternalEvent):
    source: Mapped[Literal[ExternalEventSource.chargeback_stop]] = mapped_column(  # pyright: ignore
        use_existing_column=True, default=ExternalEventSource.chargeback_stop
    )

    __mapper_args__ = {
        "polymorphic_identity": ExternalEventSource.chargeback_stop,
        "polymorphic_load": "inline",
    }
