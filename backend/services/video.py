import asyncio
import base64
import json
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


def _read_new_frames(tmp_dir: str, seen: set[str], interval: float) -> list[dict]:
    frames = []
    for filename in sorted(f for f in os.listdir(tmp_dir) if f.endswith(".jpg") and f not in seen):
        seen.add(filename)
        index = int(os.path.splitext(filename)[0]) - 1
        timestamp = round(index * interval)
        with open(os.path.join(tmp_dir, filename), "rb") as fh:
            data = base64.b64encode(fh.read()).decode()
        frames.append({"timestamp": timestamp, "label": format_timestamp(timestamp), "data": data})
    return frames


async def _get_duration(source: str) -> float:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
        "-of", "json", source,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    stdout, _ = await proc.communicate()
    try:
        return float(json.loads(stdout)["format"]["duration"])
    except Exception:
        return 0.0


async def _has_video_stream(source: str) -> bool:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "quiet", "-show_streams", "-select_streams", "v",
        "-of", "json", source,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    stdout, _ = await proc.communicate()
    try:
        return len(json.loads(stdout).get("streams", [])) > 0
    except Exception:
        return False


async def extract_frames(source: str, target_frames: int = 30, is_url: bool = True, crop_filter: str = "") -> AsyncGenerator[dict, None]:
    url = normalize_video_url(source) if is_url else source

    if not await _has_video_stream(url):
        raise RuntimeError("This file has no video stream. Make sure you're uploading a video file, not audio-only.")

    duration = await _get_duration(url)
    # Space frames evenly across the full video; clamp interval to 5–30 s
    interval = max(5.0, min(30.0, duration / target_frames)) if duration > 0 else 15.0

    tmp_dir = tempfile.mkdtemp(prefix="bjj-frames-")

    try:
        cmd = ["ffmpeg", "-y"]
        if is_url and (url.startswith("http://") or url.startswith("https://")):
            cmd += ["-headers", "User-Agent: Mozilla/5.0\r\n"]
        crop_part = f"{crop_filter}," if crop_filter else ""
        cmd += [
            "-i", url,
            "-vf", f"fps=1/{interval:.1f},{crop_part}scale=720:-2,unsharp=5:5:1.0:5:5:0.0",
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
            for frame in _read_new_frames(tmp_dir, seen, interval):
                yield frame

        await proc.wait()
        if proc.returncode != 0:
            stderr = (await proc.stderr.read()).decode()
            raise RuntimeError(f"ffmpeg error: {stderr[-300:]}")

        for frame in _read_new_frames(tmp_dir, seen, interval):
            yield frame

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
