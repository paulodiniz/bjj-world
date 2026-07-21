import json
import os

import asyncpg
import httpx
from anthropic import AsyncAnthropic

_pool: asyncpg.Pool | None = None
_anthropic = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
_video_cache: dict[str, str | None] = {}


async def _search_youtube(technique: str) -> str | None:
    query = f"{technique} BJJ tutorial"
    key = query.lower()
    if key in _video_cache:
        return _video_cache[key]
    if not YOUTUBE_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
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
            video_url TEXT,
            position INTEGER NOT NULL DEFAULT 0
        )
    """)
    await pool.execute(
        "ALTER TABLE study_improvements ADD COLUMN IF NOT EXISTS video_url TEXT"
    )
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS study_drills (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            improvement_id UUID NOT NULL REFERENCES study_improvements(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT FALSE,
            completed_at TIMESTAMPTZ,
            position INTEGER NOT NULL DEFAULT 0
        )
    """)
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS studies_user_idx ON studies(user_id, created_at DESC)"
    )
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS study_drills_improvement_idx ON study_drills(improvement_id)"
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


async def _generate_improvements(goal: str, youtube_url: str | None, count: int, user_id: str) -> list[dict]:
    from services.profile import get_profile, build_profile_context
    profile = await get_profile(user_id)
    profile_ctx = build_profile_context(profile)

    video_ctx = ""
    if youtube_url:
        title = await _fetch_youtube_title(youtube_url)
        if title:
            video_ctx = f'\nThe student also attached this YouTube resource: "{title}". Factor it into suggestions where relevant.'
        else:
            video_ctx = f"\nThe student also attached a YouTube resource: {youtube_url}"

    prompt = (
        f'You are a BJJ coach. A student has set this study goal: "{goal}".{video_ctx}{profile_ctx}\n\n'
        f"Generate exactly {count} improvement areas, each with specific practice drills.\n\n"
        f'Return a JSON array of exactly {count} objects, each with:\n'
        '- "title": short name (5-8 words)\n'
        '- "description": 1-2 sentences on what to work on and why it matters\n'
        '- "drills": array of exactly 4 short, specific, completable mat activities. '
        'Each drill is one imperative sentence. Do NOT include any "watch video" or "watch instructional" drills — '
        'video resources are handled separately. '
        'Vary the types across: solo rep drilling, partner reps, positional sparring focus, flow drilling or visualization. '
        '(e.g., "Drill the basic scissor sweep 20 reps each side", '
        '"Try the sweep in positional sparring from closed guard bottom", '
        '"Flow drill the entry sequence for 5 minutes without stopping").\n\n'
        "Return ONLY the JSON array, no markdown, no other text."
    )

    message = await _anthropic.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    items = json.loads(text)
    return [
        {
            "title": str(i["title"]),
            "description": str(i["description"]),
            "drills": [str(d) for d in i.get("drills", [])[:4]],
        }
        for i in items[:count]
    ]


async def create_study(user_id: str, goal: str, youtube_url: str | None, count: int = 3) -> dict:
    count = max(1, min(5, count))
    improvements = await _generate_improvements(goal, youtube_url, count, user_id)

    # Search YouTube for each improvement in parallel
    import asyncio
    video_urls = await asyncio.gather(*[_search_youtube(imp["title"]) for imp in improvements])

    pool = await _get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "INSERT INTO studies (user_id, goal, youtube_url) VALUES ($1, $2, $3) RETURNING id",
                user_id, goal, youtube_url,
            )
            study_id = str(row["id"])
            for i, (imp, video_url_imp) in enumerate(zip(improvements, video_urls)):
                imp_row = await conn.fetchrow(
                    "INSERT INTO study_improvements (study_id, title, description, video_url, position) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                    study_id, imp["title"], imp["description"], video_url_imp, i,
                )
                imp_id = str(imp_row["id"])
                for j, drill_text in enumerate(imp["drills"]):
                    await conn.execute(
                        "INSERT INTO study_drills (improvement_id, text, position) VALUES ($1, $2, $3)",
                        imp_id, drill_text, j,
                    )

    return await get_study(study_id, user_id)


async def list_studies(user_id: str) -> list[dict]:
    pool = await _get_pool()
    study_rows = await pool.fetch(
        "SELECT id, goal, youtube_url, created_at FROM studies WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
        user_id,
    )
    results = []
    for study in study_rows:
        study_id = str(study["id"])
        imp_rows = await pool.fetch(
            "SELECT id, title, description, video_url FROM study_improvements WHERE study_id = $1 ORDER BY position",
            study_id,
        )
        improvements = []
        total_drills = 0
        completed_drills = 0
        for imp in imp_rows:
            drill_rows = await pool.fetch(
                "SELECT id, text, completed FROM study_drills WHERE improvement_id = $1 ORDER BY position",
                imp["id"],
            )
            drills = [{"id": str(d["id"]), "text": d["text"], "completed": d["completed"]} for d in drill_rows]
            total_drills += len(drills)
            completed_drills += sum(1 for d in drills if d["completed"])
            improvements.append({
                "id": str(imp["id"]),
                "title": imp["title"],
                "description": imp["description"],
                "video_url": imp["video_url"],
                "drills": drills,
            })
        results.append({
            "id": study_id,
            "goal": study["goal"],
            "youtube_url": study["youtube_url"],
            "created_at": study["created_at"].isoformat(),
            "total_drills": total_drills,
            "completed_drills": completed_drills,
            "improvements": improvements,
        })
    return results


async def get_study(study_id: str, user_id: str) -> dict | None:
    pool = await _get_pool()
    study = await pool.fetchrow(
        "SELECT * FROM studies WHERE id = $1 AND user_id = $2",
        study_id, user_id,
    )
    if not study:
        return None

    improvements = await pool.fetch(
        "SELECT id, title, description, video_url FROM study_improvements WHERE study_id = $1 ORDER BY position",
        study_id,
    )

    result_improvements = []
    total_drills = 0
    completed_drills = 0

    for imp in improvements:
        drills = await pool.fetch(
            "SELECT id, text, completed FROM study_drills WHERE improvement_id = $1 ORDER BY position",
            imp["id"],
        )
        drill_list = [{"id": str(d["id"]), "text": d["text"], "completed": d["completed"]} for d in drills]
        total_drills += len(drill_list)
        completed_drills += sum(1 for d in drill_list if d["completed"])
        result_improvements.append({
            "id": str(imp["id"]),
            "title": imp["title"],
            "description": imp["description"],
            "video_url": imp["video_url"],
            "drills": drill_list,
        })

    return {
        "id": str(study["id"]),
        "goal": study["goal"],
        "youtube_url": study["youtube_url"],
        "created_at": study["created_at"].isoformat(),
        "total_drills": total_drills,
        "completed_drills": completed_drills,
        "improvements": result_improvements,
    }


async def toggle_drill(study_id: str, drill_id: str, user_id: str, completed: bool) -> bool:
    pool = await _get_pool()
    result = await pool.execute(
        """
        UPDATE study_drills SET
            completed = $1,
            completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END
        WHERE id = $2
        AND improvement_id IN (
            SELECT id FROM study_improvements
            WHERE study_id IN (SELECT id FROM studies WHERE id = $3 AND user_id = $4)
        )
        """,
        completed, drill_id, study_id, user_id,
    )
    return result.endswith("1")


async def delete_study(study_id: str, user_id: str) -> bool:
    pool = await _get_pool()
    result = await pool.execute(
        "DELETE FROM studies WHERE id = $1 AND user_id = $2",
        study_id, user_id,
    )
    return result.endswith("1")
