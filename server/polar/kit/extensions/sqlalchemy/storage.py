from typing import Any

from sqlalchemy import DDL, Connection, Table, event

# SQLAlchemy 2.1 supports table-level postgresql_with natively.
Table.argument_for("postgresql", "with", None)


@event.listens_for(Table, "after_create")
def apply_storage_parameters(
    table: Table, connection: Connection, **kwargs: Any
) -> None:
    if connection.dialect.name != "postgresql":
        return

    options = table.dialect_kwargs.get("postgresql_with")
    if options:
        parameters = ", ".join(f"{name} = {value}" for name, value in options.items())
        connection.execute(
            DDL(f"ALTER TABLE %(fullname)s SET ({parameters})").against(table)
        )
