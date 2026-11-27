"""Flag `Model.__table__.c.<column>` and `Model.__table__.c["<column>"]` in queries.

With single-table inheritance a column that only some subclasses map (e.g.
`meter_id` on the metered `ProductPrice` types) is not an attribute of the
base class. Using the subclass attribute (`ProductPriceMeteredUnit.meter_id`)
makes that subclass an entity of the query, so SQLAlchemy adds its
discriminator filter and silently drops the sibling types.
`ProductPrice.__table__.c.meter_id` avoids the filter by reaching under the
mapping into Core, which needs a comment at every call site.

Use `with_polymorphic` instead: one entity that is the base class and exposes
the subclasses' attributes, with no discriminator filter:

    price = with_polymorphic(
        ProductPrice, [ProductPriceMeteredUnit, ProductPriceMeteredTiers]
    )
    select(...).join(price, ...).where(
        price.ProductPriceMeteredUnit.meter_id == meter_id
    )

Reads of the column's own definition (`Model.__table__.c.id.default`) are not
query expressions and are not flagged. `# lint-skip: table-column` on the
offending line is the escape.
"""

import ast

from .base import Rule, Violation

COLUMN_COLLECTIONS = frozenset({"c", "columns"})
COLUMN_DEFINITION_ATTRIBUTES = frozenset(
    {"default", "server_default", "onupdate", "type", "nullable", "name", "key"}
)

MESSAGE = (
    "{model}.__table__.c.{column} bypasses the ORM mapping. For a column "
    "mapped on subclasses only, query a with_polymorphic({model}, [...]) "
    "entity and use its subclass namespace (entity.Subclass.{column}). "
    "Escape with `# lint-skip: table-column`."
)


def check(tree: ast.Module) -> list[Violation]:
    violations: list[Violation] = []
    definition_reads = {
        id(node.value)
        for node in ast.walk(tree)
        if isinstance(node, ast.Attribute) and node.attr in COLUMN_DEFINITION_ATTRIBUTES
    }
    for node in ast.walk(tree):
        if id(node) in definition_reads:
            continue
        if isinstance(node, ast.Attribute):
            column = node.attr
        elif isinstance(node, ast.Subscript):
            index = node.slice
            column = (
                index.value
                if isinstance(index, ast.Constant) and isinstance(index.value, str)
                else ast.unparse(index)
            )
        else:
            continue
        collection = node.value
        if not (
            isinstance(collection, ast.Attribute)
            and collection.attr in COLUMN_COLLECTIONS
        ):
            continue
        table = collection.value
        if not (isinstance(table, ast.Attribute) and table.attr == "__table__"):
            continue
        violations.append(
            (
                node.lineno,
                MESSAGE.format(model=ast.unparse(table.value), column=column),
            )
        )
    return violations


RULE = Rule(
    name="table-column",
    skip_code="table-column",
    summary="flag Model.__table__.c.<column> that bypasses the ORM mapping",
    check=check,
)
