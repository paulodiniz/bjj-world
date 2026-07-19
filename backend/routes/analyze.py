import asyncio
import json
import os
import re
import time
from collections import defaultdict

from anthropic import AsyncAnthropic
from fastapi import APIRouter, Cookie, Request, UploadFile, File
from fastapi.responses import StreamingResponse

import services.rag as _rag
from services.analyses import save_analysis
from services.auth import get_user_by_session
from services.rag import retrieve
from services.video import extract_frames, format_timestamp

router = APIRouter()
anthropic = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Stricter limiter: 3 video analyses per IP per hour
_analysis_hits: dict[str, list[float]] = defaultdict(list)
_ANALYSIS_LIMIT = 3
_ANALYSIS_WINDOW = 3600

TECHNIQUE_TYPES = {"position", "submission", "sweep", "guard_pass", "takedown", "escape", "counter"}


def _is_analysis_limited(ip: str) -> bool:
    now = time.time()
    hits = [t for t in _analysis_hits[ip] if now - t < _ANALYSIS_WINDOW]
    if len(hits) >= _ANALYSIS_LIMIT:
        return True
    hits.append(now)
    _analysis_hits[ip] = hits
    return False


def _build_vision_content(frames: list[dict], title: str, duration_secs: int) -> list[dict]:
    known_techniques = ", ".join(
        c["name"] for c in _rag.rag_chunks if c["type"] in TECHNIQUE_TYPES
    )[:2000]

    content = []
    for frame in frames:
        content.append({"type": "text", "text": f"[{frame['label']}]"})
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": frame["data"]},
        })

    frame_count = len(frames)
    content.append({
        "type": "text",
        "text": f"""Video: "{title}" (~{round(duration_secs / 60)} min)

Known BJJ positions and techniques — use these EXACT names whenever you recognise them:
{known_techniques}

Each image is a single frame labeled [M:SS] — use that timestamp exactly.

You are a BJJ analyst. For EACH of the {frame_count} frames above, write one event describing exactly what you see. Do not skip any frame.

For each frame:
- Name the specific BJJ position (use names from the list above when possible)
- Say who holds the position and who is on the receiving end
- If a submission, sweep, pass, or takedown is being attempted, name it
- Use the fighter names from the video title

Rules:
- Never write vague phrases like "grappling continues" or "ground work" — always name the specific position
- Use the EXACT timestamp from the frame label (e.g. [1:20] → timestamp 80)
- Timestamps must be integers (seconds)

Return ONLY valid JSON, no markdown fences:
{{
  "summary": "2-3 sentence factual summary of the match including result if known",
  "fighter_a": "first fighter full name",
  "fighter_b": "second fighter full name",
  "events": [
    {{
      "timestamp": 80,
      "label": "1:20",
      "type": "position|transition|submission_attempt|submission|sweep|guard_pass|takedown|escape",
      "position": "exact name from known list, or null",
      "description": "one sentence: who is where and what is happening"
    }}
  ]
}}

You must produce one event per frame — you have {frame_count} frames so the events array must have exactly {frame_count} entries.""",
    })
    return content


