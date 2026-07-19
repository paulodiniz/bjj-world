import json
import os

from anthropic import AsyncAnthropic
from fastapi import APIRouter, Cookie, Request
from fastapi.responses import StreamingResponse

import services.rag as _rag
from services.auth import get_user_by_session

router = APIRouter()
anthropic = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def _sse(type_: str, payload: dict) -> str:
    return f"data: {json.dumps({'type': type_, **payload})}\n\n"


@router.post("/api/prep")
async def class_prep(request: Request, bjj_session: str = Cookie(default=None)):
    user = await get_user_by_session(bjj_session)
    if not user:
        return StreamingResponse(
            iter([_sse("error", {"text": "Sign in required."})]),
            media_type="text/event-stream",
            status_code=401,
        )
    if user.get("plan") != "coach":
        return StreamingResponse(
            iter([_sse("error", {"text": "Class Prep is a coach feature. Upgrade to the Coach plan to access it."})]),
            media_type="text/event-stream",
            status_code=403,
        )

    body = await request.json()
    technique_id: str = body.get("technique_id", "").strip()
    duration: int = int(body.get("duration", 60))

    if not technique_id:
        return StreamingResponse(
            iter([_sse("error", {"text": "Choose a technique to continue."})]),
            media_type="text/event-stream",
            status_code=400,
        )

    name_map = {c["id"]: c["name"] for c in _rag.rag_chunks} if _rag.rag_chunks else {}
    technique_name = name_map.get(technique_id, technique_id.replace("_", " ").title())

    chunks = await _rag.retrieve(technique_name, k=6)
    context = "\n\n---\n\n".join(c["text"] for c in chunks)

    async def generate():
        yield _sse("status", {"text": "Building lesson plan…"})

        system = (
            "You are an expert BJJ coach assistant. Generate concise, mat-ready lesson plans. "
            "Write for the coach, not the student — use second person directed at the coach "
            "('tell students to...', 'watch for...', 'cue: ...'). "
            "Be specific: name grips, angles, body parts. No filler. "
            "Use markdown with ## section headers exactly as instructed."
        )

        prompt = f"""Create a {duration}-minute BJJ class lesson plan for: **{technique_name}**

Relevant knowledge from the BJJ graph:
{context}

Output exactly these three sections with ## headers:

## Technique Breakdown
Concise step-by-step breakdown of the core movement. Cover the setup, key grips/angles, and the finish. 4-6 numbered steps.

## Teaching Cues & Common Mistakes
**Cues** (what to tell students while they drill):
- [4-5 specific, short cues]

**Watch for** (mistakes to correct):
- [3-4 common errors and how to fix each]

## Drilling Sequence
A {duration}-minute progression. Show exact time splits. Be concrete about rep counts, switching, and how drills chain together. End with positional sparring focused on this technique.

Keep every section tight. Coaches are on the mat, not at a desk."""

        async with anthropic.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta" and event.delta.type == "text_delta":
                    yield _sse("token", {"text": event.delta.text})

        yield _sse("done", {})

    return StreamingResponse(generate(), media_type="text/event-stream")
