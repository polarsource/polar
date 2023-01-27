from typing import Any


class SerializeMixin:
    __abstract__ = True

    def to_dict(self) -> dict[str, Any]:
        columns = []
        if hasattr(self, "__table__"):
            columns = self.__table__.c.keys()  # type: ignore

        ret = dict([(column, getattr(self, column)) for column in columns])
        return ret
