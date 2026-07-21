# Backlog

Items deferred from active development. Each entry has a short rationale so future-me knows why it matters.

---

## Rate limiter: move from in-memory to Postgres

**File:** `backend/routes/chat.py` — `_rate_hits` dict + `_is_rate_limited()`

**Problem:** The current rate limiter is a plain Python dict. It resets on every server restart and won't work correctly if the backend ever runs as more than one instance.

**Fix:** Store hit timestamps in Postgres (a simple `rate_limit_hits(ip, hit_at)` table with an index on `(ip, hit_at)`) or reuse the existing Redis/Valkey if one is ever added. The logic stays the same — just replace the dict reads/writes with DB queries.

**Priority:** Low. Not blocking anything today. Becomes important before any scaling or high-traffic event.
