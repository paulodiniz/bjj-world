from fastapi import APIRouter, Cookie, Request
from fastapi.responses import JSONResponse

from services.auth import get_user_by_session
from services.studies import create_study, delete_study, get_study, list_studies

router = APIRouter()


async def _require_user(session_id: str | None) -> dict | None:
    if not session_id:
        return None
    return await get_user_by_session(session_id)


@router.get("/api/studies")
async def get_studies(bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    items = await list_studies(str(user["id"]))
    return JSONResponse({"studies": items})


@router.post("/api/studies")
async def post_study(request: Request, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    goal: str = (body.get("goal") or "").strip()
    if not goal:
        return JSONResponse({"error": "goal is required"}, status_code=400)

    youtube_url: str | None = (body.get("youtube_url") or "").strip() or None
    count: int = int(body.get("count") or 3)

    try:
        study = await create_study(str(user["id"]), goal, youtube_url, count)
    except Exception as e:
        print(f"study generation error: {e}")
        return JSONResponse({"error": "Failed to generate improvements. Try again."}, status_code=500)

    return JSONResponse(study, status_code=201)


@router.get("/api/studies/{study_id}")
async def get_study_detail(study_id: str, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    study = await get_study(study_id, str(user["id"]))
    if not study:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse(study)


@router.delete("/api/studies/{study_id}")
async def remove_study(study_id: str, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    deleted = await delete_study(study_id, str(user["id"]))
    if not deleted:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse({"ok": True})
