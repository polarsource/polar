from pydantic import UUID4

from polar.file.schemas import ProductMediaFileRead
from polar.kit.schemas import Schema
from polar.product.schemas import BenefitList, ProductPrice


class ProductEmbed(Schema):
    id: UUID4
    name: str
    description: str | None
    is_recurring: bool
    organization_id: UUID4
    price: ProductPrice
    cover: ProductMediaFileRead | None
    benefits: BenefitList
    etag: str
