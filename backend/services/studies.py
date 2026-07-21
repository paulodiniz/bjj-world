import json
import os

import asyncpg
import httpx
from anthropic import AsyncAnthropic

_pool: asyncpg.Pool | None = None
_anthropic = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"))
    return _pool


async def init_db() -> None:
    pool = await _get_pool()
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS studies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            goal TEXT NOT NULL,
            youtube_url TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS study_improvements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            study_id UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0
        )
    """)
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS studies_user_idx ON studies(user_id, created_at DESC)"
    )


async def _fetch_youtube_title(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                "https://www.youtube.com/oembed",
                params={"url": url, "format": "json"},
            )
            if r.status_code == 200:
                return r.json().get("title")
    except Exception:
        pass
    return None


async def _generate_improvements(goal: str, youtube_url: str | None, count: int) -> list[dict]:
    video_ctx = ""
    if youtube_url:
        title = await _fetch_youtube_title(youtube_url)
        if title:
            video_ctx = f'\nThe student also attached this YouTube resource: "{title}". Factor it into suggestions where relevant.'
        else:
            video_ctx = f"\nThe student also attached a YouTube resource: {youtube_url}"

    prompt = (
        f'You are a BJJ coach. A student has set this study goal: "{goal}".{video_ctx}\n\n'
        f"Generate exactly {count} concrete improvement areas. Each should be specific and actionable. "
        "An improvement can cover multiple angles — for example, if the goal is closed guard, "
        '"Scissor sweep variations" and "Breaking closed guard posture" are both valid improvements.\n\n'
        f'Return a JSON array of exactly {count} objects, each with:\n'
        '- "title": short name (5-8 words)\n'
        '- "description": 2-3 sentences on what to drill and why it matters for this goal\n\n'
        "Return ONLY the JSON array, no markdown, no other text."
    )

    message = await _anthropic.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    items = json.loads(text)
    return [{"title": str(i["title"]), "description": str(i["description"])} for i in items[:count]]


async def create_study(user_id: str, goal: str, youtube_url: str | None, count: int = 3) -> dict:
    count = max(1, min(5, count))
    improvements = await _generate_improvements(goal, youtube_url, count)

    pool = await _get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "INSERT INTO studies (user_id, goal, youtube_url) VALUES ($1, $2, $3) RETURNING id",
                user_id, goal, youtube_url,
            )
            study_id = str(row["id"])
            for i, imp in enumerate(improvements):
                await conn.execute(
                    "INSERT INTO study_improvements (study_id, title, description, position) VALUES ($1, $2, $3, $4)",
                    study_id, imp["title"], imp["description"], i,
                )

    return await get_study(study_id, user_id)


async def list_studies(user_id: str) -> list[dict]:
    pool = await _get_pool()
    rows = await pool.fetch(
        "SELECT id, goal, youtube_url, created_at FROM studies WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
        user_id,
    )
    return [
        {"id": str(r["id"]), "goal": r["goal"], "youtube_url": r["youtube_url"], "created_at": r["created_at"].isoformat()}
        for r in rows
    ]


async def get_study(study_id: str, user_id: str) -> dict | None:
    pool = await _get_pool()
    study = await pool.fetchrow(
        "SELECT * FROM studies WHERE id = $1 AND user_id = $2",
        study_id, user_id,
    )
    if not study:
        return None
    improvements = await pool.fetch(
        "SELECT id, title, description FROM study_improvements WHERE study_id = $1 ORDER BY position",
        study_id,
    )
    return {
        "id": str(study["id"]),
        "goal": study["goal"],
        "youtube_url": study["youtube_url"],
        "created_at": study["created_at"].isoformat(),
        "improvements": [{"id": str(r["id"]), "title": r["title"], "description": r["description"]} for r in improvements],
    }


async def delete_study(study_id: str, user_id: str) -> bool:
    pool = await _get_pool()
    result = await pool.execute(
        "DELETE FROM studies WHERE id = $1 AND user_id = $2",
        study_id, user_id,
    )
    return result.endswith("1")
