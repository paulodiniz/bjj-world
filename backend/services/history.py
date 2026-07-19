import os
from datetime import datetime, timezone

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
        CREATE TABLE IF NOT EXISTS conversations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            anon_session_id TEXT,
            title TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    # Migrate existing tables
    await pool.execute("ALTER TABLE conversations ALTER COLUMN user_id DROP NOT NULL")
    await pool.execute("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS anon_session_id TEXT")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages(conversation_id, created_at)"
    )
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations(user_id, updated_at DESC)"
    )
    await pool.execute(
        "CREATE INDEX IF NOT EXISTS conversations_anon_idx ON conversations(anon_session_id, updated_at DESC)"
    )


async def create_conversation(title: str, user_id: str | None = None, anon_session_id: str | None = None) -> str:
    pool = await _get_pool()
    row = await pool.fetchrow(
        "INSERT INTO conversations (user_id, anon_session_id, title) VALUES ($1, $2, $3) RETURNING id",
        user_id, anon_session_id, title[:120],
    )
    return str(row["id"])


async def save_messages(conversation_id: str, question: str, answer: str) -> None:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)",
            conversation_id, question,
        )
        await conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)",
            conversation_id, answer,
        )
        await conn.execute(
            "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
            conversation_id,
        )


async def list_conversations(user_id: str | None = None, anon_session_id: str | None = None) -> list[dict]:
    pool = await _get_pool()
    if user_id:
        rows = await pool.fetch(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50",
            user_id,
        )
    elif anon_session_id:
        rows = await pool.fetch(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE anon_session_id = $1 ORDER BY updated_at DESC LIMIT 50",
            anon_session_id,
        )
    else:
        return []
    return [
        {
            "id": str(r["id"]),
            "title": r["title"],
            "created_at": r["created_at"].isoformat(),
            "updated_at": r["updated_at"].isoformat(),
        }
        for r in rows
    ]


async def get_conversation(conversation_id: str, user_id: str | None = None, anon_session_id: str | None = None) -> dict | None:
    pool = await _get_pool()
    if user_id:
        conv = await pool.fetchrow(
            "SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2",
            conversation_id, user_id,
        )
    elif anon_session_id:
        conv = await pool.fetchrow(
            "SELECT id, title FROM conversations WHERE id = $1 AND anon_session_id = $2",
            conversation_id, anon_session_id,
        )
    else:
        return None

    if not conv:
        return None

    msgs = await pool.fetch(
        "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at",
        conversation_id,
    )
    return {
        "id": str(conv["id"]),
        "title": conv["title"],
        "messages": [{"role": r["role"], "content": r["content"]} for r in msgs],
    }


async def delete_conversation(conversation_id: str, user_id: str | None = None, anon_session_id: str | None = None) -> bool:
    pool = await _get_pool()
    if user_id:
        result = await pool.execute(
            "DELETE FROM conversations WHERE id = $1 AND user_id = $2",
            conversation_id, user_id,
        )
    elif anon_session_id:
        result = await pool.execute(
            "DELETE FROM conversations WHERE id = $1 AND anon_session_id = $2",
            conversation_id, anon_session_id,
        )
    else:
        return False
    return result.endswith("1")


async def conversation_belongs_to_user(conversation_id: str, user_id: str) -> bool:
    pool = await _get_pool()
    row = await pool.fetchrow(
        "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
        conversation_id, user_id,
    )
    return row is not None


async def conversation_belongs_to_anon(conversation_id: str, anon_session_id: str) -> bool:
    pool = await _get_pool()
    row = await pool.fetchrow(
        "SELECT id FROM conversations WHERE id = $1 AND anon_session_id = $2",
        conversation_id, anon_session_id,
    )
    return row is not None
