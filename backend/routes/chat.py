import asyncio
import json
import os
import time
import uuid
from collections import defaultdict

import httpx
from anthropic import AsyncAnthropic
from fastapi import APIRouter, Cookie, Request
from fastapi.responses import StreamingResponse

from services.auth import get_user_by_session
from services.history import (
    conversation_belongs_to_anon,
    conversation_belongs_to_user,
    create_conversation,
    save_messages,
)
from services.profile import get_profile, build_profile_context
from services.graph_context import build_graph_context
from services.rag import retrieve

router = APIRouter()
anthropic = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

# Rate limiter: 20 requests per IP per hour
_rate_hits: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 20
_RATE_WINDOW = 3600


def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    hits = [t for t in _rate_hits[ip] if now - t < _RATE_WINDOW]
    if len(hits) >= _RATE_LIMIT:
        return True
    hits.append(now)
    _rate_hits[ip] = hits
    return False


_video_cache: dict[str, str | None] = {}


async def _search_youtube(technique: str) -> str | None:
    query = f"{technique} BJJ tutorial"
    key = query.lower()
    if key in _video_cache:
        return _video_cache[key]
    if not YOUTUBE_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={"q": query, "type": "video", "part": "snippet", "maxResults": 1, "key": YOUTUBE_API_KEY},
            )
            data = resp.json()
        video_id = data.get("items", [{}])[0].get("id", {}).get("videoId")
        result = f"https://www.youtube.com/watch?v={video_id}" if video_id else None
    except Exception:
        result = None
    _video_cache[key] = result
    return result


async def _stream_answer(question: str, chunks: list[dict], history: list[dict], profile_ctx: str = "", graph_ctx: str = ""):
    context = "\n\n---\n\n".join(c["text"] for c in chunks)
    user_content = f"Question: {question}\n\nRelevant BJJ knowledge:\n{context}"
    if graph_ctx:
        user_content += f"\n\n{graph_ctx}"
    messages = [
        *history,
        {"role": "user", "content": user_content},
    ]
    system = (
        "You are a helpful BJJ coach embedded in an app that automatically shows relevant YouTube videos "
        "alongside your answers. Never say you cannot show videos — the app handles that. "
        "Answer questions clearly and concisely based on the knowledge provided. Focus on practical advice."
        + profile_ctx
    )
    async with anthropic.messages.stream(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system,
        messages=messages,
    ) as stream:
        async for event in stream:
            if event.type == "content_block_delta" and event.delta.type == "text_delta":
                yield event.delta.text


def _sse(type_: str, payload: dict) -> str:
    return f"data: {json.dumps({'type': type_, **payload})}\n\n"


@router.post("/api/chat")
async def chat(request: Request, bjj_session: str = Cookie(default=None), anon_session: str = Cookie(default=None)):
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host
    if _is_rate_limited(ip):
        return StreamingResponse(
            iter([_sse("error", {"text": "Too many requests. Try again later."})]),
            media_type="text/event-stream",
            status_code=429,
        )

    body = await request.json()
    question: str = body.get("question", "")
    history: list[dict] = body.get("history", [])
    conversation_id: str | None = body.get("conversation_id")

    if not question:
        return StreamingResponse(
            iter([_sse("error", {"text": "question is required"})]),
            media_type="text/event-stream",
            status_code=400,
        )

    user = await get_user_by_session(bjj_session) if bjj_session else None
    profile_ctx = ""
    if user:
        profile = await get_profile(str(user["id"]))
        profile_ctx = build_profile_context(profile)

    # Generate anon session if user is not logged in and has no session yet
    new_anon_session: str | None = None
    if not user and not anon_session:
        anon_session = str(uuid.uuid4())
        new_anon_session = anon_session

    print(f"ip={ip} user={user['email'] if user else 'anon'} question={question!r}")

    async def generate():
        import re as _re

        # Video-only shortcut (no conversation saved for these)
        is_video_request = bool(_re.search(r"\b(video|videos|watch|youtube)\b", question, _re.IGNORECASE))
        last_assistant = next((m for m in reversed(history) if m["role"] == "assistant"), None)
        if is_video_request and YOUTUBE_API_KEY and last_assistant:
            yield _sse("status", {"text": "Finding videos..."})
            chunks = await retrieve(last_assistant["content"], 3)
            videos = []
            for c in chunks:
                url = await _search_youtube(c["name"])
                if url:
                    videos.append({"name": c["name"], "url": url})
            if videos:
                yield _sse("videos", {"videos": videos})
            msg = "Here are some videos for the techniques we discussed." if videos else "Sorry, I couldn't find videos right now."
            yield _sse("token", {"text": msg})
            yield _sse("done", {})
            return

        # Resolve or create conversation
        conv_id = conversation_id
        title = question[:80] + ("…" if len(question) > 80 else "")
        if user:
            if conv_id and not await conversation_belongs_to_user(conv_id, str(user["id"])):
                conv_id = None
            if not conv_id:
                conv_id = await create_conversation(title, user_id=str(user["id"]))
            yield _sse("conversation_id", {"id": conv_id})
        elif anon_session:
            if conv_id and not await conversation_belongs_to_anon(conv_id, anon_session):
                conv_id = None
            if not conv_id:
                conv_id = await create_conversation(title, anon_session_id=anon_session)
            yield _sse("conversation_id", {"id": conv_id})

        yield _sse("status", {"text": "Searching knowledge base..."})
        chunks, graph_ctx = await asyncio.gather(
            retrieve(question),
            build_graph_context(question),
        )

        yield _sse("status", {"text": "Answering..."})
        full_text = ""
        async for token in _stream_answer(question, chunks, history, profile_ctx, graph_ctx):
            full_text += token
            yield _sse("token", {"text": token})

        if YOUTUBE_API_KEY and full_text:
            answer_chunks = await retrieve(full_text, 2)
            videos = []
            for c in answer_chunks:
                url = await _search_youtube(c["name"])
                if url:
                    videos.append({"name": c["name"], "url": url})
            if videos:
                yield _sse("videos", {"videos": videos})

        yield _sse("done", {})

        if conv_id and full_text:
            await save_messages(conv_id, question, full_text)

    response = StreamingResponse(generate(), media_type="text/event-stream")
    if new_anon_session:
        response.set_cookie(
            "anon_session", new_anon_session,
            max_age=365 * 86400,
            httponly=True,
            secure=True,
            samesite="lax",
            path="/",
        )
    return response
