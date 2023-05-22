from dataclasses import dataclass
from typing import Tuple
from polar.kit.hook import Hook
from polar.models.pledge import Pledge
from polar.postgres import AsyncSession


@dataclass
class PledgeHook:
    session: AsyncSession
    pledge: Pledge


pledge_created: Hook[PledgeHook] = Hook()
pledge_disputed: Hook[PledgeHook] = Hook()
