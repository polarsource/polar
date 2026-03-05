from fastapi import Query, Response
from polar.routing import APIRouter
from polar.openapi import APITag

router = APIRouter(prefix="/embed", tags=["embed"])

@router.get(
    "/trust-badge.svg",
    summary="Get Polar Trust Badge",
    tags=[APITag.public],
)
async def get_trust_badge_svg(
    theme: str = Query("dark", enum=["light", "dark", "glass"]),
) -> Response:
    # Colors and styles based on theme
    if theme == "light":
        bg_color = "white"
        text_color = "black"
        border_color = "#E5E7EB"
    elif theme == "glass":
        bg_color = "rgba(255, 255, 255, 0.1)"
        text_color = "white"
        border_color = "rgba(255, 255, 255, 0.2)"
    else: # dark
        bg_color = "black"
        text_color = "white"
        border_color = "#1F2937"

    # Minimal logic to emulate the React component
    svg_content = f"""<svg width="250" height="40" viewBox="0 0 250 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="248" height="38" x="1" y="1" rx="19" fill="{bg_color}" stroke="{border_color}" stroke-width="1"/>
        <!-- Polar Logo Paths from React Component -->
        <g transform="translate(12, 10) scale(0.7)">
            <path d="M9.07727 23.0572C13.8782 26.307 20.4046 25.0496 23.6545 20.2487C26.9043 15.4478 25.6469 8.92133 20.846 5.67149C16.0451 2.42165 9.51862 3.67905 6.26878 8.47998C3.01894 13.2809 4.27634 19.8073 9.07727 23.0572ZM10.4703 23.1428C14.862 25.3897 20.433 23.2807 22.9135 18.4322C25.394 13.5838 23.8447 7.83194 19.4531 5.58511C15.0614 3.33829 9.49042 5.4473 7.00991 10.2957C4.52939 15.1442 6.07867 20.896 10.4703 23.1428Z" fill="{text_color}"/>
            <path d="M11.7222 24.2898C15.6865 25.58 20.35 22.1715 22.1385 16.6765C23.927 11.1815 22.1632 5.68099 18.1989 4.39071C14.2346 3.10043 9.5711 6.509 7.78261 12.004C5.99412 17.4989 7.75793 22.9995 11.7222 24.2898ZM12.9347 23.872C16.2897 24.5876 19.9174 20.9108 21.0374 15.6596C22.1574 10.4084 20.3457 5.57134 16.9907 4.85575C13.6357 4.14016 10.008 7.817 8.88797 13.0682C7.76793 18.3194 9.57971 23.1564 12.9347 23.872Z" fill="{text_color}"/>
            <path d="M13.8537 24.7382C16.5062 25.0215 19.1534 20.5972 19.7664 14.8563C20.3794 9.1155 18.7261 4.23202 16.0736 3.94879C13.4211 3.66556 10.7739 8.08983 10.1609 13.8307C9.54788 19.5715 11.2012 24.455 13.8537 24.7382ZM15.0953 22.9906C17.015 22.9603 18.5101 19.0742 18.4349 14.3108C18.3596 9.54747 16.7424 5.71058 14.8228 5.7409C12.9032 5.77123 11.408 9.6573 11.4833 14.4207C11.5585 19.184 13.1757 23.0209 15.0953 22.9906Z" fill="{text_color}"/>
        </g>
        <text x="38" y="24" fill="{text_color}" style="font-family: sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Verified by Polar</text>
        <line x1="145" y1="14" x2="145" y2="26" stroke="{text_color}" stroke-opacity="0.4"/>
        <text x="152" y="24" fill="{text_color}" fill-opacity="0.8" style="font-family: sans-serif; font-size: 10px;">Sales Tax &amp; VAT Handled</text>
    </svg>"""

    return Response(content=svg_content, media_type="image/svg+xml")
