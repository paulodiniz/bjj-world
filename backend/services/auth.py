import os
import secrets
from datetime import datetime, timedelta, timezone

import asyncpg
import resend

resend.api_key = os.getenv("RESEND_API_KEY", "")

MAIL_FROM = os.getenv("MAIL_FROM", "BJJ World <noreply@bjj-world.app>")
TOKEN_TTL_MINUTES = 15
SESSION_TTL_DAYS = 30

_pool: asyncpg.Pool | None = None


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"))
    return _pool


async def init_db() -> None:
    pool = await _get_pool()
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS magic_tokens (
            token TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)


async def create_and_send_magic_link(email: str, app_url: str) -> None:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MINUTES)

    pool = await _get_pool()
    await pool.execute(
        "INSERT INTO magic_tokens (token, email, expires_at) VALUES ($1, $2, $3)",
        token, email.lower().strip(), expires_at,
    )

    magic_link = f"{app_url}/api/auth/verify?token={token}"
    _send_email(email, magic_link)


def _send_email(to: str, magic_link: str) -> None:
    resend.Emails.send({
        "from": MAIL_FROM,
        "to": [to],
        "subject": "Sign in to BJJ World",
        "html": f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'IBM Plex Mono',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="480" cellpadding="0" cellspacing="0"
        style="background:#1a1a1a;border-radius:10px;border:1px solid #333;padding:40px;">
        <tr><td>
          <p style="margin:0 0 8px;font-style:italic;font-weight:600;font-size:1.3rem;
            letter-spacing:-0.03em;color:#ededed;">BJJ World</p>
          <p style="margin:0 0 32px;font-size:0.72rem;color:#888;letter-spacing:0.06em;">
            KNOWLEDGE GRAPH</p>
          <p style="margin:0 0 28px;font-size:0.88rem;color:#aaa;line-height:1.7;">
            Click below to sign in. This link expires in {TOKEN_TTL_MINUTES} minutes
            and can only be used once.</p>
          <a href="{magic_link}"
            style="display:inline-block;background:#c0392b;color:#fff;
              text-decoration:none;padding:12px 28px;border-radius:6px;
              font-size:0.85rem;font-weight:500;letter-spacing:0.01em;">
            Sign in to BJJ World →
          </a>
          <p style="margin:36px 0 0;font-size:0.70rem;color:#555;line-height:1.6;">
            If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>""",
    })


async def verify_token(token: str) -> str | None:
    pool = await _get_pool()
    now = datetime.now(timezone.utc)

    row = await pool.fetchrow(
        "SELECT email, expires_at, used FROM magic_tokens WHERE token = $1",
        token,
    )
    if not row or row["used"] or row["expires_at"] < now:
        return None

    await pool.execute("UPDATE magic_tokens SET used = TRUE WHERE token = $1", token)

    email = row["email"]
    await pool.execute(
        "INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
        email,
    )
    user = await pool.fetchrow("SELECT id FROM users WHERE email = $1", email)

    session_id = secrets.token_urlsafe(32)
    expires_at = now + timedelta(days=SESSION_TTL_DAYS)
    await pool.execute(
        "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
        session_id, user["id"], expires_at,
    )
    return session_id


async def get_user_by_session(session_id: str) -> dict | None:
    if not session_id:
        return None
    pool = await _get_pool()
    now = datetime.now(timezone.utc)
    row = await pool.fetchrow(
        """SELECT u.id, u.email FROM sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.id = $1 AND s.expires_at > $2""",
        session_id, now,
    )
    return dict(row) if row else None


async def delete_session(session_id: str) -> None:
    if not session_id:
        return
    pool = await _get_pool()
    await pool.execute("DELETE FROM sessions WHERE id = $1", session_id)
