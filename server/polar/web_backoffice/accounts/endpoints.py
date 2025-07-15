import contextlib
from collections.abc import Generator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import UUID4
from tagflow import classes, tag, text

from polar.account.repository import AccountRepository
from polar.account.service import account as account_service
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
    status: IdentityVerificationStatus,
) -> Generator[None]:
    with tag.div(classes="badge"):
        if status == IdentityVerificationStatus.verified:
            classes("badge-success")
        elif status in {
            IdentityVerificationStatus.pending,
            IdentityVerificationStatus.failed,
        }:
            classes("badge-warning")
        else:
            classes("badge-neutral")
        text(status.get_display_name())
    yield


class IdentityVerificationStatusColumn(
    datatable.DatatableAttrColumn[User, UserSortProperty]
):
    def render(self, request: Request, item: User) -> Generator[None] | None:
        status = item.identity_verification_status
        with identity_verification_status_badge(status):
            pass
        return None


class IdentityVerificationStatusDescriptionListItem(
    description_list.DescriptionListItem[User]
):
    def render(self, request: Request, item: User) -> Generator[None] | None:
        status = item.identity_verification_status
        if item.identity_verification_id is not None:
            with tag.a(
                href=f"https://dashboard.stripe.com/identity/verification-sessions/{item.identity_verification_id}",
                classes="link flex flex-row gap-1",
                target="_blank",
                rel="noopener noreferrer",
            ):
                text(status.get_display_name())
                with tag.div(classes="icon-external-link"):
                    pass
        else:
            text(status.get_display_name())
        return None


@router.api_route("/{id}/delete", name="accounts:delete", methods=["GET", "POST"])
async def delete(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = AccountRepository.from_session(session)
    account = await repository.get_by_id(id)

    if account is None:
        raise HTTPException(status_code=404)

    if request.method == "POST":
        if account.stripe_id:
            await stripe.delete_account(account.stripe_id)
            await add_toast(
                request,
                f"Stripe Connect account with ID {account.stripe_id} has been deleted",
                "success",
            )

        await account_service.delete(session, account)
        await add_toast(
            request,
            f"Account with ID {account.id} has been deleted",
            "success",
        )

        return

    with modal(f"Delete Stripe Account {account.id}", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p():
                text("Are you sure you want to delete this account? ")
            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="button",
                    variant="primary",
                    hx_post=str(request.url),
                    hx_target="#modal",
                ):
                    text("Delete")
