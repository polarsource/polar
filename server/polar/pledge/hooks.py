from dataclasses import dataclass
from typing import Tuple
from polar.kit.hook import Hook
from polar.models.pledge import Pledge
from polar.postgres import AsyncSession


@dataclass
class PledgeHook:
    session: AsyncSession
    pledge: Pledge


# pledge_created fires when the pledge state is set to created
# (not the same as created in the initiated state)
pledge_created: Hook[PledgeHook] = Hook()
pledge_disputed: Hook[PledgeHook] = Hook()
pledge_updated: Hook[PledgeHook] = Hook()
