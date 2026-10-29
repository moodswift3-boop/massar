from pathlib import Path
import re
import xml.etree.ElementTree as ET
import sys

ROOT = Path(".")
PAGES = ["index.html", "visual-library.html", "swiftmedia.html", "launch.html"]
errors = []

def require(condition, message):
    if not condition:
        errors.append(message)

for name in PAGES:
    path = ROOT / name
    require(path.is_file(), f"Missing published page: {name}")
    if not path.is_file():
        continue
    html = path.read_text(encoding="utf-8")
    require('<html lang="ar" dir="rtl">' in html, f"{name}: Arabic RTL metadata missing")
    require("</html>" in html.lower(), f"{name}: closing html tag missing")
    require("<title>" in html.lower(), f"{name}: page title missing")
    for i, match in enumerate(re.finditer(r'<script\b[^>]*>(.*?)</script>', html, re.I | re.S)):
        script = match.group(1)
        if script.strip():
            out = Path("/tmp") / f"massar-{Path(name).stem}-{i}.js"
            out.write_text(script, encoding="utf-8")
    print(f"PASS page structure: {name}")

main = (ROOT / "index.html").read_text(encoding="utf-8")
for marker in ["N1", "N2", "N3", "N4", "N5", "massar-progress-v2", "data-open-unit", "localStorage.setItem", "resetProgress"]:
    require(marker in main, f"Homepage missing core interaction marker: {marker}")
require(main.count("subs:[") == 5, "Homepage should define exactly five rehabilitation paths")
require("aria-valuenow" in main and "role=\"progressbar\"" in main, "Progress indicator must expose accessible progress semantics")
require("backTop" in main, "Back-to-top interaction missing")
require('id="privacy"' in main and "لا تكتب كلمات مرور" in main, "Privacy and sensitive-data guidance missing")
require("قابلة للتنفيذ على الأقل" in main, "Worksheet completion must require a goal and first step")
require("التأهيل الرياضي والهوايات الفردية" in main, "N3 canonical title missing from homepage")
print("PASS homepage paths, progress storage, and navigation markers")

visual = (ROOT / "visual-library.html").read_text(encoding="utf-8")
lessons = list(re.finditer(r'<article class="lesson" id="([^"]+)"([\s\S]*?)(?=<article class="lesson"|</main>)', visual))
ids = [m.group(1) for m in lessons]
require(len(lessons) == 39, f"Expected 39 visual lessons, found {len(lessons)}")
require(len(ids) == len(set(ids)), "Duplicate visual lesson IDs detected")
questions = []
for match in lessons:
    lesson_id, body = match.group(1), match.group(2)
    qmatch = re.search(r'<div class="quiz">([\s\S]*?)</div>', body)
    require(bool(qmatch), f"{lesson_id}: quiz block missing")
    if not qmatch:
        continue
    quiz = qmatch.group(1)
    prompt = re.search(r'<p>(.*?)</p>', quiz)
    prompt_text = re.sub(r'<[^>]+>', '', prompt.group(1)).strip() if prompt else ""
    questions.append(prompt_text)
    options = re.findall(r'<input type="radio"[^>]*value="([^"]+)"', quiz)
    answer = re.search(r'data-answer="([^"]+)"', quiz)
    require(bool(prompt_text), f"{lesson_id}: question text missing")
    require(len(options) == 3, f"{lesson_id}: expected exactly 3 answer options")
    require(bool(answer) and answer.group(1) in options, f"{lesson_id}: correct answer does not match an option")
    require(f'data-check="{lesson_id}"' in quiz and f'id="f-{lesson_id}"' in quiz, f"{lesson_id}: quiz feedback wiring missing")
require(len(questions) == len(set(questions)), "Review question prompts must be unique across lessons")
require("اختيار الرياضة والهواية المناسبة" in visual, "N3 sports/hobbies pathway title missing")
require("التأهيل البدني والصحي" not in visual, "Outdated N3 path label remains in visual library")
require("فيديو مختار لهذه الوحدة" in visual, "Every lesson should present a specifically selected video")
require("youtube.com/results?search_query" not in visual, "Generic YouTube search links must be removed")
require(visual.count("فيديو مختار لهذه الوحدة") == 39, "Each of the 39 lessons must have one direct video resource")
require("localStorage.getItem(k)" in visual and "localStorage.setItem(k" in visual, "Visual exercise progress persistence missing")
require("data-check" in visual and "aria-live=\"polite\"" in visual, "Quiz feedback accessibility missing")
# New-tab external links should opt out of opener access.
for tag in re.findall(r'<a\b[^>]*target="_blank"[^>]*>', visual, re.I):
    require('rel="noopener noreferrer"' in tag, "External new-tab link missing rel=noopener noreferrer")
print(f"PASS visual library: {len(lessons)} lessons, {len(questions)} distinct quiz prompts, answer wiring, and local exercise persistence")

# Syntax-check every non-empty inline JavaScript block in CI.
scripts = list(Path("/tmp").glob("massar-*.js"))
require(bool(scripts), "No inline JavaScript was extracted for syntax checking")
# Validate crawl-discovery files and ensure the published sitemap points to real pages.
sitemap_path = ROOT / "sitemap.xml"
robots_path = ROOT / "robots.txt"
require(sitemap_path.is_file(), "Missing sitemap.xml")
require(robots_path.is_file(), "Missing robots.txt")
if sitemap_path.is_file():
    try:
        sitemap_root = ET.parse(sitemap_path).getroot()
        expected_root = "{http://www.sitemaps.org/schemas/sitemap/0.9}urlset"
        require(sitemap_root.tag == expected_root, "sitemap.xml must use the standard sitemap urlset namespace")
        sitemap_urls = [
            node.text.strip()
            for node in sitemap_root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
            if node.text and node.text.strip()
        ]
        require(bool(sitemap_urls), "sitemap.xml must contain at least one URL")
        expected_urls = {
            "https://moodswift3-boop.github.io/massar/": "index.html",
            "https://moodswift3-boop.github.io/massar/launch.html": "launch.html",
            "https://moodswift3-boop.github.io/massar/visual-library.html": "visual-library.html",
            "https://moodswift3-boop.github.io/massar/swiftmedia.html": "swiftmedia.html",
        }
        for url, page in expected_urls.items():
            require(url in sitemap_urls, f"sitemap.xml missing expected page: {url}")
            require((ROOT / page).is_file(), f"sitemap URL maps to missing page: {page}")
        for url in sitemap_urls:
            require(url in expected_urls, f"sitemap.xml lists an unexpected URL: {url}")
    except ET.ParseError as exc:
        require(False, f"sitemap.xml is not valid XML: {exc}")
if robots_path.is_file():
    robots = robots_path.read_text(encoding="utf-8")
    require("User-agent: *" in robots and "Allow: /" in robots, "robots.txt should allow public crawling")
    require("Sitemap: https://moodswift3-boop.github.io/massar/sitemap.xml" in robots, "robots.txt sitemap URL missing or incorrect")
print("PASS sitemap.xml and robots.txt structure and page references")

if errors:
    print("\nQA FAILED:")
    for error in errors:
        print(" - " + error)
    sys.exit(1)
print(f"PASS static QA checks; extracted {len(scripts)} inline JavaScript block(s) for node --check")
