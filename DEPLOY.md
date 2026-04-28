# UroExplorer 部署指南

服务器：47.83.223.164（已经在跑 papertracker / Caddy / Docker）

整体目标：把这个仓库克隆到 `/opt/mengjialin-site/`，跑一个 Node 后端容器（`uroexplorer-admin`），现有的 Caddy 同时承担静态托管 + `/api/*` 反代到后端。

---

## 步骤 1：克隆仓库

```bash
sudo mkdir -p /opt/mengjialin-site /opt/mengjialin-admin-data
sudo chown -R 1000:1000 /opt/mengjialin-site /opt/mengjialin-admin-data
git clone https://github.com/AHMUJia/AHMUJia.github.io.git /opt/mengjialin-site
```

> Node 镜像里 `node` 用户的 UID 是 1000，所以宿主机目录 owner 也设为 1000:1000。

## 步骤 2：在 /opt/mengjialin-site/ 准备 .env

```bash
cd /opt/mengjialin-site
cat > .env <<EOF
UROEXPLORER_SESSION_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 .env
```

## 步骤 3：首次数据迁移（一次性）

把目前 `*-data.js` 里的内容抽到 JSON：

```bash
cd /opt/mengjialin-site
docker compose -f docker-compose.blog.yml run --rm uroexplorer-admin node migrate.js
```

之后 `/opt/mengjialin-admin-data/` 里会出现 `about.zh.json / about.en.json / ... / team.json`。这是真正的 source of truth，原仓库里的 `*-data.js` 文件以后由后端自动重写。

## 步骤 4：开 admin 账号（你自己）

```bash
cd /opt/mengjialin-site
docker compose -f docker-compose.blog.yml run --rm \
  -e SEED_USERNAME=mengjialin \
  -e SEED_PASSWORD='Change-This-Now!' \
  -e SEED_ROLE=admin \
  uroexplorer-admin node seed-admin.js
```

> 改成自己定的强密码。SSH 历史里别留明文（用 `read -s` 然后 `export` 也行）。

## 步骤 5：把 Caddy 接进来

**情况 A — 你的 papertracker Caddy 还在跑（推荐）**

1. 把 `/opt/mengjialin-site` 挂到现有 Caddy 的 `/srv/mengjialin`（read-only）
2. 把现有 Caddy 加入 `caddy` 这个 docker network（如果还没在）
3. 把 `Caddyfile.snippet` 的内容追加到现有 Caddyfile
4. `docker compose -f docker-compose.prod.yml up -d --force-recreate caddy`（重启 Caddy 加载新配置）

**情况 B — 这台机器没 Caddy**

```bash
docker network create caddy
cp /opt/mengjialin-site/Caddyfile.snippet /opt/mengjialin-site/Caddyfile
cd /opt/mengjialin-site
docker compose -f docker-compose.blog.yml --profile standalone up -d
```

## 步骤 6：起后端

```bash
cd /opt/mengjialin-site
docker compose -f docker-compose.blog.yml up -d uroexplorer-admin
docker compose -f docker-compose.blog.yml logs -f uroexplorer-admin
```

日志里看到 `UroExplorer admin listening on :3000` 就 OK。

## 步骤 7：验证（curl 测 API）

```bash
# 登录（保存 cookie）
curl -c /tmp/c.txt -b /tmp/c.txt -X POST https://mengjialin.top/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"mengjialin","password":"Change-This-Now-Long-Enough!"}'
# → {"username":"mengjialin","role":"admin","memberSlug":null}

# 看自己
curl -b /tmp/c.txt https://mengjialin.top/api/me
# → {"username":"mengjialin","role":"admin","memberSlug":null}

# 列出可编辑区块
curl -b /tmp/c.txt https://mengjialin.top/api/data
# → ["about","education",...,"team"]

# 读 about
curl -b /tmp/c.txt https://mengjialin.top/api/data/about
# → {"zh":[...],"en":[...]}

# 改 about（写入会立刻重写 about-data.js + about-data_en.js）
curl -b /tmp/c.txt -X PUT https://mengjialin.top/api/data/about \
  -H 'Content-Type: application/json' \
  -d '{"zh":["新简介第一段","第二段"],"en":["New bio paragraph 1","Paragraph 2"]}'

# 退出
curl -b /tmp/c.txt -X POST https://mengjialin.top/api/logout
```

## 步骤 8：开学生账号

例如 `phd-zhangsan` 学生：

```bash
docker compose -f docker-compose.blog.yml run --rm \
  -e SEED_USERNAME=zhangsan \
  -e SEED_PASSWORD='temp-Pass-2024' \
  -e SEED_ROLE=member \
  -e SEED_SLUG=phd-zhangsan \
  uroexplorer-admin node seed-admin.js
```

学生用 `zhangsan / temp-Pass-2024` 登录后，`/api/me/member` 只返回他自己的 team 记录，PUT 也只能改这一条。

后续 admin 可以通过 admin 页 UI（Phase 4b 提供）来增删用户，不用 SSH。

---

## 升级流程（以后改前端代码）

```bash
cd /opt/mengjialin-site
git pull        # 这会重写 *-data.js 为仓库里的（旧）版本
docker compose -f docker-compose.blog.yml restart uroexplorer-admin
                # 后端启动时会从 /data/*.json 重新生成 *-data.js，覆盖 git pull 拿来的旧版
```

→ 简言之：**`*-data.js` 不要在本地手改并 push**，会在 server 端被 JSON 覆盖。框架 (HTML/CSS/JS) 改了 push，data 通过 admin 页面改。

## 备份

`/opt/mengjialin-admin-data/` 是真实数据，建议加 cron rsync 到另一处：

```bash
0 3 * * * rsync -a --delete /opt/mengjialin-admin-data/ /backup/uroexplorer/
```

---

## 故障排查

| 症状 | 检查 |
|---|---|
| 登录返回 502 | `docker compose logs uroexplorer-admin`；网络 `caddy` 是否包含两个容器 |
| 登录返回 401 | 用户名/密码核对，或 `cat /opt/mengjialin-admin-data/users.json` 确认 |
| PUT 200 但页面没变 | 浏览器缓存（Ctrl+F5）；或 `ls -la /opt/mengjialin-site/about-data.js` 看时间戳 |
| 容器起不来 | `SESSION_SECRET` 是否长度 ≥16；卷权限 `chown -R 1000:1000` |
| 学生 PUT 自己的页 403 | `users.json` 里 `memberSlug` 是否和 team 里的 slug 完全一致 |
