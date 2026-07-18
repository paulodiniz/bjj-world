from fastapi import APIRouter, Cookie
from fastapi.responses import JSONResponse

from services.auth import get_user_by_session
from services.history import (
    delete_conversation,
    get_conversation,
    list_conversations,
)

router = APIRouter()


async def _require_user(session_id: str | None) -> dict | None:
    if not session_id:
        return None
    return await get_user_by_session(session_id)


@router.get("/api/conversations")
async def get_conversations(bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    convs = await list_conversations(str(user["id"]))
    return JSONResponse({"conversations": convs})


@router.get("/api/conversations/{conv_id}")
async def get_conversation_detail(conv_id: str, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    conv = await get_conversation(conv_id, str(user["id"]))
    if not conv:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse(conv)


@router.delete("/api/conversations/{conv_id}")
async def remove_conversation(conv_id: str, bjj_session: str = Cookie(default=None)):
    user = await _require_user(bjj_session)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    deleted = await delete_conversation(conv_id, str(user["id"]))
    if not deleted:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse({"ok": True})
