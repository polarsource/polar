import ast

from scripts.linters.table_column import check


def test_flags_table_column_in_query() -> None:
    tree = ast.parse(
        "select(ProductPrice.id).where(\n"
        "    ProductPrice.__table__.c.meter_id == meter_id\n"
        ")"
    )
    assert [lineno for lineno, _ in check(tree)] == [2]


def test_allows_with_polymorphic_and_column_definition_reads() -> None:
    tree = ast.parse(
        "price = with_polymorphic(ProductPrice, [ProductPriceMeteredUnit])\n"
        "select(price.id).where(price.ProductPriceMeteredUnit.meter_id == meter_id)\n"
        "Customer.__table__.c.id.default.arg(None)\n"
    )
    assert check(tree) == []


def test_flags_subscript_table_column() -> None:
    tree = ast.parse('ProductPrice.__table__.c["meter_id"] == meter_id')
    [(lineno, message)] = check(tree)
    assert lineno == 1
    assert "ProductPrice.__table__.c.meter_id " in message
