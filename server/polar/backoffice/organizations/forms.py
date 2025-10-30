from typing import Annotated, Literal

from annotated_types import Ge
from pydantic import (
    Discriminator,
    Field,
    StringConstraints,
    TypeAdapter,
)

from polar.kit.schemas import HttpUrlToStr
from polar.organization.schemas import NameInput, OrganizationFeatureSettings, SlugInput

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
    customer_invoice_prefix: Annotated[
        str,
        StringConstraints(
            to_upper=True, min_length=3, pattern=r"^[a-zA-Z0-9\-]+[a-zA-Z0-9]$"
        ),
    ]
    internal_notes: Annotated[
        str | None,
        forms.TextAreaField(rows=4),
        Field(
            default=None,
            title="Internal Notes",
            description="Internal notes for support team (not visible to organization)",
        ),
    ]
    feature_flags: Annotated[
        OrganizationFeatureSettings | None,
        forms.SubFormField(OrganizationFeatureSettings),
        Field(default=None, title="Feature Flags"),
    ]


class UpdateOrganizationDetailsDataForm(forms.BaseForm):
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


class UpdateOrganizationDetailsForm(forms.BaseForm):
    website: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://example.com"),
        Field(
            None,
            title="Website",
            description="Official website of the organization",
        ),
    ]
    details: Annotated[UpdateOrganizationDetailsDataForm, Field(title="Details")]
