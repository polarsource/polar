from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitAdsProperties(BenefitProperties):
    image_height: int
    image_width: int


class BenefitGrantAdsProperties(BenefitGrantProperties):
    advertisement_campaign_id: str
