import json
import os

from neo4j import AsyncGraphDatabase

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j.railway.internal:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

driver = AsyncGraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


async def seed_database(graph_path: str) -> None:
    with open(graph_path) as f:
        graph = json.load(f)

    async with driver.session() as session:
        result = await session.run("MATCH (n:BJJNode) RETURN count(n) as count")
        record = await result.single()
        count = record["count"]

        if count == len(graph["nodes"]):
            print(f"Database up to date with {count} nodes")
            return

        print(f"Database has {count} nodes, graph.json has {len(graph['nodes'])} — reseeding...")
        await session.run("MATCH (n) DETACH DELETE n")
        await session.run(
            "CREATE CONSTRAINT bjj_node_id IF NOT EXISTS FOR (n:BJJNode) REQUIRE n.id IS UNIQUE"
        )

        for node in graph["nodes"]:
            await session.run(
                """MERGE (n:BJJNode {id: $id})
                   SET n.name = $name, n.type = $type, n.description = $description,
                       n.gi_requirement = $gi_requirement, n.video_url = $video_url""",
                id=node["id"],
                name=node["name"],
                type=node["type"],
                description=node.get("description"),
                gi_requirement=node.get("gi_requirement", "both"),
                video_url=node.get("video_url"),
            )

        for edge in graph["edges"]:
            rel_type = edge["action"].upper()
            await session.run(
                f"""MATCH (a:BJJNode {{id: $from_id}}), (b:BJJNode {{id: $to_id}})
                    WHERE a IS NOT NULL AND b IS NOT NULL
                    CREATE (a)-[:{rel_type} {{conditions: $conditions, confidence: $confidence, difficulty: $difficulty}}]->(b)""",
                from_id=edge["from"],
                to_id=edge["to"],
                conditions=edge.get("conditions") or [],
                confidence=edge.get("confidence"),
                difficulty=edge.get("difficulty"),
            )

        print(f"Seeded {len(graph['nodes'])} nodes and {len(graph['edges'])} edges")
