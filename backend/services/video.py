import asyncio
import base64
import os
import re
import shutil
import tempfile
from collections.abc import AsyncGenerator


def format_timestamp(seconds: int) -> str:
    m = seconds // 60
    s = seconds % 60
    return f"{m}:{s:02d}"


def normalize_video_url(url: str) -> str:
    url = url.replace("www.dropbox.com", "dl.dropboxusercontent.com")
    url = re.sub(r"[?&]dl=0", "", url)
    drive_match = re.search(r"drive\.google\.com/file/d/([^/]+)", url)
    if drive_match:
        url = f"https://drive.google.com/uc?export=download&id={drive_match.group(1)}"
    return url


def _read_new_frames(tmp_dir: str, seen: set[str]) -> list[dict]:
    frames = []
    for filename in sorted(f for f in os.listdir(tmp_dir) if f.endswith(".jpg") and f not in seen):
        seen.add(filename)
        index = int(os.path.splitext(filename)[0]) - 1
        timestamp = index * 15
        with open(os.path.join(tmp_dir, filename), "rb") as fh:
            data = base64.b64encode(fh.read()).decode()
        frames.append({"timestamp": timestamp, "label": format_timestamp(timestamp), "data": data})
    return frames


async def extract_frames(source: str, target_frames: int = 20, is_url: bool = True) -> AsyncGenerator[dict, None]:
    url = normalize_video_url(source) if is_url else source
    tmp_dir = tempfile.mkdtemp(prefix="bjj-frames-")

    try:
        cmd = ["ffmpeg", "-y"]
        if is_url and (url.startswith("http://") or url.startswith("https://")):
            cmd += ["-headers", "User-Agent: Mozilla/5.0\r\n"]
        cmd += [
            "-i", url,
            "-vf", "fps=1/15,scale=480:-2",
            "-vframes", str(target_frames),
            "-q:v", "3",
            os.path.join(tmp_dir, "%04d.jpg"),
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )

        seen: set[str] = set()
        while proc.returncode is None:
            await asyncio.sleep(0.4)
            try:
                await asyncio.wait_for(asyncio.shield(proc.wait()), timeout=0.01)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pass
            for frame in _read_new_frames(tmp_dir, seen):
                yield frame

        await proc.wait()
        if proc.returncode != 0:
            stderr = (await proc.stderr.read()).decode()
            raise RuntimeError(f"ffmpeg error: {stderr[-300:]}")

        for frame in _read_new_frames(tmp_dir, seen):
            yield frame

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
