"""Team section with member management."""

import contextlib
from collections.abc import Generator

from fastapi import Request

from polar.models import Organization, User

from ....components import action_bar, button, card
from polar.backoffice.document import get_document


class TeamSection:
    """Render the team section with member management."""

    def __init__(self, organization: Organization, admin_user: User | None = None):
        self.org = organization
        self.admin_user = admin_user

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:

        
        """Render the team section."""

        with doc.div(classes="space-y-6"):
            # Team overview card
            with card(bordered=True):
                with doc.div(classes="mb-4"):
                    with doc.h2(classes="text-lg font-bold"):
                        doc.text("Team Members")

                # Members list
                if hasattr(self.org, "members") and self.org.members:
                    with doc.div(classes="space-y-3"):
                        for member in self.org.members:
                            with doc.div(
                                classes="flex items-center justify-between p-4 border border-base-300 rounded-lg hover:bg-base-50"
                            ):
                                # Member info
                                with doc.div(classes="flex items-center gap-4 flex-1"):
                                    # Avatar placeholder
                                    with doc.div(
                                        classes="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
                                    ):
                                        with doc.span(classes="text-primary font-bold"):
                                            doc.text(
                                                member.user.email[0].upper()
                                                if member.user.email
                                                else "?"
                                            )

                                    with doc.div():
                                        with doc.div(classes="font-semibold"):
                                            doc.text(member.user.email or "Unknown")
                                        with doc.div(
                                            classes="text-sm text-base-content/60"
                                        ):
                                            is_admin = (
                                                self.admin_user
                                                and member.user_id == self.admin_user.id
                                            )
                                            role_text = (
                                                "Admin" if is_admin else "Member"
                                            )
                                            doc.text(
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
                                        doc.text("Impersonate")

                                    with doc.div(classes="dropdown dropdown-end"):
                                        with doc.button(
                                            classes="btn btn-ghost btn-sm",
                                            **{
                                                "aria-label": "More options",
                                                "tabindex": "0",
                                            },
                                        ):
                                            doc.text("⋮")
                                        with doc.ul(
                                            classes="dropdown-content menu shadow bg-base-100 rounded-box w-52 z-10",
                                            **{"tabindex": "0"},
                                        ):
                                            member_is_admin = (
                                                self.admin_user
                                                and member.user_id == self.admin_user.id
                                            )
                                            if not member_is_admin:
                                                with doc.li():
                                                    with doc.a(
                                                        hx_post=str(
                                                            request.url_for(
                                                                "organizations-v2:make_admin",
                                                                organization_id=self.org.id,
                                                                user_id=member.user_id,
                                                            )
                                                        ),
                                                        hx_confirm="Make this user an admin?",
                                                    ):
                                                        doc.text("Make Admin")
                                            with doc.li():
                                                with doc.a(
                                                    hx_delete=str(
                                                        request.url_for(
                                                            "organizations-v2:remove_member",
                                                            organization_id=self.org.id,
                                                            user_id=member.user_id,
                                                        )
                                                    ),
                                                    hx_confirm="Remove this member?",
                                                    classes="text-error",
                                                ):
                                                    doc.text("Remove Member")
                else:
                    with doc.div(classes="text-center py-8 text-base-content/60"):
                        doc.text("No team members found")

            # Admin change requirements (if applicable)
            if hasattr(self.org, "account") and self.org.account:
                with card(bordered=True):
                    with doc.h3(classes="text-md font-bold mb-3"):
                        doc.text("Admin Change Requirements")

                    with doc.ul(classes="space-y-2 text-sm"):
                        with doc.li(classes="flex items-start gap-2"):
                            with doc.span(classes="text-base-content/60"):
                                doc.text(
                                    "• No Stripe account connected (restriction for alpha)"
                                )

                        with doc.li(classes="flex items-start gap-2"):
                            with doc.span(classes="text-base-content/60"):
                                doc.text("• New admin must be verified")

                        with doc.li(classes="flex items-start gap-2"):
                            with doc.span(classes="text-base-content/60"):
                                doc.text("• At least 2 team members required")

            yield


__all__ = ["TeamSection"]
