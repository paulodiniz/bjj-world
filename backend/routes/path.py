from fastapi import APIRouter, Query, HTTPException

from services.graph_db import driver

router = APIRouter()


@router.get("/api/path")
async def find_path(
    from_id: str = Query(..., alias="from"),
    to_id: str = Query(..., alias="to"),
):
    async with driver.session() as session:
        result = await session.run(
            """MATCH (start:BJJNode {id: $from_id}), (end:BJJNode {id: $to_id})
               MATCH p = shortestPath((start)-[*..12]->(end))
               RETURN [n IN nodes(p) | {id: n.id, name: n.name, type: n.type}] AS steps,
                      [r IN relationships(p) | type(r)] AS transitions""",
            from_id=from_id,
            to_id=to_id,
        )
        record = await result.single()

    if not record:
        return {"found": False}

    return {"found": True, "steps": record["steps"], "transitions": record["transitions"]}
