"""
Detector registry.

Adding an insight is adding one entry here (and its detector module) — mirroring how
`metrics.METRICS` is a flat catalog. The service runs every registered detector for
each organization and collects whatever fires.
"""

from .base import Detector, DetectorContext
from .mrr import MRRGrowthDetector

DETECTORS: list[Detector] = [
    MRRGrowthDetector(),
]

__all__ = ["DETECTORS", "Detector", "DetectorContext"]
