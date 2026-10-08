from dataclasses import dataclass
from decimal import Decimal

from polar.meter.aggregation import AggregationFunction


@dataclass
class Aggregate:
    count: int = 0
    total: Decimal = Decimal(0)
    minimum: Decimal | None = None
    maximum: Decimal | None = None

    def add(self, other: "Aggregate") -> None:
        self.count += other.count
        self.total += other.total
        if other.minimum is not None:
            self.minimum = (
                other.minimum
                if self.minimum is None
                else min(self.minimum, other.minimum)
            )
        if other.maximum is not None:
            self.maximum = (
                other.maximum
                if self.maximum is None
                else max(self.maximum, other.maximum)
            )

    def quantity(self, function: AggregationFunction) -> Decimal:
        match function:
            case AggregationFunction.cnt:
                return Decimal(self.count)
            case AggregationFunction.sum:
                return self.total
            case AggregationFunction.avg:
                return self.total / self.count if self.count else Decimal(0)
            case AggregationFunction.min:
                return self.minimum if self.minimum is not None else Decimal(0)
            case AggregationFunction.max:
                return self.maximum if self.maximum is not None else Decimal(0)
            case _:
                raise ValueError("Unsupported reducer aggregation")
