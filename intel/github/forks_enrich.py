#!/usr/bin/env python3
"""Enrich our forks with upstream parent/source via batched GraphQL -> forks_catalog."""
import os, sqlite3, subprocess, json, datetime
from categorize import category_for

WS = os.path.expanduser("~/dev/gh-inventory")
db = sqlite3.connect(os.path.join(WS, "inventory.db"))
TOKEN = subprocess.check_output(["gh", "auth", "token"]).decode().strip()
import urllib.request

NOW = datetime.datetime.now(datetime.timezone.utc)
def years_since(ts):
    if not ts: return None
    try:
        d = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return round((NOW - d).days / 365.25, 1)
    except Exception:
        return None

def gql(query):
    req = urllib.request.Request("https://api.github.com/graphql",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"bearer {TOKEN}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

forks = db.execute("""SELECT full_name, bucket, owner, name, language, topics, pushed_at, url
                      FROM repos WHERE is_fork=1""").fetchall()
print("forks to enrich:", len(forks))

FRAG = """  a%d: repository(owner:%s, name:%s) {
    nameWithOwner isFork
    parent { nameWithOwner url stargazerCount pushedAt description isArchived primaryLanguage{name} }
  }"""

def q(s): return json.dumps(s)  # JSON-quote -> valid GraphQL string

BATCH = 70
done = 0
for i in range(0, len(forks), BATCH):
    chunk = forks[i:i+BATCH]
    parts = []
    for j, row in enumerate(chunk):
        owner, name = row[2], row[3]
        parts.append(FRAG % (j, q(owner), q(name)))
    query = "query{\n" + "\n".join(parts) + "\n}"
    try:
        resp = gql(query)
    except Exception as e:
        print("batch error", i, e); continue
    data = (resp or {}).get("data") or {}
    for j, row in enumerate(chunk):
        full_name, bucket, owner, name, language, topics, pushed_at, url = row
        node = data.get(f"a{j}")
        parent = (node or {}).get("parent") or {}
        source = parent  # GraphQL exposes only direct parent; treat as upstream source
        up = parent
        up_lang = (up.get("primaryLanguage") or {}).get("name") if up else None
        cat = category_for([name, up.get("description") if up else None, topics, language or up_lang], language or up_lang)
        db.execute("""INSERT OR REPLACE INTO forks_catalog
            (full_name,bucket,upstream,source,upstream_url,upstream_stars,upstream_pushed,
             upstream_desc,upstream_archived,upstream_lang,our_pushed_at,staleness_years,
             upstream_age_years,category,language,topics,our_url,learn_notes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'')""", (
            full_name, bucket,
            parent.get("nameWithOwner"), source.get("nameWithOwner"),
            (up.get("url") if up else None),
            (up.get("stargazerCount") if up else None),
            (up.get("pushedAt") if up else None),
            (up.get("description") if up else None),
            int(bool(up.get("isArchived"))) if up else None,
            up_lang, pushed_at, years_since(pushed_at),
            years_since(up.get("pushedAt") if up else None),
            cat, language, topics, url))
        done += 1
    db.commit()
    print(f"  {done}/{len(forks)}")

# coverage report
tot = db.execute("SELECT count(*) FROM forks_catalog").fetchone()[0]
withsrc = db.execute("SELECT count(*) FROM forks_catalog WHERE source IS NOT NULL").fetchone()[0]
print(f"catalog rows: {tot} | upstream resolved: {withsrc}")
db.close()
