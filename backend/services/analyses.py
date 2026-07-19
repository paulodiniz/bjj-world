import json
import os
import secrets

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
            global_note TEXT,
            event_notes JSONB NOT NULL DEFAULT '{}',
            share_token TEXT UNIQUE,
            is_shared BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    # Migrate existing tables missing the new columns
    for col, definition in [
        ("global_note", "TEXT"),
        ("event_notes", "JSONB NOT NULL DEFAULT '{}'"),
        ("share_token", "TEXT UNIQUE"),
        ("is_shared", "BOOLEAN DEFAULT FALSE"),
    ]:
        await pool.execute(f"""
            ALTER TABLE video_analyses ADD COLUMN IF NOT EXISTS {col} {definition}
        """)
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS analyses_user_idx ON video_analyses(user_id, created_at DESC)"
    )
    await pool.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS analyses_share_token_idx ON video_analyses(share_token) WHERE share_token IS NOT NULL"
    )


def _row_to_dict(row: asyncpg.Record, include_notes: bool = True) -> dict:
    d = {
        "id": str(row["id"]),
        "title": row["title"],
        "summary": row["summary"],
        "fighter_a": row["fighter_a"],
        "fighter_b": row["fighter_b"],
        "events": json.loads(row["events"]),
        "is_shared": row["is_shared"] or False,
        "created_at": row["created_at"].isoformat(),
    }
    if include_notes:
        d["global_note"] = row["global_note"]
        d["event_notes"] = json.loads(row["event_notes"] or "{}")
    return d


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
        """SELECT id, title, fighter_a, fighter_b, is_shared, created_at
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
            "is_shared": r["is_shared"] or False,
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
    return _row_to_dict(row) if row else None


async def get_analysis_by_token(token: str) -> dict | None:
    pool = await _get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM video_analyses WHERE share_token = $1 AND is_shared = TRUE",
        token,
    )
    return _row_to_dict(row) if row else None


async def save_notes(
    analysis_id: str,
    user_id: str,
    global_note: str | None,
    event_notes: dict,
) -> bool:
    pool = await _get_pool()
    result = await pool.execute(
        """UPDATE video_analyses
           SET global_note = $3, event_notes = $4
           WHERE id = $1 AND user_id = $2""",
        analysis_id, user_id, global_note, json.dumps(event_notes),
    )
    return result.endswith("1")


async def enable_sharing(analysis_id: str, user_id: str) -> str | None:
    pool = await _get_pool()
    row = await pool.fetchrow(
        "SELECT share_token, is_shared FROM video_analyses WHERE id = $1 AND user_id = $2",
        analysis_id, user_id,
    )
    if not row:
        return None
    if row["is_shared"] and row["share_token"]:
        return row["share_token"]
    token = secrets.token_urlsafe(16)
    await pool.execute(
        "UPDATE video_analyses SET share_token = $3, is_shared = TRUE WHERE id = $1 AND user_id = $2",
        analysis_id, user_id, token,
    )
    return token


async def disable_sharing(analysis_id: str, user_id: str) -> bool:
    pool = await _get_pool()
    result = await pool.execute(
        "UPDATE video_analyses SET is_shared = FALSE WHERE id = $1 AND user_id = $2",
        analysis_id, user_id,
    )
    return result.endswith("1")


async def delete_analysis(analysis_id: str, user_id: str) -> bool:
    pool = await _get_pool()
    result = await pool.execute(
        "DELETE FROM video_analyses WHERE id = $1 AND user_id = $2",
        analysis_id, user_id,
    )
    return result.endswith("1")
