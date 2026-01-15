import csv
import json

INPUT_CSV = "schedule.csv"
OUTPUT_JS = "scheduleData.js"

def ddmmyyyy_to_iso(s):
    # 01/02/2026 -> 2026-02-01
    if not s or "/" not in s:
        return s
    dd, mm, yyyy = s.split("/")
    return f"{yyyy}-{mm.zfill(2)}-{dd.zfill(2)}"

data = []

with open(INPUT_CSV, "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader, start=1):
        date_raw = row.get("Date dd/mm/yyyy", "").strip()
        time_raw = row.get("Time HH:MM", "").strip()
        home = row.get("Home Team", "").strip()
        away = row.get("Away Team", "").strip()

        if not date_raw or not time_raw or not home or not away:
            continue

        item = {
            "id": f"s_{i}",
            "date": ddmmyyyy_to_iso(date_raw),
            "time": time_raw,
            "home": home,
            "away": away,
            "venue": row.get("Venue", "").strip(),
            "pitch": row.get("Pitch", "").strip(),
            "division": row.get("Division", "").strip(),
            "homeScore": None,
            "awayScore": None,
            "playerEvents": []
        }
        data.append(item)

js = "module.exports = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n"

with open(OUTPUT_JS, "w", encoding="utf-8") as f:
    f.write(js)

print(f"✅ Done! Generated: {OUTPUT_JS}, matches: {len(data)}")
