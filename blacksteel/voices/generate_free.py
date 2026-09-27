"""Voice every line for free with the open-source Kokoro model, and pack one audio file per chapter.

No account or key. First run downloads the model (about 350 MB) into voices/model/ (not committed).

    pip install kokoro-onnx soundfile lameenc
    python3 blacksteel/voices/extract_lines.py    # after any story change
    python3 blacksteel/voices/generate_free.py    # voices only new or changed lines

Writes voices/chN.mp3 and voices/manifest.json (the same format generate.py writes for ElevenLabs),
mapping each line to [chapter, start seconds, duration seconds]. Per-line audio is cached in
voices/cache_free/ (not committed), so reruns only voice what changed.
"""
import hashlib, json, os, sys, time, urllib.request
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(HERE, "model")
CACHE = os.path.join(HERE, "cache_free")
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
GAP = 0.12      # seconds of silence after each line inside a chapter file
BITRATE = 48    # kbps, mono: plenty for speech

def model():
    os.makedirs(MODEL_DIR, exist_ok=True)
    for f in FILES:
        p = os.path.join(MODEL_DIR, f)
        if not os.path.exists(p):
            print("downloading", f, "...")
            urllib.request.urlretrieve(MODEL_URL + f, p + ".part")
            os.replace(p + ".part", p)
    from kokoro_onnx import Kokoro
    return Kokoro(os.path.join(MODEL_DIR, FILES[0]), os.path.join(MODEL_DIR, FILES[1]))

def main():
    import lameenc
    cast = json.load(open(os.path.join(HERE, "cast_free.json")))["voices"]
    lines = json.load(open(os.path.join(HERE, "lines.json"), encoding="utf-8"))
    os.makedirs(CACHE, exist_ok=True)
    k, sr = None, 24000
    todo = []
    for l in lines:
        c = cast[l["voice"]]
        sig = json.dumps(["kokoro-v1.0", c["voice"], c["speed"], c["lang"], l["text"]])
        l["file"] = os.path.join(CACHE, hashlib.sha1(sig.encode()).hexdigest() + ".npy")
        if not os.path.exists(l["file"]): todo.append((l, c))
    print(f"{len(lines)} lines, {len(todo)} to voice")
    t0 = time.time()
    for n, (l, c) in enumerate(todo, 1):
        if k is None: k = model()
        audio, sr = k.create(l["text"], voice=c["voice"], speed=c["speed"], lang=c["lang"])
        np.save(l["file"], (np.clip(audio, -1, 1) * 32767).astype(np.int16))
        if n % 25 == 0 or n == len(todo): print(f"  {n}/{len(todo)} ({time.time() - t0:.0f}s)")
    chapters = {}
    for l in lines: chapters.setdefault(l["chapter"], []).append(l)
    manifest = {}
    gap = np.zeros(int(sr * GAP), dtype=np.int16)
    for ch, group in sorted(chapters.items()):
        parts, t = [], 0.0
        for l in group:
            pcm = np.load(l["file"])
            dur = len(pcm) / sr
            manifest[l["key"]] = [ch, round(t, 4), round(dur, 4)]
            parts += [pcm, gap]; t += dur + GAP
        enc = lameenc.Encoder()
        enc.set_bit_rate(BITRATE); enc.set_in_sample_rate(sr); enc.set_channels(1); enc.set_quality(2)
        data = enc.encode(np.concatenate(parts).tobytes()) + enc.flush()
        open(os.path.join(HERE, f"ch{ch}.mp3"), "wb").write(data)
        print(f"chapter {ch + 1}: {len(group)} lines, {t / 60:.1f} min, {len(data) / 1e6:.1f} MB")
    json.dump(manifest, open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("Wrote manifest.json.")

if __name__ == "__main__":
    main()
