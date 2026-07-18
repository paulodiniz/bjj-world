import json
import hashlib
import os
import re
from typing import Any

import asyncpg
import httpx

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama.railway.internal:11434")
DATABASE_URL = os.getenv("DATABASE_URL")

ACTION_LABEL = {
    "attack_with":   "Attacks",
    "sweep_with":    "Sweeps",
    "pass_with":     "Guard passes",
    "transition_to": "Transitions to",
    "follow_up":     "Follow-ups",
    "recover_to":    "Recovers to",
    "escape_with":   "Escapes",
    "counters":      "Counters",
    "requires":      "Requires",
    "developed":     "Developed",
    "centers_on":    "Centers on",
    "features":      "Features",
    "known_for":     "Known for",
    "coached_by":    "Coached by",
}

INCOMING_LABEL = {
    "attack_with":   "Attacked from",
    "sweep_with":    "Used as sweep from",
    "pass_with":     "Used as pass from",
    "transition_to": "Transitioned to from",
    "follow_up":     "Natural follow-up to",
    "recover_to":    "Recovered to from",
    "escape_with":   "Escape used from",
    "counters":      "Countered by",
    "known_for":     "Practitioners known for this",
    "features":      "Featured in",
    "centers_on":    "Center of system",
    "developed":     "Developed by",
}

# In-memory state
rag_chunks: list[dict] = []
rag_ready: bool = False
_pg_pool: asyncpg.Pool | None = None


def build_chunks(graph: dict) -> list[dict]:
    edges_by_from: dict[str, list] = {}
    edges_by_to: dict[str, list] = {}
    for edge in graph["edges"]:
        edges_by_from.setdefault(edge["from"], []).append(edge)
        edges_by_to.setdefault(edge["to"], []).append(edge)

    node_map = {n["id"]: n for n in graph["nodes"]}
    chunks = []

    for node in graph["nodes"]:
        lines = [f"[{node['type']}] {node['name']}"]
        if node.get("description"):
            lines.append(node["description"])

        by_action: dict[str, list] = {}
        for e in edges_by_from.get(node["id"], []):
            target = node_map.get(e["to"])
            if not target:
                continue
            conditions = e.get("conditions") or []
            parts = [target["name"], e.get("difficulty")]
            if conditions:
                parts.append(f"({', '.join(conditions[:2])})")
            detail = " ".join(p for p in parts if p)
            by_action.setdefault(e["action"], []).append(detail)
        for action, targets in by_action.items():
            lines.append(f"{ACTION_LABEL.get(action, action)}: {', '.join(targets)}")

        by_incoming: dict[str, list] = {}
        for e in edges_by_to.get(node["id"], []):
            source = node_map.get(e["from"])
            if not source or e["action"] not in INCOMING_LABEL:
                continue
            by_incoming.setdefault(e["action"], []).append(source["name"])
        for action, sources in by_incoming.items():
            lines.append(f"{INCOMING_LABEL[action]}: {', '.join(sources)}")

        chunks.append({"id": node["id"], "name": node["name"], "type": node["type"], "text": "\n".join(lines)})

    return chunks


def chunk_hash(chunks: list[dict]) -> str:
    combined = "".join(c["text"] for c in chunks)
    return hashlib.md5(combined.encode()).hexdigest()


async def ollama_embed(texts: list[str]) -> list[list[float]]:
    results = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        for text in texts:
            resp = await client.post(
                f"{OLLAMA_URL}/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": text},
            )
            results.append(resp.json()["embedding"])
    return results


async def _get_pool() -> asyncpg.Pool:
    global _pg_pool
    if _pg_pool is None:
        _pg_pool = await asyncpg.create_pool(DATABASE_URL)
    return _pg_pool


async def retrieve(question: str, k: int = 7) -> list[dict]:
    if not rag_ready:
        words = [w for w in re.split(r"\W+", question.lower()) if len(w) > 2]
        scored = []
        for chunk in rag_chunks:
            t = chunk["text"].lower()
            score = sum(1 for w in words if w in t) / max(len(words), 1)
            scored.append({**chunk, "score": score})
        return sorted(scored, key=lambda c: c["score"], reverse=True)[:k]

    (q_emb,) = await ollama_embed([question])
    pool = await _get_pool()
    rows = await pool.fetch(
        """SELECT id, name, type, chunk AS text,
                  1 - (embedding <=> $1::vector) AS score
           FROM bjj_embeddings
           ORDER BY embedding <=> $1::vector
           LIMIT $2""",
        json.dumps(q_emb),
        k,
    )
    return [dict(r) for r in rows]


async def init_rag(graph_path: str) -> None:
    global rag_chunks, rag_ready

    with open(graph_path) as f:
        graph = json.load(f)

    rag_chunks = build_chunks(graph)
    print(f"Built {len(rag_chunks)} RAG chunks")

    async with httpx.AsyncClient(timeout=120.0) as client:
        print("Pulling nomic-embed-text...")
        await client.post(f"{OLLAMA_URL}/api/pull", json={"name": "nomic-embed-text", "stream": False})
        print("nomic-embed-text ready")

    pool = await _get_pool()
    await pool.execute("CREATE EXTENSION IF NOT EXISTS vector")
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS bjj_embeddings (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            chunk TEXT NOT NULL,
            embedding vector(768)
        )
    """)
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS bjj_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    current_hash = chunk_hash(rag_chunks)
    row = await pool.fetchrow("SELECT value FROM bjj_meta WHERE key = 'chunk_hash'")
    if row and row["value"] == current_hash:
        print("pgvector: chunks unchanged, skipping re-embed")
        rag_ready = True
        return

    print("Computing and storing embeddings...")
    await pool.execute("TRUNCATE bjj_embeddings")

    embeddings = await ollama_embed([c["text"] for c in rag_chunks])
    for chunk, emb in zip(rag_chunks, embeddings):
        await pool.execute(
            "INSERT INTO bjj_embeddings (id, name, type, chunk, embedding) VALUES ($1, $2, $3, $4, $5)",
            chunk["id"], chunk["name"], chunk["type"], chunk["text"], json.dumps(emb),
        )

    await pool.execute(
        "INSERT INTO bjj_meta (key, value) VALUES ('chunk_hash', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        current_hash,
    )
    print(f"Stored {len(rag_chunks)} embeddings in pgvector")
    rag_ready = True
