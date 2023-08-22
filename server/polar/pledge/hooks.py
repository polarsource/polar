from dataclasses import dataclass

from polar.kit.hook import Hook
from polar.models.pledge import Pledge
from polar.models.pledge_transaction import PledgeTransaction
from polar.postgres import AsyncSession


@dataclass
class PledgeHook:
    session: AsyncSession
    pledge: Pledge


@dataclass
class PledgePaidHook:
    session: AsyncSession
    pledge: Pledge
    transaction: PledgeTransaction


# pledge_created fires when the pledge state is set to created
# (not the same as created in the initiated state)
pledge_created: Hook[PledgeHook] = Hook()
pledge_disputed: Hook[PledgeHook] = Hook()
pledge_updated: Hook[PledgeHook] = Hook()
