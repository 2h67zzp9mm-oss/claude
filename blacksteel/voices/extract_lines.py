"""Collect every spoken line in the game, with who speaks it and which chapter it belongs to.

Writes voices/lines.json: [{"key": "<voice>|<text>", "voice": ..., "text": ..., "chapter": n}]
The key matches what index.html looks up at runtime, so a line plays only if its text is identical.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
story = open(os.path.join(ROOT, "story.js"), encoding="utf-8").read()
index = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

STR = r'"((?:[^"\\]|\\.)*)"'
# Speaker codes in the scripts, and the voice each one uses.
VOICE = {"N": "Shannon", "R": "Shannon", "CAP": "Narrator", "S": "Sean", "Deke": "Deke", "Mercer": "Mercer",
         "Nia": "Nia", "Harrow": "Harrow", "Lily": "Lily", "Lily's mother": "LilyMother"}

def unescape(s):
    return json.loads('"' + s + '"')

lines, seen = [], set()
def add(voice, text, ch):
    text = unescape(text) if "\\" in text else text
    key = voice + "|" + text
    if key in seen or not text.strip():
        return
    seen.add(key)
    lines.append({"key": key, "voice": voice, "text": text, "chapter": ch})

def match_bracket(s, i, open_c="[", close_c="]"):
    """Index of the bracket that closes the one at s[i], skipping over string literals."""
    depth, j = 0, i
    while j < len(s):
        c = s[j]
        if c == '"':
            j += 1
            while j < len(s) and s[j] != '"':
                j += 2 if s[j] == "\\" else 1
        elif c == open_c: depth += 1
        elif c == close_c:
            depth -= 1
            if depth == 0: return j
        j += 1
    return len(s)

# chapter boundaries in story.js
bounds = [m.start() for m in re.finditer(r"CH\.push\(", story)]
def chapter_at(pos):
    n = 0
    for i, b in enumerate(bounds):
        if pos >= b: n = i
    return n

# sister lines: sis(G, <spoken by Hazel>, <spoken by Olive>)
sis_spans = []
for m in re.finditer(r"sis\(G,\s*", story):
    a0 = m.end(); a1 = match_bracket(story, a0)
    b0 = story.index("[", a1 + 1); b1 = match_bracket(story, b0)
    sis_spans.append((a0, a1, "Hazel")); sis_spans.append((b0, b1, "Olive"))
def sister_voice(pos):
    for a, b, v in sis_spans:
        if a <= pos <= b: return v
    return None

def scan(src, chapter_fn):
    for m in re.finditer(r'\[\s*"([^"]+)"\s*,\s*' + STR + r'\s*\]', src):
        sp, txt = m.group(1), m.group(2)
        ch = chapter_fn(m.start())
        if sp == "SIS":
            v = sister_voice(m.start()) if src is story else None
            if v: add(v, txt, ch)
            else: add("Olive", txt, ch); add("Hazel", txt, ch)
        elif sp in VOICE:
            add(VOICE[sp], txt, ch)
    # say("X", ...) including conditional text: every string inside the call
    for m in re.finditer(r'say\(\s*"([^"]+)"\s*,', src):
        if m.group(1) not in VOICE: continue
        end = match_bracket(src, m.start() + 3, "(", ")")
        for t in re.findall(STR, src[m.end():end]): add(VOICE[m.group(1)], t, chapter_fn(m.start()))
    # narration stored in objects and read with G.say("N", m.say) / G.say("N", m.done)
    for m in re.finditer(r'\b(?:say|done):\s*' + STR, src):
        add("Shannon", m.group(1), chapter_fn(m.start()))
    # chapter cards: card("Chapter One", "The Call", "subtitle")
    for m in re.finditer(r'card\(\s*' + STR + r'\s*,\s*' + STR + r'\s*,\s*' + STR, src):
        add("Narrator", m.group(3), chapter_fn(m.start()))
    for m in re.finditer(r'(?:said|fix)\(\s*' + STR, src):
        add("Sean", m.group(1), chapter_fn(m.start()))
    # choice prompts are read by Shannon
    for m in re.finditer(r'(?:choose|ask)\(\s*(?:G,\s*)?' + STR, src):
        add("Shannon", m.group(1), chapter_fn(m.start()))
    # corrections inside fix("label", "correction")
    for m in re.finditer(r'fix\(\s*' + STR + r'\s*,\s*' + STR, src):
        add("Shannon", m.group(2), chapter_fn(m.start()))
    # hints are read by Shannon
    for m in re.finditer(r'hint[^\n]*', src):
        for s in re.findall(STR, m.group(0)):
            if len(s) > 12: add("Shannon", s, chapter_fn(m.start()))
    for m in re.finditer(r'hint\(\)\s*\{', src):
        body = src[m.end(): match_bracket(src, m.end() - 1, "{", "}")]
        for s in re.findall(STR, body):
            if len(s) > 12: add("Shannon", s, chapter_fn(m.start()))

scan(story, chapter_at)
# the NOPE lines and other Shannon asides defined as plain strings in arrays
for m in re.finditer(r"const NOPE = \[(.*?)\];", story, re.S):
    for s in re.findall(STR, m.group(1)): add("Shannon", s, 0)
# lines built from the player's name
for name in ("Olive", "Hazel"):
    add("Shannon", "Tonight, " + name + ", you are going to be your father. Younger. One bad ship. No plan.", 0)
# index.html: Lily's cutscene, the newspaper headline
js = index[index.rindex("<script>"):]
scan(js, lambda pos: 0)
add("Narrator", "Blacksteel Butcher destroys Fleet relief force.", 8)

json.dump(lines, open(os.path.join(HERE, "lines.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
from collections import Counter
c = Counter(l["voice"] for l in lines)
chars = sum(len(l["text"]) for l in lines)
print(len(lines), "lines,", chars, "characters")
for v, n in c.most_common(): print(f"  {v:11} {n}")
