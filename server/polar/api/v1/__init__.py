from fastapi import APIRouter
from polar.api.v1.demo import router as demo_router
from polar.api.v1.github import router as github_router
from polar.api.v1.issue import router as issue_router
from polar.api.v1.organization import router as user_organization_router
from polar.api.v1.pull_request import router as pull_request_router
from polar.api.v1.stream import router as sse_router
from polar.api.v1.user import router as user_router

router = APIRouter(prefix="/v1")
router.include_router(demo_router)
router.include_router(user_router)
router.include_router(user_organization_router)
router.include_router(github_router)
router.include_router(sse_router)
router.include_router(issue_router)
router.include_router(pull_request_router)
