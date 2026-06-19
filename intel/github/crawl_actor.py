#!/usr/bin/env python3
"""Pull standardgalactic's full follower + following lists, profile + repos for each,
and write to a dedicated standardgalactic_* set of tables for connect-the-dots analysis."""
import os, sqlite3, subprocess, json, time
import urllib.request, urllib.error
from categorize import category_for, is_security_account

WS = os.path.expanduser("~/dev/gh-inventory")
db = sqlite3.connect(os.path.join(WS, "inventory.db"), timeout=60)
TOKEN = subprocess.check_output(["gh", "auth", "token"]).decode().strip()
TARGET = "standardgalactic"

# Create SG-specific tables
db.executescript("""
CREATE TABLE IF NOT EXISTS sg_accounts (
  login           TEXT PRIMARY KEY,
  relation        TEXT,   -- sg_follower | sg_following | sg_mutual
  name            TEXT,
  bio             TEXT,
  company         TEXT,
  location        TEXT,
  website         TEXT,
  twitter         TEXT,
  followers_n     INTEGER,
  following_n     INTEGER,
  public_repos    INTEGER,
  created_at      TEXT,
  interests       TEXT,
  security_signal INTEGER,
  notable         INTEGER, -- 1 if followers>500 or security signal
  notes           TEXT,
  url             TEXT,
  crawled         INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sg_edges (
  src TEXT, dst TEXT, PRIMARY KEY (src,dst)
);
CREATE INDEX IF NOT EXISTS idx_sg_sec ON sg_accounts(security_signal);
CREATE INDEX IF NOT EXISTS idx_sg_notable ON sg_accounts(notable);
""")
db.commit()

