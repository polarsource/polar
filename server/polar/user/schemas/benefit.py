from typing import Annotated

from pydantic import TypeAdapter

from polar.benefit.schemas import BenefitSubscriber, BenefitSubscriberAdapter
from polar.kit.schemas import MergeJSONSchema

UserBenefit = Annotated[BenefitSubscriber, MergeJSONSchema({"title": "UserBenefit"})]
UserBenefitAdapter: TypeAdapter[UserBenefit] = BenefitSubscriberAdapter
