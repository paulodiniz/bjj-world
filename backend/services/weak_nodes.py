import json
import os

from anthropic import AsyncAnthropic

_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


async def detect_weak_nodes(events: list[dict], fighter_a: str, rag_chunks: list[dict]) -> list[str]:
    """Return up to 5 graph node IDs where fighter_a appears in defensive/losing positions."""
    if not events or not fighter_a or not rag_chunks:
        return []

    known = {c["id"]: c for c in rag_chunks}
    known_ids = ", ".join(known.keys())[:3000]

    events_text = "\n".join(
        f"[{e.get('label', '')}] {e.get('badge', '')}: {e.get('description', '')}"
        for e in events
    )

    resp = await _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": (
                f"BJJ match events for '{fighter_a}':\n{events_text}\n\n"
                f"Known node IDs: {known_ids}\n\n"
                f"Which node IDs from the known list represent positions or situations where "
                f"'{fighter_a}' is clearly on the defensive or losing the exchange? "
                "List up to 5. Return only valid JSON: {\"weak\": [\"id1\", \"id2\"]}"
            ),
        }],
    )

    try:
        data = json.loads(resp.content[0].text.strip())
        return [nid for nid in data.get("weak", []) if nid in known]
    except Exception:
        return []
