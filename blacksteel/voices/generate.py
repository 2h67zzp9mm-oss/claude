"""Generate every spoken line with ElevenLabs and pack them into one audio file per chapter.

Needs ELEVENLABS_API_KEY in the environment and network access to api.elevenlabs.io.

    python3 blacksteel/voices/extract_lines.py     # after any story change
    python3 blacksteel/voices/generate.py          # generates only lines that are new or changed
    python3 blacksteel/voices/generate.py --list   # show the voices your account can use

Writes voices/chN.mp3 (one per chapter) and voices/manifest.json, which maps each line to
[chapter, start seconds, duration seconds]. Per-line audio is cached in voices/cache/ (not committed).
"""
import hashlib, json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
API = "https://api.elevenlabs.io/v1"
FORMAT = "mp3_44100_64"

def key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    if not k: sys.exit("ELEVENLABS_API_KEY is not set. Add it in the environment settings and start a new session.")
    return k

def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": key(), "Content-Type": "application/json", "Accept": "*/*"},
                                 method="POST" if body else "GET")
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(2 ** attempt * 2); continue
            sys.exit(f"ElevenLabs error {e.code} on {path}: {msg[:400]}")
        except urllib.error.URLError as e:
            if attempt < 4: time.sleep(2 ** attempt * 2); continue
            sys.exit(f"Could not reach ElevenLabs ({e.reason}). Is api.elevenlabs.io allowed in the network settings?")

# ---- MP3 frame parsing, to know exactly where each line starts inside a chapter file ----
BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
RATES = [44100, 48000, 32000]
def mp3_frames(data):
    """Return (audio bytes without ID3 tags, number of 1152-sample frames, sample rate)."""
    i = 0
    if data[:3] == b"ID3":
        size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
        i = 10 + size
    out, frames, rate = bytearray(), 0, 44100
    while i + 4 <= len(data):
        h = data[i:i + 4]
        if h[0] != 0xFF or (h[1] & 0xE0) != 0xE0:
            i += 1; continue
        br = BITRATES[(h[2] >> 4) & 0xF] * 1000
        rate = RATES[(h[2] >> 2) & 3]
        pad = (h[2] >> 1) & 1
        if not br: i += 1; continue
        n = 144 * br // rate + pad
        out += data[i:i + n]; frames += 1; i += n
    return bytes(out), frames, rate

def main():
    cast = json.load(open(os.path.join(HERE, "cast.json")))
    if "--list" in sys.argv:
        for v in json.loads(call("/voices"))["voices"]:
            print(v["voice_id"], "|", v["name"], "|", ", ".join(f"{k}: {x}" for k, x in (v.get("labels") or {}).items()))
        return
    lines = json.load(open(os.path.join(HERE, "lines.json"), encoding="utf-8"))
    os.makedirs(CACHE, exist_ok=True)
    todo = []
    for l in lines:
        v = cast["voices"][l["voice"]]
        sig = json.dumps([cast["model_id"], v["voice_id"], v["stability"], v["similarity_boost"], v["style"], l["text"]])
        l["file"] = os.path.join(CACHE, hashlib.sha1(sig.encode()).hexdigest() + ".mp3")
        if not os.path.exists(l["file"]): todo.append((l, v))
    chars = sum(len(l["text"]) for l, _ in todo)
    print(f"{len(lines)} lines, {len(todo)} to generate ({chars} characters)")
    for n, (l, v) in enumerate(todo, 1):
        audio = call(f"/text-to-speech/{v['voice_id']}?output_format={FORMAT}", {
            "text": l["text"], "model_id": cast["model_id"],
            "voice_settings": {"stability": v["stability"], "similarity_boost": v["similarity_boost"], "style": v["style"], "use_speaker_boost": True}
        })
        open(l["file"], "wb").write(audio)
        print(f"  [{n}/{len(todo)}] {l['voice']}: {l['text'][:60]}")
    # pack one file per chapter
    manifest, chapters = {}, {}
    for l in lines: chapters.setdefault(l["chapter"], []).append(l)
    for ch, group in sorted(chapters.items()):
        buf, t = bytearray(), 0.0
        for l in group:
            audio, frames, rate = mp3_frames(open(l["file"], "rb").read())
            dur = frames * 1152 / rate
            manifest[l["key"]] = [ch, round(t, 4), round(dur, 4)]
            buf += audio; t += dur
        open(os.path.join(HERE, f"ch{ch}.mp3"), "wb").write(buf)
        print(f"chapter {ch + 1}: {len(group)} lines, {t / 60:.1f} min, {len(buf) / 1e6:.1f} MB")
    json.dump(manifest, open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("Wrote manifest.json. Publish the game with the voices/ files included.")

if __name__ == "__main__":
    main()
