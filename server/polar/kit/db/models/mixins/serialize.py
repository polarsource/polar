from typing import Any


class SerializeMixin:
    __abstract__ = True

    def to_dict(self) -> dict[str, Any]:
        columns = self.__table__.c.keys() if hasattr(self, "__table__") else []
        return dict([(column, getattr(self, column)) for column in columns])
