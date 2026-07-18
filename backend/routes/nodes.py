from collections import defaultdict

from fastapi import APIRouter, HTTPException

from services.graph_db import driver
from services.rag import rag_chunks

router = APIRouter()

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
    "sweep_with":    "Swept from",
    "pass_with":     "Passed from",
    "transition_to": "Transitioned from",
    "follow_up":     "Natural setup from",
    "recover_to":    "Recover from",
    "escape_with":   "Escape used from",
    "counters":      "Countered by",
    "known_for":     "Known practitioners",
    "features":      "Featured in",
    "centers_on":    "Center of",
    "developed":     "Created by",
    "coached_by":    "Coached by",
}


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


@router.get("/api/technique/{node_id}")
async def get_technique(node_id: str):
    async with driver.session() as session:
        result = await session.run(
            """MATCH (n:BJJNode {id: $id})
               OPTIONAL MATCH (n)-[r]->(m:BJJNode) WHERE m IS NOT NULL
               WITH n, collect({rel_type: type(r), id: m.id, name: m.name, type: m.type}) AS out_raw
               OPTIONAL MATCH (p:BJJNode)-[s]->(n) WHERE p IS NOT NULL
               WITH n, out_raw, collect({rel_type: type(s), id: p.id, name: p.name, type: p.type}) AS in_raw
               RETURN n.id AS id, n.name AS name, n.type AS type,
                      n.description AS description, n.gi_requirement AS gi_requirement,
                      n.video_url AS video_url, out_raw, in_raw""",
            id=node_id,
        )
        record = await result.single()

    if not record:
        raise HTTPException(status_code=404, detail="Technique not found")

    def group_by_action(raw: list, label_map: dict) -> list:
        grouped: dict[str, list] = defaultdict(list)
        for item in raw:
            if not item.get("id"):
                continue
            action = item["rel_type"].lower()
            grouped[action].append({"id": item["id"], "name": item["name"], "type": item["type"]})
        return [
            {"action": action, "label": label_map.get(action, action), "nodes": nodes}
            for action, nodes in grouped.items()
        ]

    return {
        "id": record["id"],
        "name": record["name"],
        "type": record["type"],
        "description": record["description"],
        "gi_requirement": record["gi_requirement"],
        "video_url": record["video_url"],
        "outgoing": group_by_action(list(record["out_raw"]), ACTION_LABEL),
        "incoming": group_by_action(list(record["in_raw"]), INCOMING_LABEL),
    }
