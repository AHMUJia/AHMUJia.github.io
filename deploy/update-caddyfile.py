#!/usr/bin/env python3
"""
Insert /team/<slug> rewrite rules into /opt/caddy/Caddyfile.

Idempotent: if @team_zh already present, exits with no changes.
Backs up the original file before writing.

Usage:
    sudo python3 /opt/mengjialin-site/deploy/update-caddyfile.py
    docker exec caddy caddy reload --config /etc/caddy/Caddyfile
"""
import os
import re
import shutil
import sys
import time

CADDYFILE = '/opt/caddy/Caddyfile'

if not os.path.exists(CADDYFILE):
    print(f'ERROR: {CADDYFILE} not found')
    sys.exit(1)

with open(CADDYFILE, 'r', encoding='utf-8') as f:
    content = f.read()

if '@team_zh' in content:
    print('Already updated (found @team_zh). No changes.')
    sys.exit(0)

INSERT_BLOCK = """    # 漂亮 URL: /team/<slug> -> /team-person.html?slug=<slug>
    @team_zh path_regexp slugzh ^/team/([A-Za-z0-9_-]+)/?$
    handle @team_zh {
        rewrite * /team-person.html?slug={re.slugzh.1}
        root * /srv/mengjialin
        file_server
    }
    @team_en path_regexp slugen ^/team_en/([A-Za-z0-9_-]+)/?$
    handle @team_en {
        rewrite * /team-person_en.html?slug={re.slugen.1}
        root * /srv/mengjialin
        file_server
    }

"""

# Find insertion point: before the catch-all `handle { ... root * /srv/mengjialin ... }`
# We look for the comment line OR fall back to the `handle {` opener of the catch-all.
match = re.search(r'^    # ', content, flags=re.MULTILINE)
catch_all = re.search(r'^    handle \{\s*\n\s*root \* /srv/mengjialin', content, flags=re.MULTILINE)
if catch_all:
    insert_at = catch_all.start()
elif match:
    insert_at = match.start()
else:
    print('ERROR: could not find a safe insertion point. Edit manually with nano /opt/caddy/Caddyfile.')
    sys.exit(1)

new_content = content[:insert_at] + INSERT_BLOCK + content[insert_at:]

# Backup before write
backup = f'{CADDYFILE}.bak.{int(time.time())}'
shutil.copy(CADDYFILE, backup)
print(f'Backup -> {backup}')

with open(CADDYFILE, 'w', encoding='utf-8') as f:
    f.write(new_content)
print(f'Updated {CADDYFILE}')
print('Now run:  docker exec caddy caddy reload --config /etc/caddy/Caddyfile')