def gql(query, variables=None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request("https://api.github.com/graphql", data=body,
        headers={"Authorization": f"bearer {TOKEN}", "Content-Type": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (403, 502, 503): time.sleep(30); continue
            raise
        except Exception: time.sleep(10); continue
    return None

def check_rate():
    resp = gql("query { rateLimit { remaining resetAt } }")
    rl = (resp or {}).get("data", {}).get("rateLimit", {})
    if rl.get("remaining", 9999) < 100:
        from datetime import datetime, timezone
        reset = datetime.fromisoformat(rl["resetAt"].replace("Z", "+00:00"))
        wait = max(5, (reset - datetime.now(timezone.utc)).total_seconds() + 5)
        print(f"[rate] sleeping {int(wait)}s", flush=True)
        time.sleep(min(wait, 3600))

# Step 1: pull SG's follower list (22K) and following sample (cap 3000 of 1.1M - not pulling all)
SOCIAL_Q = """
query($login:String!, $fc:String, $ingc:String) {
  user(login:$login) {
    followers(first:100, after:$fc)  { pageInfo{hasNextPage endCursor} nodes{login} }
    following(first:100, after:$ingc) { pageInfo{hasNextPage endCursor} nodes{login} }
  }
}"""

def pull_social(login, cap_followers=25000, cap_following=3000):
    fc = ingc = None
    got_f = got_ing = 0
    while True:
        resp = gql(SOCIAL_Q, {"login": login, "fc": fc, "ingc": ingc})
        u = (resp or {}).get("data", {}).get("user") or {}
        fol = u.get("followers", {})
        ing = u.get("following", {})
        for node in fol.get("nodes", []):
            db.execute("INSERT OR IGNORE INTO sg_accounts (login,relation,url,crawled) VALUES (?,?,?,0)",
                      (node["login"], "sg_follower", f"https://github.com/{node['login']}"))
            db.execute("INSERT OR IGNORE INTO sg_edges VALUES (?,?)", (node["login"], login))
            got_f += 1
        for node in ing.get("nodes", []):
            db.execute("INSERT OR IGNORE INTO sg_accounts (login,relation,url,crawled) VALUES (?,?,?,0)",
                      (node["login"], "sg_following", f"https://github.com/{node['login']}"))
            db.execute("INSERT OR IGNORE INTO sg_accounts (login,relation,url,crawled) VALUES (?,?,?,0)",
                      (node["login"], "sg_following", f"https://github.com/{node['login']}"))
            db.execute("INSERT OR IGNORE INTO sg_edges VALUES (?,?)", (login, node["login"]))
            got_ing += 1
        fpi = fol.get("pageInfo", {})
        ipi = ing.get("pageInfo", {})
        fc   = fpi.get("endCursor") if fpi.get("hasNextPage") and got_f < cap_followers else None
        ingc = ipi.get("endCursor") if ipi.get("hasNextPage") and got_ing < cap_following else None
        db.commit()
        if not (fc or ingc): break
        if got_f % 1000 < 100:
            print(f"  sg social: followers={got_f} following={got_ing}", flush=True)
            check_rate()
    print(f"SG social done: {got_f} followers, {got_ing} following pulled", flush=True)

# Step 2: crawl each SG account's profile + repos
PROFILE_Q = """
query($login:String!) {
  rateLimit { remaining resetAt }
  user(login:$login) {
    login name bio company location websiteUrl twitterUsername isHireable createdAt updatedAt
    followers { totalCount }
    following { totalCount }
    repositories(first:50, ownerAffiliations:OWNER, isFork:false, orderBy:{field:STARGAZERS,direction:DESC}) {
      totalCount nodes { nameWithOwner isFork primaryLanguage{name} stargazerCount pushedAt description url }
    }
  }
}"""

def crawl_sg_accounts():
    todo = [r[0] for r in db.execute(
        "SELECT login FROM sg_accounts WHERE crawled=0").fetchall()]
    print(f"SG accounts to profile: {len(todo)}", flush=True)
    for i, login in enumerate(todo, 1):
        try:
            resp = gql(PROFILE_Q, {"login": login})
            rl = (resp or {}).get("data", {}).get("rateLimit")
            u = (resp or {}).get("data", {}).get("user")
            if not u:
                db.execute("UPDATE sg_accounts SET crawled=1, notes='no user node' WHERE login=?", (login,))
                continue
            repos = u["repositories"]["nodes"]
            langs = [r["primaryLanguage"]["name"] for r in repos if r.get("primaryLanguage")]
            descs = " ".join((r.get("description") or "") for r in repos[:20])
            interests = category_for([u.get("bio"), descs, " ".join(langs)], None)
            sec = is_security_account(u.get("bio"), interests + " " + descs)
            fn = u.get("followers", {}).get("totalCount", 0)
            ing = u.get("following", {}).get("totalCount", 0)
            notable = 1 if (fn > 500 or sec) else 0
            db.execute("""UPDATE sg_accounts SET name=?,bio=?,company=?,location=?,website=?,
                twitter=?,followers_n=?,following_n=?,public_repos=?,created_at=?,
                interests=?,security_signal=?,notable=?,crawled=1 WHERE login=?""", (
                u.get("name"), u.get("bio"), u.get("company"), u.get("location"),
                u.get("websiteUrl"), u.get("twitterUsername"),
                fn, ing, u["repositories"]["totalCount"],
                u.get("createdAt"), interests, sec, notable, login))
            # store their repos in account_repos too
            for r in repos:
                db.execute("""INSERT OR REPLACE INTO account_repos VALUES (?,?,?,?,?,?,?,?,?)""", (
                    login, r["nameWithOwner"], int(bool(r["isFork"])),
                    (r["primaryLanguage"] or {}).get("name") if r.get("primaryLanguage") else None,
                    r.get("stargazerCount"), r.get("pushedAt"), r.get("description"), None, r.get("url")))
            if rl and rl.get("remaining", 9999) < 100:
                check_rate()
        except Exception as e:
            print(f"  ! {login}: {e}", flush=True)
            db.execute("UPDATE sg_accounts SET crawled=1, notes=? WHERE login=?", (str(e), login))
        if i % 100 == 0:
            db.commit()
            sec_so_far = db.execute("SELECT count(*) FROM sg_accounts WHERE security_signal=1").fetchone()[0]
            notable_so_far = db.execute("SELECT count(*) FROM sg_accounts WHERE notable=1").fetchone()[0]
            print(f"  {i}/{len(todo)} profiled | sec={sec_so_far} notable={notable_so_far}", flush=True)
    db.commit()

if __name__ == "__main__":
    print("=== Phase 1: pull SG follower/following lists ===", flush=True)
    already = db.execute("SELECT count(*) FROM sg_accounts").fetchone()[0]
    if already < 100:
        pull_social(TARGET)
    else:
        print(f"  already have {already} SG accounts, skipping social pull", flush=True)

    print("=== Phase 2: profile all SG accounts ===", flush=True)
    crawl_sg_accounts()

    # Final summary
    total = db.execute("SELECT count(*) FROM sg_accounts").fetchone()[0]
    sec = db.execute("SELECT count(*) FROM sg_accounts WHERE security_signal=1").fetchone()[0]
    notable = db.execute("SELECT count(*) FROM sg_accounts WHERE notable=1").fetchone()[0]
    sg_edges = db.execute("SELECT count(*) FROM sg_edges").fetchone()[0]
    print(f"\nDONE. SG network: {total} accounts | security={sec} | notable={notable} | edges={sg_edges}", flush=True)
    open(os.path.join(WS, "raw", ".sg_complete"), "w").close()
