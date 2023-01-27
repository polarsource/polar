from sqlalchemy import Column, Unicode

from polar.models.base import RecordModel


class Demo(RecordModel):
    __tablename__ = "demo"
    testing = Column(Unicode(255), nullable=False, default="testing")
