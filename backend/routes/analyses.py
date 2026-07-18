from fastapi import APIRouter, Cookie
from fastapi.responses import JSONResponse

from services.auth import get_user_by_session
from services.analyses import delete_analysis, get_analysis, list_analyses

router = APIRouter()


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


@router.delete("/api/analyses/{analysis_id}")
async def remove_analysis(analysis_id: str, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    deleted = await delete_analysis(analysis_id, str(user["id"]))
    if not deleted:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse({"ok": True})
