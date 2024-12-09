from polar.routing import APIRouter

router = APIRouter()


@router.get("/")
async def get() -> dict[str, str]:
    return {
        "message": """Hello, World! Welcome to the Polar API for polar.sh. For more information on endpoints, please visit the documentation at: `https://docs.polar.sh/developers`"""
    }
