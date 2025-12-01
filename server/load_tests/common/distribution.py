"""Distribution helpers for load testing."""

import random


class PowerLawDistribution:
    """
    Distributes load across items following a power-law pattern.

    Based on observed production patterns:
    - Top 1: ~35% of events
    - Top 2-5: ~43% of events (split among 4)
    - Top 6-10: ~12% of events (split among 5)
    - Top 11-20: ~6% of events (split among 10)
    - Remaining: ~4% of events (split evenly)
    """

    def __init__(self, items: list[str]) -> None:
        if not items:
            raise ValueError("At least one item is required")
        self.items = items
        self.weights = self._calculate_weights(len(items))

    def _calculate_weights(self, n: int) -> list[float]:
        """Calculate weight distribution for n items."""
        if n == 1:
            return [1.0]

        weights = []

        for i in range(n):
            if i == 0:
                # Top customer: 35%
                weights.append(0.35)
            elif i < 5:
                # Customers 2-5: 43% split among up to 4
                share = 0.43 / min(4, n - 1)
                weights.append(share)
            elif i < 10:
                # Customers 6-10: 12% split among up to 5
                count_in_tier = min(5, n - 5)
                share = 0.12 / count_in_tier
                weights.append(share)
            elif i < 20:
                # Customers 11-20: 6% split among up to 10
                count_in_tier = min(10, n - 10)
                share = 0.06 / count_in_tier
                weights.append(share)
            else:
                # Remaining customers: 4% split evenly
                remaining_count = n - 20
                share = 0.04 / remaining_count
                weights.append(share)

        # Normalize weights to sum to 1.0
        total = sum(weights)
        return [w / total for w in weights]

    def select(self) -> str:
        """Select an item based on power-law distribution."""
        return random.choices(self.items, weights=self.weights, k=1)[0]

    def select_many(self, count: int) -> list[str]:
        """Select multiple items based on power-law distribution."""
        return random.choices(self.items, weights=self.weights, k=count)
