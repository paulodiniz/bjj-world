# Product

## Register

product

## Name & Domain

**Tapcodex** — tapcodex.app

## Users

Hobbyist BJJ practitioners — white to purple belt — studying between classes. They're on their phone or laptop after training, trying to understand a position they got stuck in, a submission they couldn't finish, or a transition they saw on the mat. They use it the way they'd use a training journal: focused, purposeful, no time to waste.

Coaches are an emerging secondary user: they upload competition footage, annotate the AI breakdown, and share it with students before the next class.

## Product Purpose

Tapcodex is a knowledge graph tool for Brazilian jiu-jitsu. It lets grapplers explore how techniques, positions, and submissions connect — asking natural questions and getting coach-quality answers backed by a structured graph of 180+ nodes. The Path Finder finds the shortest route between any two positions. Video Analysis breaks down match footage frame by frame and lets coaches annotate and share the breakdown. Success looks like a practitioner walking into their next class with a clearer mental map of the game.

## Features

- **Chat** — AI coach powered by Claude Haiku + RAG over the BJJ knowledge graph
- **Path Finder** — Shortest path between any two positions via Neo4j graph traversal
- **Graph Visualizer** — Interactive D3 force-directed map of all 180+ nodes with type filters
- **Technique Pages** — Dedicated page per technique at `/technique/:id` with connections and YouTube embed
- **Video Analysis** — Upload or link a match video; Claude Sonnet extracts frames and annotates every position
- **Coach Notes & Sharing** — Annotate a saved analysis and share it via a public link at `/s/:token`
- **Saved Chat History** — Signed-in users get conversations persisted at `/c/:id`
- **Saved Analyses** — Signed-in users get analyses persisted at `/a/:id`
- **Auth** — Magic link email auth via Resend

## Monetization (planned)

- **Free forever:** Chat, Path Finder, Graph, Technique Pages
- **Pro (~€5/month):** Video Analysis (expensive per run), unlimited saved history, shared annotated analyses

## Brand Personality

Focused, sharp, minimal. No noise. Every element earns its place. The mat is clean. The tool respects the seriousness of the practice without being cold or unapproachable.

## Anti-references

- Generic SaaS / productivity tool aesthetic (Notion, Linear white-and-sans look)
- Loud sports broadcast energy (ESPN, UFC app — aggressive gradients, oversized hero numbers)
- AI chatbot wrapper feel — indistinguishable from a skinned ChatGPT

## Design Principles

1. **The mat is the teacher** — content is the product. Chrome, decoration, and UI scaffolding exist only to serve the answer.
2. **One question, one answer** — the interaction is simple by design. No feeds, no dashboards, no noise between the user and the knowledge.
3. **Earned complexity** — the graph is deep; surface that depth only when the user reaches for it. Don't front-load it.
4. **Functional precision** — every element has a clear job. If it's not doing one, it shouldn't be there.
5. **Built for the mat** — the aesthetic should feel like it belongs next to a tatami: physical, purposeful, no excess.

## Accessibility & Inclusion

WCAG AA minimum. High contrast is mandatory — this is a dark-mode tool used in varied lighting (gyms, locker rooms, homes). Reduced motion support required.
