import json
import os

import asyncpg

import services.rag as _rag

_pool: asyncpg.Pool | None = None

BELT_LEVELS = ["white", "blue", "purple", "brown", "black"]
GI_OPTIONS = ["gi", "nogi", "both"]


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"))
    return _pool


async def init_db() -> None:
    pool = await _get_pool()
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            belt TEXT NOT NULL DEFAULT 'white',
            gi_preference TEXT NOT NULL DEFAULT 'both',
            primary_guard TEXT,
            passing_style TEXT,
            submission_prefs JSONB NOT NULL DEFAULT '[]',
            notes TEXT,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute("""
        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS weak_nodes JSONB NOT NULL DEFAULT '[]'
    """)
    # Safe migration: add as JSONB if missing, or convert from TEXT if the
    # column was created before we switched to the node-picker approach.
    await pool.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'user_profiles' AND column_name = 'favourite_game'
            ) THEN
                ALTER TABLE user_profiles
                    ADD COLUMN favourite_game JSONB NOT NULL DEFAULT '[]';
            ELSIF (
                SELECT data_type FROM information_schema.columns
                WHERE table_name = 'user_profiles' AND column_name = 'favourite_game'
            ) = 'text' THEN
                ALTER TABLE user_profiles
                    ALTER COLUMN favourite_game TYPE JSONB
                    USING CASE
                        WHEN favourite_game IS NULL OR favourite_game = ''
                            THEN '[]'::JSONB
                        ELSE jsonb_build_array(favourite_game)
                    END;
                ALTER TABLE user_profiles
                    ALTER COLUMN favourite_game SET DEFAULT '[]';
                ALTER TABLE user_profiles
                    ALTER COLUMN favourite_game SET NOT NULL;
            END IF;
        END $$;
    """)


async def get_profile(user_id: str) -> dict | None:
    pool = await _get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM user_profiles WHERE user_id = $1", user_id
    )
    if not row:
        return None
    return {
        "belt": row["belt"],
        "gi_preference": row["gi_preference"],
        "primary_guard": row["primary_guard"],
        "passing_style": row["passing_style"],
        "submission_prefs": json.loads(row["submission_prefs"]),
        "notes": row["notes"],
        "favourite_game": json.loads(row["favourite_game"]),
        "weak_nodes": json.loads(row["weak_nodes"]) if row["weak_nodes"] else [],
    }


async def merge_weak_nodes(user_id: str, node_ids: list[str]) -> None:
    """Increment count for each detected weak node, inserting new ones as needed."""
    if not node_ids:
        return
    pool = await _get_pool()
    row = await pool.fetchrow(
        "SELECT weak_nodes FROM user_profiles WHERE user_id = $1", user_id
    )
    existing: list[dict] = json.loads(row["weak_nodes"]) if row and row["weak_nodes"] else []
    by_id = {n["id"]: n for n in existing}

    name_map = {c["id"]: c for c in _rag.rag_chunks} if _rag.rag_chunks else {}
    for nid in node_ids:
        if nid in by_id:
            by_id[nid]["count"] = by_id[nid].get("count", 1) + 1
        else:
            chunk = name_map.get(nid, {})
            by_id[nid] = {"id": nid, "name": chunk.get("name", nid), "type": chunk.get("type", ""), "count": 1}

    merged = sorted(by_id.values(), key=lambda x: x["count"], reverse=True)
    await pool.execute(
        """INSERT INTO user_profiles (user_id, weak_nodes) VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET weak_nodes = $2""",
        user_id, json.dumps(merged),
    )


async def save_profile(user_id: str, data: dict) -> dict:
    pool = await _get_pool()
    belt = data.get("belt", "white")
    gi = data.get("gi_preference", "both")
    primary_guard = data.get("primary_guard") or None
    passing_style = data.get("passing_style") or None
    submission_prefs = json.dumps(data.get("submission_prefs") or [])
    notes = data.get("notes") or None
    favourite_game = json.dumps(data.get("favourite_game") or [])

    await pool.execute("""
        INSERT INTO user_profiles
            (user_id, belt, gi_preference, primary_guard, passing_style, submission_prefs, notes, favourite_game, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            belt = $2, gi_preference = $3, primary_guard = $4,
            passing_style = $5, submission_prefs = $6, notes = $7,
            favourite_game = $8, updated_at = NOW()
    """, user_id, belt, gi, primary_guard, passing_style, submission_prefs, notes, favourite_game)

    return await get_profile(user_id)


def build_profile_context(profile: dict | None) -> str:
    if not profile:
        return ""

    parts = []
    belt = profile.get("belt")
    if belt:
        parts.append(f"Belt: {belt}")

    gi = profile.get("gi_preference")
    if gi and gi != "both":
        parts.append(f"Trains: {gi} only")

    guard = profile.get("primary_guard")
    if guard:
        parts.append(f"Primary guard: {guard}")

    passing = profile.get("passing_style")
    if passing:
        parts.append(f"Passing style: {passing}")

    subs = profile.get("submission_prefs") or []
    if subs:
        _name_map = {c["id"]: c["name"] for c in _rag.rag_chunks} if _rag.rag_chunks else {}
        sub_names = [_name_map.get(s, s.replace("_", " ")) for s in subs]
        parts.append(f"Favourite submissions: {', '.join(sub_names)}")

    game_ids = profile.get("favourite_game") or []
    if game_ids:
        _name_map = {c["id"]: c["name"] for c in _rag.rag_chunks} if _rag.rag_chunks else {}
        game_names = [_name_map.get(g, g.replace("_", " ")) for g in game_ids]
        parts.append(
            f"Favourite game / focus: {', '.join(game_names)} — when relevant, "
            "connect your answer back to this game style (e.g. entries, setups, "
            "or transitions that fit this focus)"
        )

    notes = profile.get("notes")
    if notes:
        parts.append(f"Additional context: {notes}")

    weak = profile.get("weak_nodes") or []
    if weak:
        gap_names = [n["name"] for n in weak[:5]]
        parts.append(
            f"Detected gaps from video analysis: {', '.join(gap_names)} — "
            "when relevant, help this practitioner address these weak areas"
        )

    if not parts:
        return ""

    return (
        "\n\nPlayer profile — tailor your advice to this practitioner's game:\n"
        + "\n".join(f"- {p}" for p in parts)
    )
