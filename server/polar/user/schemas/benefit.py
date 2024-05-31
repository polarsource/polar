from pydantic import TypeAdapter

from polar.benefit.schemas import BenefitSubscriber, BenefitSubscriberAdapter

UserBenefit = BenefitSubscriber
UserBenefitAdapter: TypeAdapter[UserBenefit] = BenefitSubscriberAdapter
