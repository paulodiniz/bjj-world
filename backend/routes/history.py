from fastapi import APIRouter, Cookie
from fastapi.responses import JSONResponse

from services.auth import get_user_by_session
from services.history import (
    delete_conversation,
    get_conversation,
    list_conversations,
)

router = APIRouter()


@router.get("/api/conversations")
async def get_conversations(bjj_session: str = Cookie(default=None), anon_session: str = Cookie(default=None)):
    user = await get_user_by_session(bjj_session) if bjj_session else None
    if user:
        convs = await list_conversations(user_id=str(user["id"]))
    elif anon_session:
        convs = await list_conversations(anon_session_id=anon_session)
    else:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    return JSONResponse({"conversations": convs})


@router.get("/api/conversations/{conv_id}")
async def get_conversation_detail(conv_id: str, bjj_session: str = Cookie(default=None), anon_session: str = Cookie(default=None)):
    user = await get_user_by_session(bjj_session) if bjj_session else None
    if user:
        conv = await get_conversation(conv_id, user_id=str(user["id"]))
    elif anon_session:
        conv = await get_conversation(conv_id, anon_session_id=anon_session)
    else:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if not conv:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse(conv)


@router.delete("/api/conversations/{conv_id}")
async def remove_conversation(conv_id: str, bjj_session: str = Cookie(default=None), anon_session: str = Cookie(default=None)):
    user = await get_user_by_session(bjj_session) if bjj_session else None
    if user:
        deleted = await delete_conversation(conv_id, user_id=str(user["id"]))
    elif anon_session:
        deleted = await delete_conversation(conv_id, anon_session_id=anon_session)
    else:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if not deleted:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return JSONResponse({"ok": True})
