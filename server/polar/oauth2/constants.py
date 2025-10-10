from polar.config import settings

from .sub_type import SubType

CLIENT_ID_PREFIX = "polar_ci_"
CLIENT_SECRET_PREFIX = "polar_cs_"
CLIENT_REGISTRATION_TOKEN_PREFIX = "polar_crt_"
AUTHORIZATION_CODE_PREFIX = "polar_ac_"
ACCESS_TOKEN_PREFIX: dict[SubType, str] = {
    SubType.user: "polar_at_u_",
    SubType.organization: "polar_at_o_",
}
REFRESH_TOKEN_PREFIX: dict[SubType, str] = {
    SubType.user: "polar_rt_u_",
    SubType.organization: "polar_rt_o_",
}
WEBHOOK_SECRET_PREFIX = "polar_whs_"

ISSUER = "https://polar.sh"
SERVICE_DOCUMENTATION = "https://polar.sh/docs"
SUBJECT_TYPES_SUPPORTED = ["public"]
ID_TOKEN_SIGNING_ALG_VALUES_SUPPORTED = ["RS256"]
CLAIMS_SUPPORTED = ["sub", "name", "email", "email_verified"]

JWT_CONFIG = {
    "key": settings.JWKS.find_by_kid(settings.CURRENT_JWK_KID),
    "alg": "RS256",
    "iss": ISSUER,
    "exp": 3600,
}


def is_registration_token_prefix(value: str) -> bool:
    return value.startswith(CLIENT_REGISTRATION_TOKEN_PREFIX)
