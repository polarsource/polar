import contextlib
from collections.abc import Generator
from typing import Any

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from markupflow import Document
from pydantic import UUID4

from polar.account.repository import AccountRepository
from polar.account.service import account as account_service
from polar.backoffice.document import get_document
from polar.integrations.stripe.service import stripe
from polar.models import User
from polar.models.user import IdentityVerificationStatus
from polar.postgres import AsyncSession, get_db_session
from polar.user.sorting import UserSortProperty

from ..components import button, datatable, description_list, modal
from ..toast import add_toast

router = APIRouter()


@contextlib.contextmanager
def identity_verification_status_badge(
    doc: Document,
    status: IdentityVerificationStatus,
) -> Generator[None]:
    with doc.div(classes="badge"):
        if status == IdentityVerificationStatus.verified:
            doc.attr("class", "badge-success")
        elif status in {
            IdentityVerificationStatus.pending,
            IdentityVerificationStatus.failed,
        }:
            doc.attr("class", "badge-warning")
        else:
            doc.attr("class", "badge-neutral")
        doc.text(status.get_display_name())
    yield


class IdentityVerificationStatusColumn(
    datatable.DatatableAttrColumn[User, UserSortProperty]
):
    def render(self, request: Request, item: User) -> Generator[None] | None:
        doc = get_document(request)
        status = item.identity_verification_status
        with identity_verification_status_badge(doc, status):
            pass
        return None


class IdentityVerificationStatusDescriptionListItem(
    description_list.DescriptionListItem[User]
):
    def render(self, request: Request, item: User) -> Generator[None] | None:
        doc = get_document(request)
        status = item.identity_verification_status
        if item.identity_verification_id is not None:
            with doc.a(
                href=f"https://dashboard.stripe.com/identity/verification-sessions/{item.identity_verification_id}",
                classes="link flex flex-row gap-1",
                target="_blank",
                rel="noopener noreferrer",
            ):
                doc.text(status.get_display_name())
                with doc.div(classes="icon-external-link"):
                    pass
        else:
            doc.text(status.get_display_name())
        return None


@router.api_route(
    "/{id}/delete-stripe", name="accounts:delete-stripe", methods=["GET", "POST"]
)
async def delete_stripe(
    request: Request,
    id: UUID4,
    stripe_account_id: str | None = Form(None),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = AccountRepository.from_session(session)
    account = await repository.get_by_id(id)

    if account is None:
        raise HTTPException(status_code=404)
    assert account.stripe_id

    if request.method == "POST":
        if stripe_account_id != account.stripe_id:
            await add_toast(
                request, "You entered the Stripe Account ID incorrectly", "error"
            )
            return

        if not await stripe.account_exists(account.stripe_id):
            await add_toast(
                request, f"Stripe Account ID {account.stripe_id} doesn't exist", "error"
            )
            return

        await account_service.delete_stripe_account(session, account)

        await add_toast(
            request,
            f"Stripe Connect account with ID {stripe_account_id} has been deleted",
            "success",
        )

        return

    doc = get_document(request)
    with modal(f"Delete Stripe Connect account {account.id}", open=True):
        with doc.div(classes="flex flex-col gap-4"):
            with doc.form(hx_post=str(request.url), hx_target="#modal"):
                with doc.p():
                    with doc.span():
                        doc.text(
                            f"Are you sure you want to delete this Stripe Connect account? Write in {account.stripe_id} below to confirm:"
                        )
                with doc.input(
                    type="text",
                    classes="input",
                    name="stripe_account_id",
                    placeholder=f"{account.stripe_id}",
                ):
                    pass
                with doc.div(classes="modal-action"):
                    with doc.form(method="dialog"):
                        with button(ghost=True):
                            doc.text("Cancel")
                    with doc.input(
                        type="submit", classes="btn btn-primary", value="Delete"
                    ):
                        pass
