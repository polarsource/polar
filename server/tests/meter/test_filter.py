from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator


def test_strip_metadata_prefix() -> None:
    filter = Filter(
        conjunction=FilterConjunction.and_,
        clauses=[
            FilterClause(
                property="metadata.property", operator=FilterOperator.eq, value="value"
            )
        ],
    )

    clause = filter.clauses[0]
    assert isinstance(clause, FilterClause)
    assert clause.property == "property"
