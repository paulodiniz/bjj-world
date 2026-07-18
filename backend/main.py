import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse

from routes.auth import router as auth_router
from routes.chat import router as chat_router
from routes.nodes import router as nodes_router
from routes.path import router as path_router
from routes.analyze import router as analyze_router
from services.auth import init_db as init_auth_db
from services.graph_db import seed_database
from services.rag import init_rag

GRAPH_PATH = str(Path(__file__).parent.parent / "graph.json")
FRONTEND_DIR = str(Path(__file__).parent.parent / "frontend")
INDEX_HTML = str(Path(FRONTEND_DIR) / "index.html")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_auth_db()
    except Exception as exc:
        print(f"Auth DB init failed: {exc}")

    try:
        await seed_database(GRAPH_PATH)
    except Exception as exc:
        print(f"Seed failed (DB may not be ready yet): {exc}")

    asyncio.create_task(init_rag(GRAPH_PATH))
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(nodes_router)
app.include_router(path_router)
app.include_router(analyze_router)


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    return FileResponse(INDEX_HTML)
