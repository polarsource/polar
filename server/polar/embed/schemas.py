from pydantic import UUID4

from polar.kit.schemas import Schema
from polar.product.schemas import BenefitList, ProductMediaFileRead, ProductPrice


class ProductEmbed(Schema):
    id: UUID4
    name: str
    description: str | None
    is_recurring: bool
    organization_id: UUID4
    price: ProductPrice
    cover: ProductMediaFileRead | None
    benefits: BenefitList
