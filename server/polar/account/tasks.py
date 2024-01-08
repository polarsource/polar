import uuid

from polar.exceptions import PolarError
from polar.held_transfer.service import held_transfer as held_transfer_service
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service import account as account_service


class AccountTaskError(PolarError):
    ...


class AccountDoesNotExist(AccountTaskError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = f"The account with id {account_id} does not exist."
        super().__init__(message, 500)


@task("account.reviewed")
async def account_reviewed(
    ctx: JobContext, account_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        account = await account_service.get(session, account_id)
        if account is None:
            raise AccountDoesNotExist(account_id)

        await held_transfer_service.release_account(session, account)
