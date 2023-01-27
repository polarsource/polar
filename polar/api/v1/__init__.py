from fastapi import APIRouter

from polar.api.v1.demo import router as demo_router

router = APIRouter(prefix="/v1")
router.include_router(demo_router)
