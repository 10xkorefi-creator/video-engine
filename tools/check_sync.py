"""Measure caption/voice sync on a finished reel.

Re-transcribes (a) the raw voice track and (b) the final MP4's mixed audio with Scribe,
aligns the two word sequences, and compares each caption word's on-screen start time
(from the composition) with when that word is actually heard in the final video.

    python3 tools/check_sync.py out/<job-dir>
Needs OPENROUTER_API_KEY in the environment (or an egress proxy that injects it).
"""
import difflib
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile
import urllib.request
import uuid

API = "https://openrouter.ai/api/v1/audio/transcriptions"


def transcribe(path):
    boundary = uuid.uuid4().hex
    parts = []
    for k, v in [("model", "elevenlabs/scribe-v2"), ("response_format", "verbose_json"), ("timestamp_granularities[]", "word")]:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode())
    parts.append(open(path, "rb").read())
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    req = urllib.request.Request(API, data=b"".join(parts), method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    if os.environ.get("OPENROUTER_API_KEY"):
        req.add_header("Authorization", "Bearer " + os.environ["OPENROUTER_API_KEY"])
    return json.load(urllib.request.urlopen(req, timeout=180))["words"]


def norm(w):
    return re.sub(r"[^\w₹%]", "", w.lower())


def main(job):
    project = os.path.join(job, "project")
    mp4 = next(f for f in os.listdir(job) if f.endswith(".mp4"))
    html = open(os.path.join(project, "index.html"), encoding="utf8").read()
    data = json.loads(re.search(r"const DATA = (\{.*?\});\n", html).group(1))
    cap_starts = [w["s"] for c in data["caps"] for w in c["words"]]

    with tempfile.TemporaryDirectory() as tmp:
        final_audio = os.path.join(tmp, "final.mp3")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", os.path.join(job, mp4), "-vn", "-b:a", "128k", final_audio], check=True)
        voice = transcribe(os.path.join(project, "voice.mp3"))   # caption words come from this, in order
        heard = transcribe(final_audio)

    a = [norm(w["word"]) for w in voice]
    b = [norm(w["word"]) for w in heard]
    diffs = []
    for blk in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            i, j = blk.a + k, blk.b + k
            if i < len(cap_starts) and a[i]:
                diffs.append(cap_starts[i] - heard[j]["start"])
    abs_ms = sorted(abs(d) * 1000 for d in diffs)
    print(json.dumps({
        "caption_words": len(cap_starts),
        "matched_words": len(diffs),
        "mean_offset_ms": round(statistics.mean(diffs) * 1000, 1),
        "median_abs_ms": round(statistics.median(abs_ms), 1),
        "p90_abs_ms": round(abs_ms[int(len(abs_ms) * 0.9) - 1], 1),
        "max_abs_ms": round(abs_ms[-1], 1),
        "within_100ms_pct": round(100 * sum(x <= 100 for x in abs_ms) / len(abs_ms), 1),
    }, indent=1))


if __name__ == "__main__":
    main(sys.argv[1])
