#!/usr/bin/env python3
"""Read-only Chronburg day 1–7 static smoke test; no secret key required."""
from __future__ import annotations

from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html"] + [f"day{n:02d}.html" for n in range(2, 8)]
EXTRA_JS = ["js/chronburg-release-client.js", "js/chronburg-collection.js",
            "js/chronburg-math.js"]
PUBLIC_ASSET = re.compile(
    r"assets/(?:locations|characters|ornaments|maps|trees|ui|pic/"
    r"(?:oge_osn|oge_reserve|ege_osn|ege_reserve))/"
    r"[A-Za-z0-9._/-]+\\.(?:png|webp|svg|jpe?g)"
)
DOM_ID = re.compile(r'(?:\\$\\(|getElementById\\()\\s*["\\']([^"\\']+)["\\']\\s*\\)')
ISSUES: list[str] = []
WARNINGS: list[str] = []

class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.dependencies: list[str] = []
        self.inline_scripts: list[str] = []
        self.in_inline_script = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        meta = dict(attrs)
        if meta.get("id"):
            self.ids.append(str(meta["id"]))
        if tag in {"script", "img", "link"}:
            for field in ("src", "href"):
                value = meta.get(field)
                if value and not value.startswith(("https://", "http://", "#", "data:")):
                    self.dependencies.append(value.split("?")[0])
        if tag == "script" and not meta.get("src"):
            self.in_inline_script = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self.in_inline_script = False

    def handle_data(self, data: str) -> None:
        if self.in_inline_script:
            self.inline_scripts.append(data)


def exists(path: str) -> bool:
    # Never check remote URLs or parent paths. All expected references are relative.
    if not path or path.startswith("/") or ".." in Path(path).parts:
        return False
    return (ROOT / path).is_file()


def scan_assets(label: str, content: str) -> None:
    for asset in sorted(set(PUBLIC_ASSET.findall(content))):
        if not exists(asset):
            ISSUES.append(f"{label}: referenced image does not exist: {asset}")


for page in PAGES:
    file = ROOT / page
    if not file.is_file():
        ISSUES.append(f"Missing game page: {page}")
        continue
    text = file.read_text(encoding="utf-8")
    parsed = PageParser()
    parsed.feed(text)
    duplicates = sorted({item for item in parsed.ids if parsed.ids.count(item) > 1})
    if duplicates:
        ISSUES.append(f"{page}: repeated HTML IDs: {', '.join(duplicates)}")
    for dep in parsed.dependencies:
        if not exists(dep):
            ISSUES.append(f"{page}: missing linked file {dep}")
    js = "\\n".join(parsed.inline_scripts)
    for dep in parsed.dependencies:
        if dep.endswith(".js") and exists(dep):
            js += "\\n" + (ROOT / dep).read_text(encoding="utf-8")
    known_ids = set(parsed.ids)
    missing = sorted({ref for ref in DOM_ID.findall(js) if ref not in known_ids})
    if missing:
        ISSUES.append(f"{page}: missing HTML nodes referenced by JS: {', '.join(missing)}")
    scan_assets(page, text + "\\n" + js)
    for dep in parsed.dependencies:
        if dep.endswith(".css") and exists(dep):
            scan_assets(dep, (ROOT / dep).read_text(encoding="utf-8"))

for path in EXTRA_JS:
    if exists(path):
        scan_assets(path, (ROOT / path).read_text(encoding="utf-8"))

release = ROOT / "js/chronburg-release-client.js"
if release.is_file():
    data = release.read_text(encoding="utf-8")
    for day in range(2, 8):
        if f'{day}: "2026-12-{day:02d}"' not in data:
            ISSUES.append(f"Release client missing December {day} date")

for day in range(4, 8):
    locked = ROOT / f"data/locked/day{day:02d}-2026.enc.json"
    if not locked.is_file():
        ISSUES.append(f"Missing encrypted bank for day {day}")

if not exists("data/locked/days-2026.enc.json"):
    ISSUES.append("Missing encrypted base bank for days 2 and 3")

# Screen-filling 3D assets may load slowly on tablets; this is a warning, not a build failure.
locations = ROOT / "assets/locations"
if locations.is_dir():
    for day in range(1, 8):
        files = list(locations.glob(f"day{day:02d}_*"))
        total = sum(p.stat().st_size for p in files if p.is_file())
        if total > 12 * 1024 * 1024:
            WARNINGS.append(f"Day {day}: location textures total {total / 1024**2:.1f} MiB; review tablet load speed")

for warning in WARNINGS:
    print("WARN:", warning)
if ISSUES:
    for issue in ISSUES:
        print("FAIL:", issue)
    sys.exit(1)
print(f"PASS: {len(PAGES)} scenes, links, DOM IDs, static images, release calendar and locked banks")
