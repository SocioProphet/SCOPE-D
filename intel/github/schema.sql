-- GitHub inventory + counter-intel schema
PRAGMA journal_mode=WAL;

-- All repos across our namespaces (mdheller + 3 orgs)
CREATE TABLE IF NOT EXISTS repos (
  full_name   TEXT PRIMARY KEY,
  bucket      TEXT,      -- mdheller | socioprophet | socios-linux | sourceos-linux
  owner       TEXT,
  name        TEXT,
  role        TEXT,      -- created (personal) | org-original | fork
  category    TEXT,      -- multi-tag, ;-separated
  private     INTEGER,
  is_fork     INTEGER,
  archived    INTEGER,
  language    TEXT,
  stars       INTEGER,
  forks       INTEGER,
  pushed_at   TEXT,
  created_at  TEXT,
  description TEXT,
  topics      TEXT,
  url         TEXT
);

-- Learning catalog: our non-original forks tied back to upstream source
CREATE TABLE IF NOT EXISTS forks_catalog (
  full_name        TEXT PRIMARY KEY,   -- our fork
  bucket           TEXT,
  upstream         TEXT,               -- parent nameWithOwner (direct parent)
  source           TEXT,               -- root source nameWithOwner (ultimate origin)
  upstream_url     TEXT,
  upstream_stars   INTEGER,
  upstream_pushed  TEXT,
  upstream_desc    TEXT,
  upstream_archived INTEGER,
  upstream_lang    TEXT,
  our_pushed_at    TEXT,
  staleness_years  REAL,               -- years since OUR fork last pushed
  upstream_age_years REAL,             -- years since upstream last pushed
  category         TEXT,               -- learning theme (reuses repo categorizer)
  language         TEXT,
  topics           TEXT,
  our_url          TEXT,
  learn_notes      TEXT                -- (blank, for you to fill: feature/lesson/design)
);

-- Accounts: 1-hop (followers + following) and 2-hop nodes we discover
CREATE TABLE IF NOT EXISTS accounts (
  login         TEXT PRIMARY KEY,
  relation      TEXT,     -- follower | following | mutual | 2-hop
  type          TEXT,     -- User | Organization
  name          TEXT,
  bio           TEXT,
  company       TEXT,
  location      TEXT,
  email         TEXT,
  website       TEXT,
  twitter       TEXT,
  hireable      INTEGER,
  followers_n   INTEGER,
  following_n   INTEGER,
  public_repos  INTEGER,
  created_at    TEXT,
  updated_at    TEXT,
  interests     TEXT,     -- derived interest tags (langs/topics/bio)
  security_signal INTEGER,-- 1 if bio/repos suggest security professional
  threat_notes  TEXT,     -- (blank, for triage)
  crawled       INTEGER DEFAULT 0,  -- have we pulled this account's detail yet
  url           TEXT
);

-- Repos owned by 1-hop accounts (their interests/work)
CREATE TABLE IF NOT EXISTS account_repos (
  owner       TEXT,
  full_name   TEXT,
  is_fork     INTEGER,
  language    TEXT,
  stars       INTEGER,
  pushed_at   TEXT,
  description TEXT,
  topics      TEXT,
  url         TEXT,
  PRIMARY KEY (full_name)
);

-- Directed follow edges: src follows dst. Builds the 1- and 2-hop graph.
CREATE TABLE IF NOT EXISTS edges (
  src   TEXT,
  dst   TEXT,
  PRIMARY KEY (src, dst)
);
CREATE INDEX IF NOT EXISTS idx_edges_dst ON edges(dst);
CREATE INDEX IF NOT EXISTS idx_edges_src ON edges(src);
CREATE INDEX IF NOT EXISTS idx_acct_relation ON accounts(relation);
CREATE INDEX IF NOT EXISTS idx_acct_crawled ON accounts(crawled);
