from polar.meter.aggregation import AggregationFunction, PropertyAggregation


def test_strip_metadata_prefix() -> None:
    aggregation = PropertyAggregation(
        func=AggregationFunction.sum, property="metadata.property"
    )
    assert aggregation.property == "property"
