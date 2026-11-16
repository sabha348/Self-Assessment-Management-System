import hmac

from fastapi import Depends, Header, HTTPException, status

from .config import Settings, get_settings


def require_service_token(
    x_service_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    """Service-to-service auth: only the Node backend may call this API.

    End users never talk to this service directly; the backend authenticates
    them (JWT) and passes the verified user_id along.
    """
    if not settings.service_token:
        if settings.allow_no_auth:
            return
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "SERVICE_TOKEN is not configured")
    if not x_service_token or not hmac.compare_digest(x_service_token, settings.service_token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid service token")
