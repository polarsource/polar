from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import Delete, Select, Update, delete, func, select, update
from sqlalchemy.sql.base import ExecutableOption

Insert = postgresql.Insert
insert = postgresql.insert

__all__ = [
    "Delete",
    "ExecutableOption",
    "Insert",
    "Select",
    "Update",
    "delete",
    "func",
    "insert",
    "select",
    "update",
]
