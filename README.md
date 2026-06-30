# Hevy MCP Server

An MCP server that gives AI agents (Claude, ChatGPT, n8n, etc.) access to your [Hevy](https://hevy.com) workout data.

Runs as a Docker container and exposes an SSE endpoint, making it easy to connect remotely via a Cloudflare tunnel or any reverse proxy.

---

## Deploy with Docker

### 1. Clone the repo

```bash
git clone https://github.com/karlhsueh/hevyapp-mcp.git
cd hevyapp-mcp
```

### 2. Set your API key

Get your key from [hevy.com/settings?developer](https://hevy.com/settings?developer) (requires Hevy Pro).

```bash
cp .env.example .env
# Edit .env and set HEVY_API_KEY=your-key-here
```

### 3. Start the container

```bash
docker compose up -d
```

Verify it's running:

```bash
curl http://localhost:3847/health
# {"status":"ok","server":"hevyapp-mcp"}
```

---

## Expose remotely via Cloudflare Tunnel

If you're self-hosting on a home server and want remote access:

1. Go to **Cloudflare Zero Trust → Networks → Tunnels**
2. Click your tunnel → **Edit** → **Public Hostname** → **Add a public hostname**
3. Fill in:
   - **Subdomain:** `hevy-mcp` (or anything you like)
   - **Domain:** your domain
   - **Service:** `http://localhost:3847`
4. Save — no tunnel restart needed

Your MCP server will be live at `https://hevy-mcp.yourdomain.com/sse`.

---

## Connect to it

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hevy": {
      "type": "sse",
      "url": "https://hevy-mcp.yourdomain.com/sse"
    }
  }
}
```

Restart Claude Desktop.

### Claude Code (CLI)

```bash
claude mcp add hevy --transport sse https://hevy-mcp.yourdomain.com/sse
```

### ChatGPT / other agents

Point them at: `https://hevy-mcp.yourdomain.com/sse`

### Local agents (same machine)

Skip the public URL and connect directly:

```
http://localhost:3847/sse
```

---

## Available tools

| Tool | What it does |
|------|-------------|
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

## Updating

```bash
git pull
docker compose up -d --build
```

## Logs

```bash
docker compose logs -f hevyapp-mcp
```
