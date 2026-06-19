#!/usr/bin/env python3
"""Counter-intel crawl: for each 1-hop account, pull profile + repos + followers + following.
Writes accounts / account_repos / edges. Checkpointed (crawled flag) + rate-limit aware.
Caps: repos<=200, followers<=200, following<=300 (truncation noted in threat_notes)."""
import os, sqlite3, subprocess, json, time, sys
import urllib.request, urllib.error
from categorize import category_for, is_security_account

WS = os.path.expanduser("~/dev/gh-inventory")
db = sqlite3.connect(os.path.join(WS, "inventory.db"), timeout=60)
TOKEN = subprocess.check_output(["gh", "auth", "token"]).decode().strip()

CAP_REPOS, CAP_FOLLOWERS, CAP_FOLLOWING = 200, 200, 300

USER_Q = """
query($login:String!, $rc:String, $erc:String, $ingc:String) {
  rateLimit { remaining resetAt }
  user(login:$login) {
    login name bio company location websiteUrl twitterUsername isHireable createdAt updatedAt
    repositories(first:100, ownerAffiliations:OWNER, isFork:false, orderBy:{field:STARGAZERS,direction:DESC}, after:$rc) {
      totalCount pageInfo{hasNextPage endCursor}
      nodes { nameWithOwner isFork primaryLanguage{name} stargazerCount pushedAt description url }
    }
    followers(first:100, after:$erc) { totalCount pageInfo{hasNextPage endCursor} nodes{login} }
    following(first:100, after:$ingc) { totalCount pageInfo{hasNextPage endCursor} nodes{login} }
  }
}"""

