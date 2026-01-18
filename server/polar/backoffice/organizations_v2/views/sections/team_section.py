"""Team section with member management."""

import contextlib
from collections.abc import Generator

from fastapi import Request
from markupflow import Fragment

from polar.models import Organization, User

from ....components import action_bar, button, card


class TeamSection:
    """Render the team section with member management."""

    def __init__(self, organization: Organization, admin_user: User | None = None):
        self.org = organization
        self.admin_user = admin_user

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[Fragment]:
        """Render the team section."""
        fragment = Fragment()

        with fragment.div(class_="space-y-6"):
            # Team overview card
            with card(bordered=True):
                with fragment.div(class_="mb-4"):
                    with fragment.h2(class_="text-lg font-bold"):
                        fragment.text("Team Members")

                # Members list
                if hasattr(self.org, "members") and self.org.members:
                    with fragment.div(class_="space-y-3"):
                        for member in self.org.members:
                            with fragment.div(
                                class_="flex items-center justify-between p-4 border border-base-300 rounded-lg hover:bg-base-50"
                            ):
                                # Member info
                                with fragment.div(class_="flex items-center gap-4 flex-1"):
                                    # Avatar placeholder
                                    with fragment.div(
                                        class_="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
                                    ):
                                        with fragment.span(class_="text-primary font-bold"):
                                            fragment.text(
                                                member.user.email[0].upper()
                                                if member.user.email
                                                else "?"
                                            )

                                    with fragment.div():
                                        with fragment.div(class_="font-semibold"):
                                            fragment.text(member.user.email or "Unknown")
                                        with fragment.div(
                                            class_="text-sm text-base-content/60"
                                        ):
                                            is_admin = (
                                                self.admin_user
                                                and member.user_id == self.admin_user.id
                                            )
                                            role_text = (
                                                "Admin" if is_admin else "Member"
                                            )
                                            fragment.text(
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
                                        hx_vals=f'{{"user_id": "{member.user_id}"}}',
                                        hx_confirm="Are you sure you want to impersonate this user?",
                                    ):
                                        fragment.text("Impersonate")

                                    with fragment.div(class_="dropdown dropdown-end"):
                                        with fragment.button(
                                            class_="btn btn-ghost btn-sm",
                                            **{
                                                "aria-label": "More options",
                                                "tabindex": "0",
                                            },
                                        ):
                                            fragment.text("⋮")
                                        with fragment.ul(
                                            class_="dropdown-content menu shadow bg-base-100 rounded-box w-52 z-10",
                                            **{"tabindex": "0"},
                                        ):
                                            member_is_admin = (
                                                self.admin_user
                                                and member.user_id == self.admin_user.id
                                            )
                                            if not member_is_admin:
                                                with fragment.li():
                                                    with fragment.a(
                                                        hx_post=str(
                                                            request.url_for(
                                                                "organizations-v2:make_admin",
                                                                organization_id=self.org.id,
                                                                user_id=member.user_id,
                                                            )
                                                        ),
                                                        hx_confirm="Make this user an admin?",
                                                    ):
                                                        fragment.text("Make Admin")
                                            with fragment.li():
                                                with fragment.a(
                                                    hx_delete=str(
                                                        request.url_for(
                                                            "organizations-v2:remove_member",
                                                            organization_id=self.org.id,
                                                            user_id=member.user_id,
                                                        )
                                                    ),
                                                    hx_confirm="Remove this member?",
                                                    class_="text-error",
                                                ):
                                                    fragment.text("Remove Member")
                else:
                    with fragment.div(class_="text-center py-8 text-base-content/60"):
                        fragment.text("No team members found")

            # Admin change requirements (if applicable)
            if hasattr(self.org, "account") and self.org.account:
                with card(bordered=True):
                    with fragment.h3(class_="text-md font-bold mb-3"):
                        fragment.text("Admin Change Requirements")

                    with fragment.ul(class_="space-y-2 text-sm"):
                        with fragment.li(class_="flex items-start gap-2"):
                            with fragment.span(class_="text-base-content/60"):
                                fragment.text(
                                    "• No Stripe account connected (restriction for alpha)"
                                )

                        with fragment.li(class_="flex items-start gap-2"):
                            with fragment.span(class_="text-base-content/60"):
                                fragment.text("• New admin must be verified")

                        with fragment.li(class_="flex items-start gap-2"):
                            with fragment.span(class_="text-base-content/60"):
                                fragment.text("• At least 2 team members required")

            yield fragment


__all__ = ["TeamSection"]
