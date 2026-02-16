from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitFeatureFlagProperties(BenefitProperties):
    metadata: dict[str, str]


class BenefitGrantFeatureFlagProperties(BenefitGrantProperties): ...
