#!/usr/bin/env python3
"""Load repos NDJSON + seed accounts (followers/following) into SQLite."""
import json, glob, os, sqlite3
from categorize import category_for

WS = os.path.expanduser("~/dev/gh-inventory")
RAW = os.path.join(WS, "raw")
ME = "mdheller"
db = sqlite3.connect(os.path.join(WS, "inventory.db"))
db.executescript(open(os.path.join(WS, "schema.sql")).read())

def load(path):
    out = []
    for l in open(path):
        l = l.strip()
        if l:
            try: out.append(json.loads(l))
            except json.JSONDecodeError: pass
    return out

def role(r):
    if r.get("fork"): return "fork"
    if r.get("owner") == ME: return "created (personal)"
    return "org-original"

# repos
seen = set(); n = 0
for p in sorted(glob.glob(os.path.join(RAW, "repos_*.ndjson"))):
    for r in load(p):
        fn = r.get("full_name")
        if fn in seen: continue
        seen.add(fn)
        cat = category_for([r.get("name"), r.get("description"), r.get("topics"), r.get("language")],
                           r.get("language"))
        db.execute("""INSERT OR REPLACE INTO repos VALUES
            (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
            fn, r.get("bucket"), r.get("owner"), r.get("name"), role(r), cat,
            int(bool(r.get("private"))), int(bool(r.get("fork"))), int(bool(r.get("archived"))),
            r.get("language"), r.get("stars"), r.get("forks"), r.get("pushed_at"),
            r.get("created_at"), r.get("description"), r.get("topics"), r.get("html_url")))
        n += 1
print("repos loaded:", n)

# seed accounts from followers/following
followers = {r["login"] for r in load(os.path.join(RAW, "followers.ndjson"))}
following = {r["login"] for r in load(os.path.join(RAW, "following.ndjson"))}
ftype = {r["login"]: r.get("type") for r in load(os.path.join(RAW, "followers.ndjson"))}
ftype.update({r["login"]: r.get("type") for r in load(os.path.join(RAW, "following.ndjson"))})
allacc = followers | following
for login in allacc:
    if login in followers and login in following: rel = "mutual"
    elif login in followers: rel = "follower"
    else: rel = "following"
    db.execute("""INSERT OR IGNORE INTO accounts (login, relation, type, url, crawled)
                  VALUES (?,?,?,?,0)""",
               (login, rel, ftype.get(login), f"https://github.com/{login}"))
    db.execute("UPDATE accounts SET relation=? WHERE login=?", (rel, login))

# seed the direct edges we already know: mdheller->following, follower->mdheller
for login in following:
    db.execute("INSERT OR IGNORE INTO edges VALUES (?,?)", (ME, login))
for login in followers:
    db.execute("INSERT OR IGNORE INTO edges VALUES (?,?)", (login, ME))

db.commit()
print("accounts seeded:", len(allacc),
      "| mutual:", len(followers & following),
      "| followers-only:", len(followers - following),
      "| following-only:", len(following - followers))
print("seed edges:", db.execute("SELECT count(*) FROM edges").fetchone()[0])
db.close()
