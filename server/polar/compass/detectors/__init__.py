"""
Detector registry.

Adding an insight is adding one entry here (and its detector module) — mirroring how
`metrics.METRICS` is a flat catalog. The service runs every registered detector for
each organization and collects whatever fires.
"""

from .anomaly import CostAnomalyDetector
from .arpu import ARPUMovementDetector
from .base import Detector, DetectorContext
from .churn import ChurnSpikeDetector
from .conversion import CheckoutConversionDetector
from .cost_per_user import CostPerUserDetector
from .currency import CurrencyOpportunityDetector
from .customer_cost import CostConcentrationDetector
from .involuntary_churn import InvoluntaryChurnDetector
from .margin import GrossMarginDetector
from .mrr import MRRGrowthDetector
from .product_margin import ProductMarginDetector
from .runway import MarginRunwayDetector
from .subscribers import SubscriberGrowthDetector
from .trials import TrialConversionDetector

DETECTORS: list[Detector] = [
    MRRGrowthDetector(),
    SubscriberGrowthDetector(),
    ARPUMovementDetector(),
    ChurnSpikeDetector(),
    TrialConversionDetector(),
    GrossMarginDetector(),
    CostPerUserDetector(),
    CheckoutConversionDetector(),
    ProductMarginDetector(),
    CostConcentrationDetector(),
    MarginRunwayDetector(),
    InvoluntaryChurnDetector(),
    CurrencyOpportunityDetector(),
    CostAnomalyDetector(),
]

DETECTOR_IDS: frozenset[str] = frozenset(detector.id for detector in DETECTORS)

__all__ = ["DETECTORS", "DETECTOR_IDS", "Detector", "DetectorContext"]
