from typing import Annotated, Literal

from annotated_types import Ge
from fastapi import UploadFile
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


class UpdateOrganizationBasicForm(forms.BaseForm):
    """Form for editing basic organization settings (name, slug, invoice prefix)."""

    name: NameInput
    slug: SlugInput
    customer_invoice_prefix: Annotated[
        str,
        StringConstraints(
            to_upper=True, min_length=3, pattern=r"^[a-zA-Z0-9\-]+[a-zA-Z0-9]$"
        ),
    ]


class UpdateOrganizationForm(forms.BaseForm):
    """Form for editing organization settings including feature flags."""

    name: NameInput
    slug: SlugInput
    customer_invoice_prefix: Annotated[
        str,
        StringConstraints(
            to_upper=True, min_length=3, pattern=r"^[a-zA-Z0-9\-]+[a-zA-Z0-9]$"
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


class UpdateOrganizationInternalNotesForm(forms.BaseForm):
    internal_notes: Annotated[
        str | None,
        forms.TextAreaField(rows=10),
        Field(
            None,
            title="Internal Notes",
            description="Internal notes about this organization (admin only)",
        ),
    ]


class UpdateOrganizationSocialsForm(forms.BaseForm):
    """Form for editing organization social media links."""

    youtube_url: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://youtube.com/@channel"),
        Field(
            None,
            title="YouTube",
            description="YouTube channel URL",
        ),
    ]
    instagram_url: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://instagram.com/username"),
        Field(
            None,
            title="Instagram",
            description="Instagram profile URL",
        ),
    ]
    linkedin_url: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://linkedin.com/company/name"),
        Field(
            None,
            title="LinkedIn",
            description="LinkedIn profile or company page URL",
        ),
    ]
    x_url: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://x.com/username"),
        Field(
            None,
            title="X (Twitter)",
            description="X (Twitter) profile URL",
        ),
    ]
    facebook_url: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://facebook.com/page"),
        Field(
            None,
            title="Facebook",
            description="Facebook page URL",
        ),
    ]
    threads_url: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://threads.net/@username"),
        Field(
            None,
            title="Threads",
            description="Threads profile URL",
        ),
    ]
    tiktok_url: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://tiktok.com/@username"),
        Field(
            None,
            title="TikTok",
            description="TikTok profile URL",
        ),
    ]
    github_url: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://github.com/username"),
        Field(
            None,
            title="GitHub",
            description="GitHub profile URL",
        ),
    ]
    discord_url: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://discord.gg/invite"),
        Field(
            None,
            title="Discord",
            description="Discord server invite URL",
        ),
    ]
    other_url: Annotated[
        HttpUrlToStr | None,
        forms.InputField(type="url", placeholder="https://..."),
        Field(
            None,
            title="Other",
            description="Other social media or website URL",
        ),
    ]


class OrganizationOrdersImportForm(forms.BaseForm):
    invoice_number_prefix: Annotated[
        str,
        StringConstraints(min_length=3, pattern=r"^[a-zA-Z0-9\-]+\-"),
        Field(
            title="Invoice Number Prefix",
            description="Prefix to use for imported orders' invoice numbers",
            default="IMPORTED-",
        ),
    ]
    file: Annotated[
        UploadFile,
        forms.InputField(type="file"),
        Field(
            title="CSV File",
            description=(
                "CSV file containing orders to import. "
                "`email` and `product_name` columns are required."
            ),
        ),
    ]


class DisconnectStripeAccountForm(forms.BaseForm):
    stripe_account_id: Annotated[
        str,
        StringConstraints(min_length=1),
        Field(title="Stripe Account ID"),
    ]
    reason: Annotated[
        str,
        forms.TextAreaField(rows=4),
        Field(
            min_length=1,
            title="Reason",
            description="Explain why this Stripe account is being disconnected",
        ),
    ]


class DeleteStripeAccountForm(forms.BaseForm):
    stripe_account_id: Annotated[
        str,
        StringConstraints(min_length=1),
        Field(title="Stripe Account ID"),
    ]
    reason: Annotated[
        str,
        forms.TextAreaField(rows=4),
        Field(
            min_length=1,
            title="Reason",
            description="Explain why this Stripe account is being deleted",
        ),
    ]
