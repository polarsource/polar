from polar.routing import APIRouter

router = APIRouter()


@router.get("/")
def get() -> dict[str, str]:
    return {
        "message": """
            Hello, World! This is the Polar API.

            For more information, please visit the documentation at: https://docs.polar.sh/
        """
    }
