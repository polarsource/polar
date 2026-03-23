from typing import Literal

from polar.kit.schemas import Schema
from polar.models.benefit import BenefitType

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
)


class BenefitFeatureFlagProperties(Schema):
    """
    Properties for a benefit of type `feature_flag`.
    """


class BenefitFeatureFlagCreateProperties(Schema):
    """
    Properties for creating a benefit of type `feature_flag`.
    """


class BenefitFeatureFlagSubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `feature_flag`.
    """


class BenefitFeatureFlagCreate(BenefitCreateBase):
    """
    Schema to create a benefit of type `feature_flag`.
    """

    type: Literal[BenefitType.feature_flag]
    properties: BenefitFeatureFlagCreateProperties


class BenefitFeatureFlagUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.feature_flag]
    properties: BenefitFeatureFlagProperties | None = None


class BenefitFeatureFlag(BenefitBase):
    """
    A benefit of type `feature_flag`.

    Use it to grant feature flags with key-value metadata
    that can be queried via the API and webhooks.
    """

    type: Literal[BenefitType.feature_flag]
    properties: BenefitFeatureFlagProperties


class BenefitFeatureFlagSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.feature_flag]
    properties: BenefitFeatureFlagSubscriberProperties
