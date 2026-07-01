import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { URL, URLSearchParams } from "node:url";
import { HevyClient } from "./hevy-client.js";

const apiKey = process.env.HEVY_API_KEY;
if (!apiKey) {
  console.error("HEVY_API_KEY environment variable is required");
  process.exit(1);
}

const client = new HevyClient(apiKey);

function createServer() {
  const server = new Server(
    { name: "hevyapp-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // Workouts
      {
        name: "get_workouts",
        description: "Get a paginated list of workouts from Hevy",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (default: 1)" },
            pageSize: { type: "number", description: "Items per page, max 10 (default: 10)" },
          },
        },
      },
      {
        name: "get_workout_count",
        description: "Get the total number of workouts logged in Hevy",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_workout_events",
        description: "Get workout events (updates/deletes) since a given date, useful for syncing local caches",
        inputSchema: {
          type: "object",
          required: ["since"],
          properties: {
            since: { type: "string", description: "ISO 8601 datetime, e.g. 2024-01-01T00:00:00Z" },
            page: { type: "number" },
            pageSize: { type: "number" },
          },
        },
      },
      {
        name: "get_workout",
        description: "Get full details of a single workout by ID",
        inputSchema: {
          type: "object",
          required: ["workoutId"],
          properties: {
            workoutId: { type: "string" },
          },
        },
      },
      {
        name: "create_workout",
        description: "Log a new workout in Hevy",
        inputSchema: {
          type: "object",
          required: ["workout"],
          properties: {
            workout: {
              type: "object",
              description: "Workout object",
              required: ["title", "start_time", "end_time", "exercises"],
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                start_time: { type: "string", description: "ISO 8601 start time" },
                end_time: { type: "string", description: "ISO 8601 end time" },
                is_private: { type: "boolean" },
                exercises: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["exercise_template_id", "sets"],
                    properties: {
                      exercise_template_id: { type: "string" },
                      superset_id: { type: "number" },
                      notes: { type: "string" },
                      sets: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["type"],
                          properties: {
                            type: { type: "string", enum: ["warmup", "normal", "failure", "dropset"] },
                            weight_kg: { type: "number" },
                            reps: { type: "number" },
                            distance_meters: { type: "number" },
                            duration_seconds: { type: "number" },
                            rpe: { type: "number" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        name: "update_workout",
        description: "Update an existing workout in Hevy",
        inputSchema: {
          type: "object",
          required: ["workoutId", "workout"],
          properties: {
            workoutId: { type: "string" },
            workout: { type: "object", description: "Updated workout fields (same schema as create_workout)" },
          },
        },
      },

      // User
      {
        name: "get_user_info",
        description: "Get the current Hevy user's profile info (username, join date, etc.)",
        inputSchema: { type: "object", properties: {} },
      },

      // Routines
      {
        name: "get_routines",
        description: "Get a paginated list of saved workout routines",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number" },
            pageSize: { type: "number" },
          },
        },
      },
      {
        name: "get_routine",
        description: "Get a single routine by ID with all exercises and sets",
        inputSchema: {
          type: "object",
          required: ["routineId"],
          properties: {
            routineId: { type: "string" },
          },
        },
      },
      {
        name: "create_routine",
        description: "Create a new workout routine",
        inputSchema: {
          type: "object",
          required: ["routine"],
          properties: {
            routine: {
              type: "object",
              required: ["title", "exercises"],
              properties: {
                title: { type: "string" },
                folder_id: { type: "number" },
                notes: { type: "string" },
                exercises: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["exercise_template_id", "sets"],
                    properties: {
                      exercise_template_id: { type: "string" },
                      superset_id: { type: "number" },
                      rest_seconds: { type: "number" },
                      notes: { type: "string" },
                      sets: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string", enum: ["warmup", "normal", "failure", "dropset"] },
                            weight_kg: { type: "number" },
                            reps: { type: "number" },
                            distance_meters: { type: "number" },
                            duration_seconds: { type: "number" },
                            rep_range: {
                              type: "object",
                              properties: {
                                start: { type: "number" },
                                end: { type: "number" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        name: "update_routine",
        description: "Update an existing routine",
        inputSchema: {
          type: "object",
          required: ["routineId", "routine"],
          properties: {
            routineId: { type: "string" },
            routine: { type: "object", description: "Updated routine fields" },
          },
        },
      },

      // Exercise Templates
      {
        name: "get_exercise_templates",
        description: "Get the exercise library — all available exercises with their IDs, muscle groups, and equipment",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number" },
            pageSize: { type: "number" },
          },
        },
      },
      {
        name: "get_exercise_template",
        description: "Get a specific exercise template by ID",
        inputSchema: {
          type: "object",
          required: ["exerciseTemplateId"],
          properties: {
            exerciseTemplateId: { type: "string" },
          },
        },
      },

      // Exercise History
      {
        name: "get_exercise_history",
        description: "Get the training history for a specific exercise (all sets across all workouts), great for tracking progress",
        inputSchema: {
          type: "object",
          required: ["exerciseTemplateId"],
          properties: {
            exerciseTemplateId: { type: "string", description: "Exercise template ID" },
            page: { type: "number" },
            pageSize: { type: "number" },
          },
        },
      },

      // Routine Folders
      {
        name: "get_routine_folders",
        description: "Get a list of routine folders",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number" },
            pageSize: { type: "number" },
          },
        },
      },
      {
        name: "get_routine_folder",
        description: "Get a specific routine folder by ID",
        inputSchema: {
          type: "object",
          required: ["folderId"],
          properties: {
            folderId: { type: "string" },
          },
        },
      },
      {
        name: "create_routine_folder",
        description: "Create a new routine folder to organize routines",
        inputSchema: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string" },
          },
        },
      },
      {
        name: "update_routine_folder",
        description: "Rename a routine folder",
        inputSchema: {
          type: "object",
          required: ["folderId", "title"],
          properties: {
            folderId: { type: "string" },
            title: { type: "string" },
          },
        },
      },

      // Body Measurements
      {
        name: "get_body_measurements",
        description: "Get a paginated list of body measurements (weight, body fat %, etc.) over time",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number" },
            pageSize: { type: "number" },
          },
        },
      },
      {
        name: "get_body_measurement_by_date",
        description: "Get body measurements for a specific date",
        inputSchema: {
          type: "object",
          required: ["date"],
          properties: {
            date: { type: "string", description: "Date in YYYY-MM-DD format" },
          },
        },
      },
      {
        name: "upsert_body_measurement",
        description: "Create or update body measurements for a specific date",
        inputSchema: {
          type: "object",
          required: ["date", "measurement"],
          properties: {
            date: { type: "string", description: "Date in YYYY-MM-DD format" },
            measurement: {
              type: "object",
              description: "Measurement values such as weight_kg, body_fat_percentage",
            },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case "get_workouts":
          result = await client.getWorkouts(args?.page as number, args?.pageSize as number);
          break;
        case "get_workout_count":
          result = await client.getWorkoutCount();
          break;
        case "get_workout_events":
          result = await client.getWorkoutEvents(
            args!.since as string,
            args?.page as number,
            args?.pageSize as number
          );
          break;
        case "get_workout":
          result = await client.getWorkout(args!.workoutId as string);
          break;
        case "create_workout":
          result = await client.createWorkout(args!.workout);
          break;
        case "update_workout":
          result = await client.updateWorkout(args!.workoutId as string, args!.workout);
          break;
        case "get_user_info":
          result = await client.getUserInfo();
          break;
        case "get_routines":
          result = await client.getRoutines(args?.page as number, args?.pageSize as number);
          break;
        case "get_routine":
          result = await client.getRoutine(args!.routineId as string);
          break;
        case "create_routine":
          result = await client.createRoutine(args!.routine);
          break;
        case "update_routine":
          result = await client.updateRoutine(args!.routineId as string, args!.routine);
          break;
        case "get_exercise_templates":
          result = await client.getExerciseTemplates(args?.page as number, args?.pageSize as number);
          break;
        case "get_exercise_template":
          result = await client.getExerciseTemplate(args!.exerciseTemplateId as string);
          break;
        case "get_exercise_history":
          result = await client.getExerciseHistory(
            args!.exerciseTemplateId as string,
            args?.page as number,
            args?.pageSize as number
          );
          break;
        case "get_routine_folders":
          result = await client.getRoutineFolders(args?.page as number, args?.pageSize as number);
          break;
        case "get_routine_folder":
          result = await client.getRoutineFolder(args!.folderId as string);
          break;
        case "create_routine_folder":
          result = await client.createRoutineFolder(args!.title as string);
          break;
        case "update_routine_folder":
          result = await client.updateRoutineFolder(args!.folderId as string, args!.title as string);
          break;
        case "get_body_measurements":
          result = await client.getBodyMeasurements(args?.page as number, args?.pageSize as number);
          break;
        case "get_body_measurement_by_date":
          result = await client.getBodyMeasurementByDate(args!.date as string);
          break;
        case "upsert_body_measurement":
          result = await client.upsertBodyMeasurement(args!.date as string, args!.measurement);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

const mcpTransport = process.env.MCP_TRANSPORT ?? "stdio";

if (mcpTransport === "sse") {
  const port = parseInt(process.env.PORT ?? "3847", 10);
  const authToken = process.env.MCP_AUTH_TOKEN;
  const serverBaseUrl = process.env.SERVER_BASE_URL ?? `http://localhost:${port}`;

  if (!authToken) {
    console.error("WARNING: MCP_AUTH_TOKEN is not set — server is unprotected");
  }

  // OAuth state (in-memory; resets on restart)
  const issuedTokens = new Set<string>();
  const authCodes = new Map<string, { redirectUri: string; clientId: string; expiresAt: number }>();

  function checkBearer(req: Request): boolean {
    if (!authToken) return true;
    const header = req.headers["authorization"] ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    return token === authToken || issuedTokens.has(token);
  }

  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!checkBearer(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  }

  const loginForm = (params: Record<string, string>, error = false) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hevy MCP — Authorize</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           background: #0f0f0f; color: #e0e0e0; display: flex;
           align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px;
            padding: 2rem; width: 100%; max-width: 380px; }
    h1 { font-size: 1.2rem; margin-bottom: 0.4rem; }
    p  { font-size: 0.85rem; color: #888; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.8rem; color: #aaa; margin-bottom: 0.3rem; }
    input[type=password] { width: 100%; padding: 0.6rem 0.8rem; background: #111;
           border: 1px solid #333; border-radius: 6px; color: #e0e0e0;
           font-size: 0.95rem; margin-bottom: 0.5rem; }
    button { width: 100%; padding: 0.7rem; background: #e34c26; border: none;
             border-radius: 6px; color: #fff; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
    button:hover { background: #c43c1c; }
    .error { color: #f87171; font-size: 0.85rem; margin: 0.5rem 0; ${error ? "" : "display:none"} }
  </style>
</head>
<body><div class="card">
  <h1>Hevy MCP Server</h1>
  <p>Enter your server token to grant access.</p>
  <form method="POST" action="/authorize">
    ${Object.entries(params).map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`).join("\n    ")}
    <label for="token">Server Token</label>
    <input type="password" id="token" name="token" placeholder="Enter MCP_AUTH_TOKEN" autofocus>
    <div class="error">Invalid token — try again.</div>
    <button type="submit">Authorize</button>
  </form>
</div></body></html>`;

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req, _res, next) => {
    console.error(`${req.method} ${req.path} auth=${req.headers["authorization"] ? "present" : "none"}`);
    next();
  });
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID");
    next();
  });
  app.options("*", (_req, res) => { res.sendStatus(204); });

  // --- OAuth discovery ---
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json({ resource: serverBaseUrl, authorization_servers: [serverBaseUrl] });
  });

  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json({
      issuer: serverBaseUrl,
      authorization_endpoint: `${serverBaseUrl}/authorize`,
      token_endpoint: `${serverBaseUrl}/token`,
      registration_endpoint: `${serverBaseUrl}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
    });
  });

  // --- OAuth flow ---
  app.post("/register", (req, res) => {
    const clientId = crypto.randomUUID();
    const clientSecret = crypto.randomBytes(32).toString("hex");
    res.status(201).json({
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: req.body?.redirect_uris ?? [],
      grant_types: ["authorization_code"],
      response_types: ["code"],
    });
  });

  app.get("/authorize", (req, res) => {
    const { client_id = "", redirect_uri = "", state = "", code_challenge = "", code_challenge_method = "" } = req.query as Record<string, string>;
    res.send(loginForm({ client_id, redirect_uri, state, code_challenge, code_challenge_method }));
  });

  app.post("/authorize", (req, res) => {
    const { token, redirect_uri, state, client_id, code_challenge, code_challenge_method } = req.body;
    if (!authToken || token !== authToken) {
      res.send(loginForm({ client_id, redirect_uri, state, code_challenge, code_challenge_method }, true));
      return;
    }
    const code = crypto.randomBytes(32).toString("hex");
    authCodes.set(code, { redirectUri: redirect_uri, clientId: client_id, expiresAt: Date.now() + 5 * 60 * 1000 });
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);
    res.redirect(redirectUrl.toString());
  });

  app.post("/token", (req, res) => {
    const { grant_type, code, redirect_uri } = req.body;
    if (grant_type !== "authorization_code") {
      res.status(400).json({ error: "unsupported_grant_type" });
      return;
    }
    const codeData = authCodes.get(code);
    if (!codeData || Date.now() > codeData.expiresAt || codeData.redirectUri !== redirect_uri) {
      res.status(400).json({ error: "invalid_grant" });
      return;
    }
    authCodes.delete(code);
    const accessToken = crypto.randomBytes(32).toString("hex");
    issuedTokens.add(accessToken);
    res.json({ access_token: accessToken, token_type: "Bearer", scope: "mcp" });
  });

  // --- MCP endpoints ---
  const sseTransports = new Map<string, SSEServerTransport>();
  const streamableTransports = new Map<string, StreamableHTTPServerTransport>();

  // Streamable HTTP (Claude web/mobile connector)
  app.all("/mcp", requireAuth, async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && streamableTransports.has(sessionId)) {
        await streamableTransports.get(sessionId)!.handleRequest(req, res, req.body);
        return;
      }

      if (req.method === "POST" && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (sid) => { streamableTransports.set(sid, transport); },
        });
        transport.onclose = () => {
          if (transport.sessionId) streamableTransports.delete(transport.sessionId);
        };
        const server = createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "Bad Request: No valid session or initialize request" }, id: null });
    } catch (err) {
      console.error("MCP /mcp error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    }
  });

  // Legacy SSE (Claude Desktop config / CLI)
  app.get("/sse", requireAuth, async (req: Request, res: Response) => {
    const transport = new SSEServerTransport("/message", res);
    sseTransports.set(transport.sessionId, transport);
    res.on("close", () => sseTransports.delete(transport.sessionId));
    const server = createServer();
    await server.connect(transport);
  });

  app.post("/message", requireAuth, async (req: Request, res: Response) => {
    const sessionId = req.query["sessionId"] as string;
    const transport = sseTransports.get(sessionId);
    if (!transport) { res.status(404).json({ error: "Session not found" }); return; }
    await transport.handlePostMessage(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "hevyapp-mcp" });
  });

  app.listen(port, () => {
    console.error(`Hevy MCP server running on http://0.0.0.0:${port}`);
  });
} else {
  // Default: stdio transport (local Claude Desktop / CLI use)
  const server = createServer();
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
}