async def _run_analysis(frames: list[dict], title: str):
    vision_content = _build_vision_content(frames, title, len(frames) * 10)
    response = await anthropic.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        messages=[{"role": "user", "content": vision_content}],
    )
    raw = response.content[0].text if response.content else ""
    cleaned = re.sub(r"^```(?:json)?\n?", "", raw, flags=re.MULTILINE)
    cleaned = re.sub(r"\n?```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None, raw


def _sse(type_: str, payload: dict) -> str:
    return f"data: {json.dumps({'type': type_, **payload})}\n\n"


def _get_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host


async def _analyze_stream(frames: list[dict], title: str, collected: dict | None = None):
    if not frames:
        yield _sse("error", {"text": "Could not extract frames from this video."})
        return

    yield _sse("status", {"text": f"Analysing {len(frames)} frames (~1 per 10s)…"})
    result = await _run_analysis(frames, title)

    if isinstance(result, tuple):
        _, raw = result
        yield _sse("analysis-text", {"text": raw})
        return

    events = result.get("events") or [] if result else []
    print(f"[analysis] \"{title}\" → {len(events)} events")

    summary    = result.get("summary", "")
    fighter_a  = result.get("fighter_a", "Fighter A")
    fighter_b  = result.get("fighter_b", "Fighter B")

    yield _sse("analysis-summary", {
        "summary": summary,
        "fighter_a": fighter_a,
        "fighter_b": fighter_b,
    })

    if collected is not None:
        collected["summary"]   = summary
        collected["fighter_a"] = fighter_a
        collected["fighter_b"] = fighter_b

    rag_results = await asyncio.gather(
        *[retrieve(f"{ev.get('position', '')} {ev.get('description', '')}", 3) for ev in events],
        return_exceptions=True,
    )

    for ev, rag in zip(events, rag_results):
        related = []
        if isinstance(rag, list):
            related = [
                {"id": c["id"], "name": c["name"], "type": c["type"]}
                for c in rag if c.get("score", 0) > 0.05
            ]
        event_payload = {
            "timestamp": ev.get("timestamp", 0),
            "label": ev.get("label") or format_timestamp(ev.get("timestamp", 0)),
            "badge": ev.get("type", "position"),
            "description": ev.get("description", ""),
            "related": related,
        }
        if collected is not None:
            collected["events"].append(event_payload)
        yield _sse("analysis-event", event_payload)
        await asyncio.sleep(0.04)

    yield _sse("done", {})


@router.post("/api/analyze-video")
async def analyze_video(request: Request, bjj_session: str = Cookie(default=None)):
    ip = _get_ip(request)
    if _is_analysis_limited(ip):
        return StreamingResponse(
            iter([_sse("error", {"text": "Analysis limit reached. Try again in an hour."})]),
            media_type="text/event-stream",
            status_code=429,
        )

    body = await request.json()
    url: str = body.get("url", "")
    title: str = body.get("title") or url.split("/")[-1].rsplit(".", 1)[0] or "BJJ Match"

    if not url:
        return StreamingResponse(
            iter([_sse("error", {"text": "url is required"})]),
            media_type="text/event-stream",
            status_code=400,
        )

    user = await get_user_by_session(bjj_session) if bjj_session else None
    print(f"ip={ip} analyze-video url={url[:80]!r}")

    async def generate():
        yield _sse("video-info", {"videoId": None, "title": title, "thumbnail": None})
        yield _sse("status", {"text": "Extracting frames from video…"})
        frames = []
        async for frame in extract_frames(url, target_frames=20, is_url=True):
            frames.append(frame)
            yield _sse("frame", {"timestamp": frame["timestamp"], "label": frame["label"], "data": frame["data"]})
        try:
            collected = {"summary": None, "fighter_a": None, "fighter_b": None, "events": []}
            async for chunk in _analyze_stream(frames, title, collected):
                yield chunk
            if user and collected["events"]:
                analysis_id = await save_analysis(
                    str(user["id"]), title,
                    collected["summary"], collected["fighter_a"], collected["fighter_b"],
                    collected["events"],
                )
                yield _sse("analysis_id", {"id": analysis_id})
        except Exception as exc:
            yield _sse("error", {"text": str(exc)})

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/api/analyze-upload")
async def analyze_upload(request: Request, video: UploadFile = File(...), bjj_session: str = Cookie(default=None)):
    ip = _get_ip(request)
    if _is_analysis_limited(ip):
        return StreamingResponse(
            iter([_sse("error", {"text": "Analysis limit reached. Try again in an hour."})]),
            media_type="text/event-stream",
            status_code=429,
        )

    title = re.sub(r"\.[^.]+$", "", video.filename or "") or "BJJ Match"
    size_mb = 0

    import tempfile
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tmp_path = tmp.name
    tmp.close()

    contents = await video.read()
    size_mb = len(contents) / 1e6
    if size_mb > 100:
        os.unlink(tmp_path)
        return StreamingResponse(
            iter([_sse("error", {"text": "File too large. Maximum upload size is 100 MB."})]),
            media_type="text/event-stream",
            status_code=413,
        )

    with open(tmp_path, "wb") as f:
        f.write(contents)

    user = await get_user_by_session(bjj_session) if bjj_session else None
    print(f"ip={ip} analyze-upload \"{video.filename}\" {size_mb:.1f}MB")

    async def generate():
        try:
            yield _sse("video-info", {"videoId": None, "title": title, "thumbnail": None})
            yield _sse("status", {"text": "Extracting frames…"})
            frames = []
            async for frame in extract_frames(tmp_path, target_frames=20, is_url=False):
                frames.append(frame)
                yield _sse("frame", {"timestamp": frame["timestamp"], "label": frame["label"], "data": frame["data"]})
            collected = {"summary": None, "fighter_a": None, "fighter_b": None, "events": []}
            async for chunk in _analyze_stream(frames, title, collected):
                yield chunk
            if user and collected["events"]:
                analysis_id = await save_analysis(
                    str(user["id"]), title,
                    collected["summary"], collected["fighter_a"], collected["fighter_b"],
                    collected["events"],
                )
                yield _sse("analysis_id", {"id": analysis_id})
        except Exception as exc:
            yield _sse("error", {"text": str(exc)})
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return StreamingResponse(generate(), media_type="text/event-stream")
