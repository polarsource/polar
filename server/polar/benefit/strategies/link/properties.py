from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitLinkProperties(BenefitProperties):
    url: str
    label: str | None


class BenefitGrantLinkProperties(BenefitGrantProperties, total=False):
    url: str
