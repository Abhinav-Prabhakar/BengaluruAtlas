#!/usr/bin/env python3
"""Resolve author and licence for the older Wikipedia-page photographs.

Places promoted from a Wikipedia article were given a page image and the
generic credit "Wikimedia Commons". That is not enough for a CC BY-SA image:
the author and licence have to travel with it. This script walks the atlas,
finds photographs without a licence, asks the Commons API for their metadata,
and writes data/wiki_photo_credits.json.

Images that are logos, hosted locally on English Wikipedia (usually non-free)
or missing from Commons are marked for removal. The atlas then falls back to a
neighbourhood photograph or a designed cover.

Stdlib only.
"""

from __future__ import annotations

import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "app" / "public" / "data" / "atlas.json"
OUT = ROOT / "data" / "wiki_photo_credits.json"
COMMONS = "https://commons.wikimedia.org/w/api.php"
UA = "BengaluruAtlas/1.0 (https://github.com/Abhinav-Prabhakar/BengaluruAtlas; abhinav@example.com)"
DROP_NAME = re.compile(
    r"logo|wordmark|seal|emblem|coat[_ ]of[_ ]arms|flag|icon|screenshot|poster",
    re.I,
)


def api(params: dict, tries: int = 4) -> dict:
    url = f"{COMMONS}?{urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': '2'})}"
    for attempt in range(tries):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": UA, "Accept": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except Exception as exc:  # noqa: BLE001 - retry the network
            wait = min(20, 2**attempt)
            print(f"  retry {attempt + 1} in {wait}s ({exc})")
            time.sleep(wait)
    return {}


def strip_html(value: str | None) -> str:
    if not value:
        return ""
    text = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def file_title(url: str) -> str | None:
    clean = urllib.parse.unquote((url or "").split("?")[0])
    tail = clean.rsplit("/", 1)[-1]
    tail = re.sub(r"^\d+px-", "", tail).replace("_", " ")
    if not tail or "." not in tail:
        return None
    return f"File:{tail}"


def main() -> None:
    atlas = json.loads(ATLAS.read_text())
    pending: dict[str, dict] = {}
    for place in atlas.get("places", []):
        image = place.get("img")
        if not image or place.get("imgLicense"):
            continue
        title = file_title(image)
        if not title:
            continue
        candidate = {"place": place["id"], "title": title}
        clean = urllib.parse.unquote(image).lower()
        if "/wikipedia/en/" in clean or clean.endswith(".svg"):
            candidate["drop"] = True
        elif DROP_NAME.search(title):
            candidate["drop"] = True
        pending[place["id"]] = candidate

    titles = [c["title"] for c in pending.values() if not c.get("drop")]
    resolved: dict[str, dict] = {}
    for start in range(0, len(titles), 40):
        batch = titles[start : start + 40]
        data = api(
            {
                "action": "query",
                "titles": "|".join(batch),
                "prop": "imageinfo",
                "iiprop": "url|extmetadata|mime",
                "iiurlwidth": "1280",
            }
        )
        for page in data.get("query", {}).get("pages", []):
            title = page.get("title", "")
            info = (page.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            license_name = strip_html(meta.get("LicenseShortName", {}).get("value"))
            credit = strip_html(meta.get("Artist", {}).get("value"))
            mime = info.get("mime", "")
            if not info.get("url") or not license_name:
                continue
            if "fair use" in license_name.lower() or "non-free" in license_name.lower():
                continue
            if mime and not mime.startswith("image/") or mime == "image/svg+xml":
                continue
            credit = re.sub(
                r"^The original uploader was (.+?) at English Wikipedia\s*\.?$",
                r"\1",
                credit,
            )
            credit = re.sub(r"\s*\(\s*talk\s*\)", "", credit, flags=re.I).strip()
            resolved[title.replace("_", " ")] = {
                "page": info.get("descriptionurl")
                or f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                "credit": credit or "Wikimedia Commons",
                "license": license_name,
            }
        time.sleep(0.35)

    # Keep a resolved manifest across runs: after the atlas build the photos
    # already have licences, so a second run has nothing new to look up.
    out: dict[str, dict] = {}
    if OUT.exists():
        try:
            out = json.loads(OUT.read_text())
        except json.JSONDecodeError:
            out = {}
    for place_id, candidate in pending.items():
        item = resolved.get(candidate["title"], {})
        if candidate.get("drop") or not item:
            out[place_id] = {
                "drop": True,
                "title": candidate["title"],
                "reason": "logo or no Commons licence",
            }
        else:
            out[place_id] = item
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    dropped = sum(1 for item in out.values() if item.get("drop"))
    print(f"resolved {len(out) - dropped}, dropped {dropped}, wrote {OUT}")


if __name__ == "__main__":
    main()
