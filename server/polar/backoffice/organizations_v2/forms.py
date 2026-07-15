from datetime import timedelta
from typing import Annotated, Any

from fastapi import UploadFile
from pydantic import (
    AfterValidator,
    Field,
    StringConstraints,
    model_validator,
)

from polar.backoffice import forms
from polar.enums import RateLimitGroup
from polar.kit.schemas import EmptyStrToNone, HttpUrlToStr
from polar.organization.schemas import NameInput, SlugInput


class UpdateAccountSettingsForm(forms.BaseForm):
    """Form for editing account settings including payout_transaction_delay."""

    payout_transaction_delay: Annotated[timedelta, forms.InputField(type="text")] = (
        Field(
            title="Payout Transaction Delay",
            description=(
                "Expected format is ISO8601 duration format "
                "(e.g., 'P3D' for 3 days, or 'PT12H' for 12 hours)."
            ),
        )
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


_ORGANIZATIONS_RATE_LIMIT_GROUPS: tuple[RateLimitGroup, ...] = (
    RateLimitGroup.restricted,
    RateLimitGroup.default,
    RateLimitGroup.elevated,
)


def _validate_backoffice_rate_limit_group(value: RateLimitGroup) -> RateLimitGroup:
    if value not in _ORGANIZATIONS_RATE_LIMIT_GROUPS:
        raise ValueError(f"{value.value} cannot be set from the backoffice")
    return value


class UpdateRateLimitGroupForm(forms.BaseForm):
    rate_limit_group: Annotated[
        RateLimitGroup,
        forms.SelectField(
            options=[(g.value, g.name) for g in _ORGANIZATIONS_RATE_LIMIT_GROUPS]
        ),
        AfterValidator(_validate_backoffice_rate_limit_group),
        Field(title="Rate Limit Group"),
    ]


class UpdateOrganizationDetailsDataForm(forms.BaseForm):
    about: Annotated[
        EmptyStrToNone,
        forms.TextAreaField(rows=4),
        Field(
            None,
            title="About",
            description="Brief information about you and your business",
        ),
    ]
    product_description: Annotated[
        EmptyStrToNone,
        forms.TextAreaField(rows=4),
        Field(
            None,
            title="Product Description",
            description="Description of digital products being sold",
        ),
    ]
    intended_use: Annotated[
        EmptyStrToNone,
        forms.TextAreaField(rows=3),
        Field(
            None,
            title="Intended Use",
            description="How the organization will integrate and use Polar",
        ),
    ]


class UpdateOrganizationDetailsForm(forms.BaseForm):
    email: Annotated[
        str | None,
        forms.InputField(type="email", placeholder="contact@example.com"),
        Field(
            None,
            title="Email",
            description="Support or contact email for the organization",
        ),
    ]
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

    @model_validator(mode="before")
    @classmethod
    def empty_strings_to_none(cls, data: dict[str, Any]) -> dict[str, Any]:
        for key, value in data.items():
            if isinstance(value, str) and value.strip() == "":
                data[key] = None
        return data

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
        StringConstraints(min_length=3, pattern=r"^[a-zA-Z0-9\-]+\-$"),
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


class AddPaymentMethodDomainForm(forms.BaseForm):
    domain_name: Annotated[
        str,
        StringConstraints(
            min_length=1,
            max_length=253,
            pattern=r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$",
        ),
        forms.InputField(type="text", placeholder="example.com"),
        Field(
            title="Domain Name",
            description="Domain to add to Apple Pay / Google Pay allowlist (e.g., example.com)",
        ),
    ]
