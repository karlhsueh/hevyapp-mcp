# Hevy MCP Server

An MCP server that gives AI assistants (Claude, etc.) access to your [Hevy](https://hevy.com) workout data via the [Model Context Protocol](https://modelcontextprotocol.io).

Supports both **Streamable HTTP** (for Claude web/mobile/desktop connector UI with OAuth) and **SSE** (for Claude Desktop config / CLI).

---

## Deploy

### Option 1 — Railway (recommended, free tier available)

1. Fork this repo and connect it to a new Railway project
2. In the Railway dashboard, go to your service → **Variables** and add:

   | Variable | Value |
   |---|---|
   | `HEVY_API_KEY` | Your Hevy API key (from [hevy.com/settings?developer](https://hevy.com/settings?developer)) |
   | `MCP_AUTH_TOKEN` | A secret token — run `openssl rand -hex 32` to generate one |
   | `MCP_TRANSPORT` | `sse` |
   | `SERVER_BASE_URL` | Your Railway public URL (set after generating a domain below) |

3. Go to **Settings → Networking → Generate Domain**, enter port `3847`, click **Generate Domain**
4. Copy the generated URL and update `SERVER_BASE_URL` to match — Railway will redeploy automatically
5. Check **Deploy Logs** for `Hevy MCP server running`

> **Token persistence on Railway:** OAuth tokens are stored in `DATA_DIR` (defaults to `/data`). On Railway's free tier the filesystem is ephemeral — tokens won't survive redeploys and users will need to re-authorize. To persist tokens, add a Railway volume mounted at `/data` and set `DATA_DIR=/data`.

### Option 2 — Docker (self-hosted)

```bash
git clone https://github.com/karlhsueh/hevyapp-mcp.git
cd hevyapp-mcp
cp .env.example .env
# Edit .env with your values
docker compose up -d
```

Verify:
```bash
curl http://localhost:3847/health
# {"status":"ok","server":"hevyapp-mcp"}
```

Expose remotely with [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) or any reverse proxy pointing at `localhost:3847`.

The included `docker-compose.yml` mounts a named volume at `/data` for OAuth token persistence across container restarts.

### Option 3 — Fly.io (free tier available)

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) and run `fly auth login`
2. From the repo root: `fly launch` (accept defaults)
3. Set secrets:
   ```bash
   fly secrets set \
     HEVY_API_KEY=your-key \
     MCP_AUTH_TOKEN=your-token \
     MCP_TRANSPORT=sse \
     SERVER_BASE_URL=https://your-app.fly.dev \
     DATA_DIR=/data
   ```
4. Add a volume for token persistence:
   ```bash
   fly volumes create mcp_data --size 1
   ```
5. Mount the volume by adding to `fly.toml`:
   ```toml
   [mounts]
     source = "mcp_data"
     destination = "/data"
   ```
6. Deploy: `fly deploy`

---

## Connect to Claude

### Claude web / mobile / desktop (connector UI) — OAuth

The server implements OAuth 2.0 so Claude can authenticate without any config files.

1. In Claude, open **Settings → Integrations** (web/mobile) or **Preferences → Integrations** (desktop)
2. Click **Add custom integration**
3. Enter your server URL (e.g. `https://your-app.up.railway.app`)
4. Claude opens a browser window — enter your `MCP_AUTH_TOKEN`
5. Done

### Claude Desktop (config file)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hevy": {
      "type": "sse",
      "url": "https://your-server/sse",
      "headers": {
        "Authorization": "Bearer your-secret-token"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add hevy --transport sse https://your-server/sse \
  --header "Authorization: Bearer your-secret-token"
```

---

## Available tools

| Tool | What it does |
|---|---|
| `get_workouts` | List workouts (paginated) |
| `get_workout_count` | Total workout count |
| `get_workout` | Single workout details |
| `get_workout_events` | Changes since a date (for sync) |
| `create_workout` | Log a new workout |
| `update_workout` | Edit an existing workout |
| `get_user_info` | Your profile |
| `get_routines` | List saved routines |
| `get_routine` | Single routine |
| `create_routine` / `update_routine` | Manage routines |
| `get_exercise_templates` | Full exercise library |
| `get_exercise_template` | Single exercise info |
| `get_exercise_history` | Progress over time for any exercise |
| `get_routine_folders` | Routine folder list |
| `create_routine_folder` / `update_routine_folder` | Manage folders |
| `get_body_measurements` | Weight/body fat history |
| `get_body_measurement_by_date` | Measurements for a date |
| `upsert_body_measurement` | Log body measurements |

---

## Optional: Sync workouts to Google Sheets

The repo includes two n8n workflow files for syncing Hevy workouts to a Google Sheet — useful for giving Claude Projects static access to your full workout history without the MCP connector.

- **`n8n-hevy-backfill.json`** — imports all historical workouts (clears the sheet first, then repopulates)
- **`n8n-hevy-to-sheets.json`** — appends new workouts triggered by a Hevy webhook

Import either file into your n8n instance and configure a Google Sheets credential and your Hevy API key in the HTTP Request nodes.

---

## Updating

```bash
git pull
docker compose up -d --build
```

## Logs

```bash
docker compose logs -f hevyapp-mcp
```
