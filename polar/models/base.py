import enum
from datetime import datetime

from sqlalchemy import Column, DateTime
from sqlalchemy.orm import declarative_base

from polar.ext.sqlalchemy import GUID, IntEnum
from polar.models.mixins import ActiveRecordMixin, SerializeMixin

Base = declarative_base()


class Model(Base, ActiveRecordMixin, SerializeMixin):
    __abstract__ = True


class TimestampedModel(Model):
    __abstract__ = True

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    modified_at = Column(DateTime, onupdate=datetime.utcnow)


class RecordModel(TimestampedModel):
    __abstract__ = True

    id = Column(GUID, primary_key=True, default=GUID.generate)


class StatusFlag(enum.Enum):
    DISABLED = 0
    ACTIVE = 1


class StatusMixin:
    status = Column(IntEnum(StatusFlag), nullable=False, default=StatusFlag.DISABLED)
