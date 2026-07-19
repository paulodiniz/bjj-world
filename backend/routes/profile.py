from fastapi import APIRouter, Cookie, Request
from fastapi.responses import JSONResponse

from services.auth import get_user_by_session
from services.profile import get_profile, save_profile

router = APIRouter()


async def _require_user(session_id: str | None) -> dict | None:
    if not session_id:
        return None
    return await get_user_by_session(session_id)


@router.get("/api/profile")
async def get_user_profile(bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    profile = await get_profile(str(user["id"]))
    return JSONResponse({"profile": profile, "email": user["email"]})


@router.post("/api/profile")
async def update_user_profile(request: Request, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    data = await request.json()
    profile = await save_profile(str(user["id"]), data)
    return JSONResponse({"profile": profile})
