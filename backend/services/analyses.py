import json
import os

import asyncpg

_pool: asyncpg.Pool | None = None


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"))
    return _pool


async def init_db() -> None:
    pool = await _get_pool()
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS video_analyses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            summary TEXT,
            fighter_a TEXT,
            fighter_b TEXT,
            events JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS analyses_user_idx ON video_analyses(user_id, created_at DESC)"
    )


async def save_analysis(
    user_id: str,
    title: str,
    summary: str | None,
    fighter_a: str | None,
    fighter_b: str | None,
    events: list[dict],
) -> str:
    pool = await _get_pool()
    row = await pool.fetchrow(
        """INSERT INTO video_analyses (user_id, title, summary, fighter_a, fighter_b, events)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id""",
        user_id, title[:200], summary, fighter_a, fighter_b, json.dumps(events),
    )
    return str(row["id"])


async def list_analyses(user_id: str) -> list[dict]:
    pool = await _get_pool()
    rows = await pool.fetch(
        """SELECT id, title, fighter_a, fighter_b, created_at
           FROM video_analyses WHERE user_id = $1
           ORDER BY created_at DESC LIMIT 50""",
        user_id,
    )
    return [
        {
            "id": str(r["id"]),
            "title": r["title"],
            "fighter_a": r["fighter_a"],
            "fighter_b": r["fighter_b"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


async def get_analysis(analysis_id: str, user_id: str) -> dict | None:
    pool = await _get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM video_analyses WHERE id = $1 AND user_id = $2",
        analysis_id, user_id,
    )
    if not row:
        return None
    return {
        "id": str(row["id"]),
        "title": row["title"],
        "summary": row["summary"],
        "fighter_a": row["fighter_a"],
        "fighter_b": row["fighter_b"],
        "events": json.loads(row["events"]),
        "created_at": row["created_at"].isoformat(),
    }


async def delete_analysis(analysis_id: str, user_id: str) -> bool:
    pool = await _get_pool()
    result = await pool.execute(
        "DELETE FROM video_analyses WHERE id = $1 AND user_id = $2",
        analysis_id, user_id,
    )
    return result.endswith("1")
