import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";
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

const transport = process.env.MCP_TRANSPORT ?? "stdio";

if (transport === "sse") {
  // HTTP + SSE transport — for remote access via Cloudflare tunnel
  const port = parseInt(process.env.PORT ?? "3000", 10);
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/sse") {
      const sseTransport = new SSEServerTransport("/message", res);
      transports.set(sseTransport.sessionId, sseTransport);

      res.on("close", () => {
        transports.delete(sseTransport.sessionId);
      });

      const server = createServer();
      await server.connect(sseTransport);
      return;
    }

    if (req.method === "POST" && req.url?.startsWith("/message")) {
      const url = new URL(req.url, `http://localhost:${port}`);
      const sessionId = url.searchParams.get("sessionId");
      const sseTransport = sessionId ? transports.get(sessionId) : undefined;

      if (!sseTransport) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }

      await sseTransport.handlePostMessage(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "hevyapp-mcp" }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(port, () => {
    console.error(`Hevy MCP server running on http://0.0.0.0:${port}/sse`);
  });
} else {
  // Default: stdio transport (local Claude Desktop / CLI use)
  const server = createServer();
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
}
