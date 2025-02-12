from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitCustomProperties(BenefitProperties):
    note: str | None


class BenefitGrantCustomProperties(BenefitGrantProperties): ...