def gql(variables):
    body = json.dumps({"query": USER_Q, "variables": variables}).encode()
    req = urllib.request.Request("https://api.github.com/graphql", data=body,
        headers={"Authorization": f"bearer {TOKEN}", "Content-Type": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (403, 502, 503):
                time.sleep(30); continue
            raise
        except Exception:
            time.sleep(10); continue
    return None

def maybe_wait(rl):
    if rl and rl.get("remaining", 9999) < 80:
        from datetime import datetime, timezone
        reset = datetime.fromisoformat(rl["resetAt"].replace("Z","+00:00"))
        wait = max(5, (reset - datetime.now(timezone.utc)).total_seconds() + 5)
        print(f"[rate] {rl['remaining']} left, sleeping {int(wait)}s until {rl['resetAt']}", flush=True)
        time.sleep(min(wait, 3600))

def upsert_account_node(u, relation):
    repos = u["repositories"]["nodes"]
    langs = [r["primaryLanguage"]["name"] for r in repos if r.get("primaryLanguage")]
    descs = " ".join((r.get("description") or "") for r in repos[:30])
    interests = category_for([u.get("bio"), descs, " ".join(langs)], None)
    sec = is_security_account(u.get("bio"), interests + " " + descs)
    notes = []
    if u["followers"]["totalCount"] > CAP_FOLLOWERS: notes.append(f"followers truncated@{CAP_FOLLOWERS}/{u['followers']['totalCount']}")
    if u["following"]["totalCount"] > CAP_FOLLOWING: notes.append(f"following truncated@{CAP_FOLLOWING}/{u['following']['totalCount']}")
    db.execute("""UPDATE accounts SET type='User', name=?, bio=?, company=?, location=?, email=?,
        website=?, twitter=?, hireable=?, followers_n=?, following_n=?, public_repos=?,
        created_at=?, updated_at=?, interests=?, security_signal=?, threat_notes=?, crawled=1
        WHERE login=?""", (
        u.get("name"), u.get("bio"), u.get("company"), u.get("location"), None,
        u.get("websiteUrl"), u.get("twitterUsername"), int(bool(u.get("isHireable"))),
        u["followers"]["totalCount"], u["following"]["totalCount"], u["repositories"]["totalCount"],
        u.get("createdAt"), u.get("updatedAt"), interests, sec, "; ".join(notes), u["login"]))
    for r in repos:
        db.execute("""INSERT OR REPLACE INTO account_repos VALUES (?,?,?,?,?,?,?,?,?)""", (
            u["login"], r["nameWithOwner"], int(bool(r["isFork"])),
            (r["primaryLanguage"] or {}).get("name") if r.get("primaryLanguage") else None,
            r.get("stargazerCount"), r.get("pushedAt"), r.get("description"), None, r.get("url")))

def record_edges(login, u):
    for f in u["followers"]["nodes"]:
        db.execute("INSERT OR IGNORE INTO edges VALUES (?,?)", (f["login"], login))
        db.execute("INSERT OR IGNORE INTO accounts (login, relation, url, crawled) VALUES (?, '2-hop', ?, 0)",
                   (f["login"], f"https://github.com/{f['login']}"))
    for f in u["following"]["nodes"]:
        db.execute("INSERT OR IGNORE INTO edges VALUES (?,?)", (login, f["login"]))
        db.execute("INSERT OR IGNORE INTO accounts (login, relation, url, crawled) VALUES (?, '2-hop', ?, 0)",
                   (f["login"], f"https://github.com/{f['login']}"))

def crawl_one(login):
    rc = erc = ingc = None
    got_repos = got_ers = got_ing = 0
    base = None
    while True:
        resp = gql({"login": login, "rc": rc, "erc": erc, "ingc": ingc})
        if not resp: return False
        rl = (resp.get("data") or {}).get("rateLimit")
        u = (resp.get("data") or {}).get("user")
        if u is None:  # deleted/renamed/org -> mark crawled to skip
            db.execute("UPDATE accounts SET crawled=1, threat_notes='no user node (org/deleted)' WHERE login=?", (login,))
            return True
        if base is None:
            base = u; upsert_account_node(u, None)
        record_edges(login, u)
        got_repos += len(u["repositories"]["nodes"])
        got_ers += len(u["followers"]["nodes"])
        got_ing += len(u["following"]["nodes"])
        rpi, epi, ipi = u["repositories"]["pageInfo"], u["followers"]["pageInfo"], u["following"]["pageInfo"]
        rc  = rpi["endCursor"]  if rpi["hasNextPage"] and got_repos < CAP_REPOS else None
        erc = epi["endCursor"]  if epi["hasNextPage"] and got_ers  < CAP_FOLLOWERS else None
        ingc= ipi["endCursor"]  if ipi["hasNextPage"] and got_ing  < CAP_FOLLOWING else None
        maybe_wait(rl)
        if not (rc or erc or ingc):
            break
    return True

def main():
    todo = [r[0] for r in db.execute(
        "SELECT login FROM accounts WHERE crawled=0 AND relation IN ('follower','following','mutual')").fetchall()]
    print(f"accounts to crawl (1-hop): {len(todo)}", flush=True)
    for i, login in enumerate(todo, 1):
        try:
            crawl_one(login)
        except Exception as e:
            print(f"  ! {login}: {e}", flush=True)
            db.execute("UPDATE accounts SET threat_notes=COALESCE(threat_notes,'')||' err' WHERE login=?", (login,))
        if i % 25 == 0:
            db.commit()
            print(f"  {i}/{len(todo)} crawled", flush=True)
    db.commit()
    done = db.execute("SELECT count(*) FROM accounts WHERE crawled=1 AND relation IN ('follower','following','mutual')").fetchone()[0]
    twohop = db.execute("SELECT count(*) FROM accounts WHERE relation='2-hop'").fetchone()[0]
    edges = db.execute("SELECT count(*) FROM edges").fetchone()[0]
    print(f"DONE. 1-hop crawled={done}, 2-hop discovered={twohop}, edges={edges}", flush=True)
    open(os.path.join(WS, "raw", ".social_complete"), "w").close()

if __name__ == "__main__":
    main()
