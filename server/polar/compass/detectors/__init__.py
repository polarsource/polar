"""
Detector registry.

Adding an insight is adding one entry here (and its detector module) — mirroring how
`metrics.METRICS` is a flat catalog. The service runs every registered detector for
each organization and collects whatever fires.
"""

from .arpu import ARPUMovementDetector
from .base import Detector, DetectorContext
from .churn import ChurnSpikeDetector
from .mrr import MRRGrowthDetector
from .subscribers import SubscriberGrowthDetector
from .trials import TrialConversionDetector

DETECTORS: list[Detector] = [
    MRRGrowthDetector(),
    SubscriberGrowthDetector(),
    ARPUMovementDetector(),
    ChurnSpikeDetector(),
    TrialConversionDetector(),
]

DETECTOR_IDS: frozenset[str] = frozenset(detector.id for detector in DETECTORS)

__all__ = ["DETECTORS", "DETECTOR_IDS", "Detector", "DetectorContext"]
