from fastapi import APIRouter

from polar.integrations.github.endpoints import router as github_router

from .v1.issue import router as issue_router
from .v1.pull_request import router as pull_request_router
from .v1.reward import router as reward_router
from .v1.stream import router as stream_router
from .v1.user import router as user_router
from .v1.user_organization import router as user_organization_router

router = APIRouter(prefix="/api/v1")
router.include_router(user_router, prefix="/users", tags=["users"])
router.include_router(
    user_organization_router, prefix="/user/organizations", tags=["user.organizations"]
)
router.include_router(
    github_router, prefix="/integrations/github", tags=["integrations"]
)
router.include_router(
    pull_request_router, prefix="/pull_requests", tags=["pull_requests"]
)
router.include_router(issue_router, prefix="/issues", tags=["issues"])
router.include_router(reward_router, prefix="/rewards", tags=["rewards"])
router.include_router(stream_router, prefix="/stream", tags=["stream"])
