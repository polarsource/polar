from dateutil.relativedelta import relativedelta
from fastapi import Depends, Query
from pydantic import AwareDatetime

from polar.declarative_config.schemas import Config
from polar.declarative_config.service import ConfigAsCodeNotEnabled
from polar.exceptions import NotPermitted, PolarRequestValidationError, Unauthorized
from polar.kit.utils import utc_now
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
    since: AwareDatetime | None = Query(
        None, description="Start of the window. Defaults to one month before `until`."
    ),
    until: AwareDatetime | None = Query(
        None, description="End of the window. Defaults to now."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[SimulationResult]:
    """
    Replay the subscription orders billed in a window at the prices of a
    declarative config document, without applying it.

    Each order item counts for the share of its billing period inside the window.
    Subscribers are grouped into cohorts by the price they were billed on. Changes
    the simulation can't reprice are listed in `not_simulated`.
    """
    until = until or utc_now()
    since = since or until - relativedelta(months=1)
    if since >= until or since < until - relativedelta(years=2):
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("query",),
                    "msg": "since must be before until, at most two years apart.",
                    "type": "value_error",
                    "input": (since, until),
                }
            ]
        )
    return await pricing_simulation_service.simulate(
        session, auth_subject, config, since, until
    )
