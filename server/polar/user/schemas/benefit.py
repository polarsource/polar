from typing import Annotated

from pydantic import TypeAdapter

from polar.benefit.schemas import BenefitSubscriber, BenefitSubscriberAdapter
from polar.kit.schemas import ClassName, MergeJSONSchema

UserBenefit = Annotated[
    BenefitSubscriber,
    MergeJSONSchema({"title": "UserBenefit"}),
    ClassName("UserBenefit"),
]
UserBenefitAdapter: TypeAdapter[UserBenefit] = BenefitSubscriberAdapter
