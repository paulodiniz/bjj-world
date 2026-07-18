from fastapi import APIRouter
from neo4j import AsyncSession

from services.graph_db import driver
from services.rag import rag_chunks

router = APIRouter()


@router.get("/api/nodes")
async def get_nodes():
    return [{"id": c["id"], "name": c["name"], "type": c["type"]} for c in rag_chunks]


@router.get("/api/positions")
async def get_positions():
    position_types = {
        "position", "submission", "sweep", "guard_pass",
        "takedown", "escape", "counter", "concept", "competitor", "system",
    }
    async with driver.session() as session:
        result = await session.run(
            """MATCH (n:BJJNode) WHERE n.type IN $types
               RETURN n.id AS id, n.name AS name, n.type AS type
               ORDER BY n.type, n.name""",
            types=list(position_types),
        )
        records = await result.data()
    return records
