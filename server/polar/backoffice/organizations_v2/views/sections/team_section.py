"""Team section with member management."""

import contextlib
from collections.abc import Generator

from fastapi import Request
from tagflow import classes, tag, text

from polar.models import Organization, User
from polar.models.user import IdentityVerificationStatus

from ....components import action_bar, button, card


class TeamSection:
    """Render the team section with member management."""

    def __init__(
        self,
        organization: Organization,
        owner_user: User | None = None,
        identity_country: str | None = None,
    ):
        self.org = organization
        self.owner_user = owner_user
        self.identity_country = identity_country

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        """Render the team section."""

        with tag.div(classes="space-y-6"):
            # Team overview card
            with card(bordered=True):
                with tag.div(classes="mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Team Members")

                # Members list
                if hasattr(self.org, "members") and self.org.members:
                    with tag.div(classes="space-y-3"):
                        for member in self.org.members:
                            with tag.div(
                                classes="flex items-center justify-between p-4 border border-base-300 rounded-lg hover:bg-base-50"
                            ):
                                # Member info
                                with tag.div(classes="flex items-center gap-4 flex-1"):
                                    # Avatar placeholder
                                    with tag.div(
                                        classes="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
                                    ):
                                        with tag.span(classes="text-primary font-bold"):
                                            text(
                                                member.user.email[0].upper()
                                                if member.user.email
                                                else "?"
                                            )

                                    with tag.div():
                                        with tag.div(classes="flex items-center gap-2"):
                                            with tag.span(classes="font-semibold"):
                                                with tag.a(
                                                    href=str(
                                                        request.url_for(
                                                            "users:get",
                                                            id=member.user_id,
                                                        )
                                                    ),
                                                    classes="hover:text-primary hover:underline",
                                                ):
                                                    text(member.user.email or "Unknown")
                                            status = (
                                                member.user.identity_verification_status
                                            )
                                            if (
                                                status
                                                != IdentityVerificationStatus.unverified
                                            ):
                                                with tag.div(classes="badge badge-sm"):
                                                    if (
                                                        status
                                                        == IdentityVerificationStatus.failed
                                                    ):
                                                        classes("badge-warning")
                                                    else:
                                                        classes("badge-neutral")
                                                    text(status.get_display_name())
                                            if self.identity_country:
                                                with tag.span(
                                                    classes="text-sm text-base-content/60"
                                                ):
                                                    text(self.identity_country)
                                        with tag.div(
                                            classes="text-sm text-base-content/60"
                                        ):
                                            is_owner = (
                                                self.owner_user
                                                and member.user_id == self.owner_user.id
                                            )
                                            role_text = (
                                                "Owner" if is_owner else "Member"
                                            )
                                            text(
                                                f"{role_text} · Joined {member.created_at.strftime('%Y-%m-%d')}"
                                            )

                                # Actions
                                with action_bar(position="right"):
                                    with button(
                                        variant="secondary",
                                        size="sm",
                                        ghost=True,
                                        hx_post=str(
                                            request.url_for(
                                                "backoffice:start_impersonation",
                                            )
                                        ),
                                        hx_vals=f'{{"user_id": "{member.user_id}", "organization_id": "{self.org.id}"}}',
                                        hx_confirm="Are you sure you want to impersonate this user?",
                                    ):
                                        text("Impersonate")

                                    with tag.div(classes="dropdown dropdown-end"):
                                        with tag.button(
                                            classes="btn btn-ghost btn-sm",
                                            **{
                                                "aria-label": "More options",
                                                "tabindex": "0",
                                            },
                                        ):
                                            text("⋮")
                                        with tag.ul(
                                            classes="dropdown-content menu shadow bg-base-100 rounded-box w-52 z-10",
                                            **{"tabindex": "0"},
                                        ):
                                            member_is_owner = (
                                                self.owner_user
                                                and member.user_id == self.owner_user.id
                                            )
                                            if not member_is_owner:
                                                with tag.li():
                                                    with tag.a(
                                                        hx_post=str(
                                                            request.url_for(
                                                                "organizations:make_owner",
                                                                organization_id=self.org.id,
                                                                user_id=member.user_id,
                                                            )
                                                        ),
                                                        hx_confirm="Transfer ownership to this user?",
                                                    ):
                                                        text("Make Owner")
                                            with tag.li():
                                                with tag.a(
                                                    hx_delete=str(
                                                        request.url_for(
                                                            "organizations:remove_member",
                                                            organization_id=self.org.id,
                                                            user_id=member.user_id,
                                                        )
                                                    ),
                                                    hx_confirm="Remove this member?",
                                                    classes="text-error",
                                                ):
                                                    text("Remove Member")
                else:
                    with tag.div(classes="text-center py-8 text-base-content/60"):
                        text("No team members found")

            # Ownership transfer requirements (if applicable)
            with card(bordered=True):
                with tag.h3(classes="text-md font-bold mb-3"):
                    text("Ownership Transfer Requirements")

                with tag.ul(classes="space-y-2 text-sm"):
                    with tag.li(classes="flex items-start gap-2"):
                        with tag.span(classes="text-base-content/60"):
                            text(
                                "• No Stripe account connected (restriction for alpha)"
                            )

                    with tag.li(classes="flex items-start gap-2"):
                        with tag.span(classes="text-base-content/60"):
                            text("• New owner must be verified")

                    with tag.li(classes="flex items-start gap-2"):
                        with tag.span(classes="text-base-content/60"):
                            text("• At least 2 team members required")

            yield


__all__ = ["TeamSection"]
