import os
import re
import time
from collections import defaultdict

from fastapi import APIRouter, Cookie, Request
from fastapi.responses import JSONResponse, RedirectResponse

from services.auth import (
    create_and_send_magic_link,
    delete_session,
    get_user_by_session,
    verify_token,
)

router = APIRouter()

APP_URL = os.getenv("APP_URL") or (
    f"https://{os.getenv('RAILWAY_SERVICE_BJJ_WORLD_URL', 'localhost:3000')}"
)

SESSION_COOKIE = "bjj_session"
SESSION_TTL_DAYS = 30

# Rate limit: 3 magic link requests per email per hour
_email_hits: dict[str, list[float]] = defaultdict(list)
_IP_HITS: dict[str, list[float]] = defaultdict(list)


def _rate_limited(email: str, ip: str) -> bool:
    now = time.time()
    window = 3600
    e_hits = [t for t in _email_hits[email] if now - t < window]
    i_hits = [t for t in _IP_HITS[ip] if now - t < window]
    if len(e_hits) >= 3 or len(i_hits) >= 10:
        return True
    e_hits.append(now)
    i_hits.append(now)
    _email_hits[email] = e_hits
    _IP_HITS[ip] = i_hits
    return False


def _get_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host


@router.post("/api/auth/request")
async def request_magic_link(request: Request):
    body = await request.json()
    email: str = body.get("email", "").lower().strip()

    if not email or not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        return JSONResponse({"error": "Valid email required"}, status_code=400)

    ip = _get_ip(request)
    if _rate_limited(email, ip):
        return JSONResponse({"error": "Too many requests. Try again later."}, status_code=429)

    try:
        await create_and_send_magic_link(email, APP_URL)
    except Exception as exc:
        print(f"[auth] email error: {exc}")
        return JSONResponse({"error": "Failed to send email. Please try again."}, status_code=500)

    return JSONResponse({"ok": True})


@router.get("/api/auth/verify")
async def verify_magic_link(token: str = ""):
    if not token:
        return RedirectResponse("/?auth_error=missing_token", status_code=302)

    session_id = await verify_token(token)
    if not session_id:
        return RedirectResponse("/?auth_error=invalid_token", status_code=302)

    response = RedirectResponse("/?signed_in=1", status_code=302)
    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        max_age=SESSION_TTL_DAYS * 86400,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return response


@router.get("/api/auth/me")
async def get_me(bjj_session: str = Cookie(default=None)):
    user = await get_user_by_session(bjj_session)
    if not user:
        return JSONResponse({"user": None}, status_code=401)
    return JSONResponse({"user": {"email": user["email"], "plan": user["plan"]}})


@router.post("/api/auth/logout")
async def logout(bjj_session: str = Cookie(default=None)):
    await delete_session(bjj_session)
    response = JSONResponse({"ok": True})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response
