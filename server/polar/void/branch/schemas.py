import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from polar.kit.schemas import Schema
from polar.void.deploy.schemas import DeployCreate, PricePreviewWindow
from polar.void.product.schemas import MeterTerms, ProductPrice


class ProductPatch(BaseModel):
    """Overrides for one product of the base version; unset fields keep the base."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    price: ProductPrice | None = None
    meters: dict[str, MeterTerms] = Field(
        default_factory=dict,
        description="Replacement terms by meter slug; the meter must already be "
        "billed by the product in the base version.",
    )


class MeterPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    unit_amount: Decimal | None = Field(
        default=None, ge=0, max_digits=17, decimal_places=12
    )


class BranchPatch(BaseModel):
    """A configuration-level diff against the base version, keyed by slug."""

    model_config = ConfigDict(extra="forbid")

    products: dict[str, ProductPatch] = Field(default_factory=dict)
    meters: dict[str, MeterPatch] = Field(default_factory=dict)


class BranchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    base_version_id: str = Field(
        pattern=r"^[0-9a-f]{64}$",
        description="The deployed version this branch forks. A branch stays "
        "pinned to it; it never follows the active version.",
    )
    patch: BranchPatch = Field(default_factory=BranchPatch)


class BranchUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    patch: BranchPatch | None = Field(
        default=None, description="Replaces the whole patch when given."
    )


class BranchPreview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    window: PricePreviewWindow


class Branch(Schema):
    id: uuid.UUID
    name: str
    base_version_id: str
    base_deployment_id: uuid.UUID
    patch: BranchPatch
    version_id: str = Field(
        description="SHA-256 of the resolved configuration: the version this "
        "branch would become when promoted."
    )
    deployment_id: uuid.UUID | None = Field(
        description="The deployment that already has this resolved version, if any."
    )
    promoted_deployment_id: uuid.UUID | None
    base_configuration: DeployCreate = Field(
        description="The configuration of the base version."
    )
    configuration: DeployCreate = Field(
        description="The base configuration with the patch applied."
    )
    created_at: datetime
    modified_at: datetime | None
