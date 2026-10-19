from fastapi import Depends

from polar.declarative_config.schemas import Config
from polar.declarative_config.service import ConfigAsCodeNotEnabled
from polar.exceptions import NotPermitted, Unauthorized
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from .auth import SimulationRead
from .schemas import SimulationResult
from .service import pricing_simulation as pricing_simulation_service

router = APIRouter(prefix="/config", tags=["config", APITag.private])


@router.post(
    "/simulate",
    response_model=list[SimulationResult],
    summary="Simulate Config",
    responses={
        200: {"description": "Simulation computed, one result per currency."},
        401: {"description": "Not authenticated.", "model": Unauthorized.schema()},
        403: {
            "description": (
                "Not allowed to read this organization's products or subscriptions, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
    },
)
async def simulate(
    config: Config,
    auth_subject: SimulationRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[SimulationResult]:
    """
    Show what moving today's subscribers to a declarative config document would
    change in what they pay per month, without applying it.

    Subscribers are grouped into cohorts by the price they pay today. Changes the
    simulation can't reprice are listed in `not_simulated`.
    """
    return await pricing_simulation_service.simulate(session, auth_subject, config)
