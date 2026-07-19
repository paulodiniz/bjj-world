import os

from fastapi import APIRouter, Cookie, Request
from fastapi.responses import JSONResponse

from services.auth import get_user_by_session
from services.analyses import (
    delete_analysis,
    disable_sharing,
    enable_sharing,
    get_analysis,
    get_analysis_by_token,
    list_analyses,
    save_notes,
)

router = APIRouter()

APP_URL = os.getenv("APP_URL", "https://tapcodex.app")


async def _require_user(session_id: str | None) -> dict | None:
    if not session_id:
        return None
    return await get_user_by_session(session_id)


@router.get("/api/analyses")
async def get_analyses(bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    items = await list_analyses(str(user["id"]))
    return JSONResponse({"analyses": items})


@router.get("/api/analyses/{analysis_id}")
async def get_analysis_detail(analysis_id: str, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    analysis = await get_analysis(analysis_id, str(user["id"]))
    if not analysis:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse(analysis)


@router.post("/api/analyses/{analysis_id}/notes")
async def save_analysis_notes(
    analysis_id: str,
    request: Request,
    bjj_session: str = Cookie(default=None),
):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    body = await request.json()
    ok = await save_notes(
        analysis_id, str(user["id"]),
        body.get("global_note"),
        body.get("event_notes") or {},
    )
    if not ok:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse({"ok": True})


@router.post("/api/analyses/{analysis_id}/share")
async def share_analysis(analysis_id: str, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    token = await enable_sharing(analysis_id, str(user["id"]))
    if not token:
        return JSONResponse({"error": "Not found"}, status_code=404)
    share_url = f"{APP_URL}/s/{token}"
    return JSONResponse({"share_url": share_url, "token": token})


@router.delete("/api/analyses/{analysis_id}/share")
async def unshare_analysis(analysis_id: str, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    ok = await disable_sharing(analysis_id, str(user["id"]))
    if not ok:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse({"ok": True})


@router.get("/api/share/{token}")
async def get_shared_analysis(token: str):
    analysis = await get_analysis_by_token(token)
    if not analysis:
        return JSONResponse({"error": "Not found or sharing disabled"}, status_code=404)
    return JSONResponse(analysis)


@router.delete("/api/analyses/{analysis_id}")
async def remove_analysis(analysis_id: str, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    deleted = await delete_analysis(analysis_id, str(user["id"]))
    if not deleted:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse({"ok": True})
