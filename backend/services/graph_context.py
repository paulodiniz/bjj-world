import re

from services.graph_db import driver

_ACTION_LABELS = {
    "ATTACK_WITH": "attacks with",
    "SWEEP_WITH": "sweeps with",
    "PASS_WITH": "passes with",
    "TRANSITION_TO": "transitions to",
    "FOLLOW_UP": "follows up with",
    "RECOVER_TO": "recovers to",
    "ESCAPE_WITH": "escapes using",
    "COUNTERS": "counters with",
    "REQUIRES": "requires",
    "DEVELOPED": "developed",
    "CENTERS_ON": "centers on",
    "FEATURES": "features",
    "KNOWN_FOR": "known for",
    "COACHED_BY": "coached by",
}

# Populated from rag chunks at startup
_node_index: dict[str, str] = {}  # lowercase name → original name
_competitor_names: list[str] = []


def build_graph_index(chunks: list[dict]) -> None:
    global _node_index, _competitor_names
    _node_index = {c["name"].lower(): c["name"] for c in chunks}
    _competitor_names = [c["name"].lower() for c in chunks if c["type"] == "competitor"]


def _mentioned_competitors(question: str) -> list[str]:
    q = question.lower()
    found = []
    for name_lower in _competitor_names:
        parts = [p for p in name_lower.split() if len(p) > 3]
        if any(p in q for p in parts):
            found.append(_node_index[name_lower])
    return found


def _detect_path_request(question: str) -> tuple[str, str] | None:
    m = re.search(
        r'(?:from|path from|get from|go from)\s+(.+?)\s+to\s+(.+?)(?:\?|$|\.)',
        question,
        re.IGNORECASE,
    )
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None


async def _query_practitioner(name: str) -> str:
    async with driver.session() as session:
        result = await session.run(
            """MATCH (p:BJJNode)
               WHERE toLower(p.name) CONTAINS toLower($name) AND p.type = 'competitor'
               OPTIONAL MATCH (p)-[r]->(target:BJJNode)
               RETURN p.name AS name, p.description AS bio,
                      collect({rel: type(r), target: target.name, target_type: target.type}) AS rels
               LIMIT 1""",
            name=name,
        )
        record = await result.single()
    if not record:
        return ""

    lines = [f"Practitioner: {record['name']}"]
    if record["bio"]:
        lines.append(record["bio"])
    for r in record["rels"]:
        if r["rel"] and r["target"]:
            label = _ACTION_LABELS.get(r["rel"], r["rel"].lower().replace("_", " "))
            lines.append(f"  {label}: {r['target']} ({r['target_type']})")
    return "\n".join(lines)


async def _query_path(from_name: str, to_name: str) -> str:
    async with driver.session() as session:
        result = await session.run(
            """MATCH (start:BJJNode), (end:BJJNode)
               WHERE toLower(start.name) CONTAINS toLower($from_name)
                 AND toLower(end.name) CONTAINS toLower($to_name)
               MATCH p = shortestPath((start)-[*..12]->(end))
               RETURN [n IN nodes(p) | n.name] AS steps,
                      [r IN relationships(p) | type(r)] AS transitions
               LIMIT 1""",
            from_name=from_name,
            to_name=to_name,
        )
        record = await result.single()
    if not record:
        return ""

    steps = record["steps"]
    transitions = record["transitions"]
    parts = [steps[0]]
    for step, transition in zip(steps[1:], transitions):
        label = _ACTION_LABELS.get(transition, transition.lower().replace("_", " "))
        parts.append(f"→ ({label}) → {step}")
    return f"Path: {' '.join(parts)}"


async def build_graph_context(question: str) -> str:
    if not _node_index:
        return ""

    sections = []
    try:
        for name in _mentioned_competitors(question):
            ctx = await _query_practitioner(name)
            if ctx:
                sections.append(ctx)

        path = _detect_path_request(question)
        if path:
            ctx = await _query_path(path[0], path[1])
            if ctx:
                sections.append(ctx)
    except Exception as e:
        print(f"graph_context error: {e}")

    if not sections:
        return ""

    return "Graph data:\n" + "\n\n".join(sections)
