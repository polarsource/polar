from typing import Annotated, Literal

from annotated_types import Ge
from pydantic import Discriminator, Field, TypeAdapter

from polar.organization.schemas import NameInput, SlugInput

from .. import forms


class ApproveOrganizationForm(forms.BaseForm):
    action: Annotated[Literal["approve"], forms.SkipField]
    next_review_threshold: Annotated[
        int,
        forms.CurrencyField(),
        Ge(0),
        forms.CurrencyValidator,
        Field(title="Next Review Threshold"),
    ]


class DenyOrganizationForm(forms.BaseForm):
    action: Annotated[Literal["deny"], forms.SkipField]


class UnderReviewOrganizationForm(forms.BaseForm):
    action: Annotated[Literal["under_review"], forms.SkipField]


class ApproveOrganizationAppealForm(forms.BaseForm):
    action: Annotated[Literal["approve_appeal"], forms.SkipField]


class DenyOrganizationAppealForm(forms.BaseForm):
    action: Annotated[Literal["deny_appeal"], forms.SkipField]


OrganizationStatusForm = Annotated[
    ApproveOrganizationForm
    | DenyOrganizationForm
    | UnderReviewOrganizationForm
    | ApproveOrganizationAppealForm
    | DenyOrganizationAppealForm,
    Discriminator("action"),
]

OrganizationStatusFormAdapter: TypeAdapter[OrganizationStatusForm] = TypeAdapter(
    OrganizationStatusForm
)


class UpdateOrganizationForm(forms.BaseForm):
    name: NameInput
    slug: SlugInput


class UpdateOrganizationDetailsForm(forms.BaseForm):
    """Simplified form for editing only the three key organization detail fields."""

    about: Annotated[
        str,
        forms.TextAreaField(rows=4),
        Field(
            min_length=1,
            title="About",
            description="Brief information about you and your business",
        ),
    ]
    product_description: Annotated[
        str,
        forms.TextAreaField(rows=4),
        Field(
            min_length=1,
            title="Product Description",
            description="Description of digital products being sold",
        ),
    ]
    intended_use: Annotated[
        str,
        forms.TextAreaField(rows=3),
        Field(
            min_length=1,
            title="Intended Use",
            description="How the organization will integrate and use Polar",
        ),
    ]
