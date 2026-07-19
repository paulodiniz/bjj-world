"""
Run once after `docker compose up -d` to seed the local database.

Usage (from repo root):
  cd backend
  python seed_local.py
"""

import asyncio
import os
import sys
from pathlib import Path

# Load .env.local from repo root
env_file = Path(__file__).parent.parent / ".env.local"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from services.auth import init_db as init_auth_db
from services.history import init_db as init_history_db
from services.analyses import init_db as init_analyses_db
from services.graph_db import seed_database

GRAPH_PATH = str(Path(__file__).parent.parent / "graph.json")


async def main():
    print("── Seeding local database ──────────────────────────")

    print("\n[1/3] Initialising Postgres tables…")
    await init_auth_db()
    await init_history_db()
    await init_analyses_db()
    print("      ✓ users, magic_tokens, sessions, conversations, messages, video_analyses")

    print("\n[2/3] Seeding Neo4j graph…")
    await seed_database(GRAPH_PATH)
    print("      ✓ BJJ graph loaded")

    print("\n[3/3] Skipping RAG embeddings (run the app to trigger initRAG)")
    print("      Ollama will pull nomic-embed-text on first startup.")

    print("\n── Done ─────────────────────────────────────────────")
    print("Start the backend with:")
    print("  cd backend && uvicorn main:app --reload --port 8000")
    print("\nNeo4j browser: http://localhost:7474")
    print("  (Connect with bolt://localhost:7687, user: neo4j, pass: tapcodex_local)")


if __name__ == "__main__":
    asyncio.run(main())
