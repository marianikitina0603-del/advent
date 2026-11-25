#!/usr/bin/env python3
"""Release Chronburg exam tasks after their Europe/Moscow calendar date."""
import argparse
import base64
from datetime import datetime, date
import json
import os
from pathlib import Path
import sys
import zlib
from zoneinfo import ZoneInfo
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

AAD = b"chronburg-2026-daily-release-v1"
ROOT = Path(__file__).resolve().parents[1]
LOCKED = ROOT / "data" / "locked" / "days-2026.enc.json"

def decode_bank(key_b64: str) -> dict:
    if not key_b64:
        raise RuntimeError("Missing CHRONBURG_RELEASE_KEY GitHub Actions secret")
    key = base64.b64decode(key_b64, validate=True)
    if len(key) != 32:
        raise ValueError("CHRONBURG_RELEASE_KEY must decode to 32 bytes")
    package = json.loads(LOCKED.read_text(encoding="utf-8"))
    if package.get("scheme") != "aes-256-gcm+zlib" or package.get("version") != 1:
        raise ValueError("Unsupported encrypted bank format")
    nonce = base64.b64decode(package["nonce"], validate=True)
    ciphertext = base64.b64decode(package["ciphertext"], validate=True)
    plaintext = AESGCM(key).decrypt(nonce, ciphertext, AAD)
    bank = json.loads(zlib.decompress(plaintext))
    if bank.get("version") != 1 or bank.get("timezone") != "Europe/Moscow":
        raise ValueError("Invalid bank manifest")
    return bank

def validate_day(payload, day):
    if payload.get("kind") != f"chronburg-private-day{day}" or payload.get("day") != day:
        raise ValueError(f"Day {day}: unexpected payload identity")
    exams = payload.get("exams")
    if not isinstance(exams, dict):
        raise ValueError(f"Day {day}: missing exams")
    for exam, expected in (("oge", 3), ("ege", 4)):
        tasks = exams.get(exam)
        if not isinstance(tasks, list) or len(tasks) != expected:
            raise ValueError(f"Day {day} {exam}: expected {expected} tasks")
        for index, item in enumerate(tasks, 1):
            for task in (item, item.get("reserve")):
                if not isinstance(task, dict) or not str(task.get("text", "")).strip():
                    raise ValueError(f"Day {day} {exam} task {index}: missing text/reserve")
                if task.get("answer") is None or not str(task["answer"]).strip():
                    raise ValueError(f"Day {day} {exam} task {index}: missing answer")
                if task.get("review_status") in ("requires_image_visual_review", "needs_review"):
                    raise ValueError(f"Day {day} {exam} task {index}: key not reviewed")
                image = task.get("image")
                if image:
                    imagepath = (ROOT / image).resolve()
                    if not imagepath.is_relative_to(ROOT / "assets") or not imagepath.is_file():
                        raise ValueError(f"Day {day} {exam} task {index}: missing/unsafe image {image}")

def publish(as_of: date, dry_run: bool):
    bank = decode_bank(os.environ.get("CHRONBURG_RELEASE_KEY", ""))
    changed = []
    for day_str, record in sorted(bank["days"].items(), key=lambda p: int(p[0])):
        day = int(day_str)
        release_date = date.fromisoformat(record["release_date"])
        if as_of < release_date:
            print(f"Day {day:02d}: locked until {release_date.isoformat()} Europe/Moscow")
            continue
        payload = record["payload"]
        validate_day(payload, day)
        output = ROOT / "data" / f"day{day:02d}.json"
        canonical = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        if output.exists():
            if output.read_text(encoding="utf-8") != canonical:
                raise RuntimeError(f"Day {day:02d}: existing release differs; refusing overwrite")
            print(f"Day {day:02d}: already published")
            continue
        changed.append(str(output.relative_to(ROOT)))
        if not dry_run:
            output.write_text(canonical, encoding="utf-8")
        print(f"Day {day:02d}: {'eligible (dry run)' if dry_run else 'published'}")
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file and not dry_run:
        with open(output_file, "a", encoding="utf-8") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")
            f.write(f"published_files={','.join(changed)}\n")
    return len(changed)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--as-of", help="YYYY-MM-DD; allowed only for dry-run")
    args = parser.parse_args()
    if args.as_of and not args.dry_run:
        parser.error("--as-of is only allowed with --dry-run")
    now = date.fromisoformat(args.as_of) if args.as_of else datetime.now(ZoneInfo("Europe/Moscow")).date()
    print("Chronburg cutoff date:", now.isoformat(), "(Europe/Moscow)")
    publish(now, args.dry_run)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
