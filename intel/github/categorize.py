"""Shared category tagger used across repo + account enrichment."""
import re

CATEGORY_RULES = {
    "AI/ML": ["ai","ml","llm","gpt","claude","openai","anthropic","langchain","rag","agent",
              "neural","transformer","embedding","huggingface","pytorch","tensorflow","diffusion",
              "machine-learning","deep-learning","nlp","model","inference","prompt","vector","mlx"],
    "Security": ["security","pentest","exploit","vuln","cve","ctf","malware","forensic","payload",
                 "encryption","oauth","firewall","siem","threat","redteam","red-team","blueteam",
                 "osint","nmap","metasploit","burp","fuzz","reverse-engineering","offensive",
                 "infosec","appsec","bugbounty","bug-bounty","c2","rootkit","ransomware","apt"],
    "Linux": ["linux","kernel","arch","debian","ubuntu","fedora","nixos","systemd","gnu",
              "distro","bootloader","initramfs","busybox","udev","gentoo"],
    "Platform": ["platform","sdk","framework","backend","microservice","grpc","graphql",
                 "orchestrat","scheduler","runtime","engine","gateway","middleware"],
    "Cloud": ["cloud","aws","gcp","azure","kubernetes","k8s","docker","container","terraform",
              "helm","serverless","lambda","cloudflare","devops","ci-cd","pulumi","ansible"],
    "Data/ML-Ops": ["etl","pipeline","dataset","warehouse","spark","airflow","kafka","mlops",
                    "database","postgres","mongo","analytics","bigquery","dbt","feature-store","duckdb"],
    "Web/Frontend": ["react","vue","svelte","angular","nextjs","frontend","webapp","tailwind",
                     "browser-extension","dashboard","webpack","vite"],
    "DevTools/CLI": ["cli","dotfile","automation","devtool","boilerplate","starter","scaffold",
                     "neovim","vim","tmux","zsh"],
}
LANG_HINTS = {
    "Shell": "DevTools/CLI", "Vim script": "DevTools/CLI", "Dockerfile": "Cloud",
    "HCL": "Cloud", "TypeScript": "Web/Frontend", "JavaScript": "Web/Frontend",
    "Jupyter Notebook": "AI/ML", "C": "Linux", "Rust": "Platform",
}
SECURITY_BIO = ["security","pentest","red team","red-team","offensive","infosec","hacker",
                "exploit","vulnerability","malware","reverse eng","ctf","bug bounty","threat",
                "appsec","osint","incident response","soc analyst","forensic","cybersec"]

def category_for(text_fields, language=None):
    hay = " ".join(str(x or "") for x in text_fields).lower()
    tags = []
    for cat, kws in CATEGORY_RULES.items():
        if any(re.search(r"(?<![a-z])" + re.escape(k), hay) for k in kws):
            tags.append(cat)
    if not tags and language in LANG_HINTS:
        tags.append(LANG_HINTS[language])
    if not tags:
        tags.append("Other/Uncategorized")
    return ";".join(tags)

def is_security_account(bio, interests):
    hay = (str(bio or "") + " " + str(interests or "")).lower()
    return 1 if any(k in hay for k in SECURITY_BIO) else 0
