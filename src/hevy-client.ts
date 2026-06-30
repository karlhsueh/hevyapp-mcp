const BASE_URL = "https://api.hevyapp.com";

export class HevyClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Hevy API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  // Workouts
  async getWorkouts(page = 1, pageSize = 10) {
    return this.request(`/v1/workouts?page=${page}&pageSize=${pageSize}`);
  }

  async getWorkoutCount() {
    return this.request("/v1/workouts/count");
  }

  async getWorkoutEvents(since: string, page = 1, pageSize = 10) {
    return this.request(`/v1/workouts/events?since=${encodeURIComponent(since)}&page=${page}&pageSize=${pageSize}`);
  }

  async getWorkout(workoutId: string) {
    return this.request(`/v1/workouts/${workoutId}`);
  }

  async createWorkout(workout: unknown) {
    return this.request("/v1/workouts", {
      method: "POST",
      body: JSON.stringify({ workout }),
    });
  }

  async updateWorkout(workoutId: string, workout: unknown) {
    return this.request(`/v1/workouts/${workoutId}`, {
      method: "PUT",
      body: JSON.stringify({ workout }),
    });
  }

  // User
  async getUserInfo() {
    return this.request("/v1/user/info");
  }

  // Routines
  async getRoutines(page = 1, pageSize = 10) {
    return this.request(`/v1/routines?page=${page}&pageSize=${pageSize}`);
  }

  async getRoutine(routineId: string) {
    return this.request(`/v1/routines/${routineId}`);
  }

  async createRoutine(routine: unknown) {
    return this.request("/v1/routines", {
      method: "POST",
      body: JSON.stringify({ routine }),
    });
  }

  async updateRoutine(routineId: string, routine: unknown) {
    return this.request(`/v1/routines/${routineId}`, {
      method: "PUT",
      body: JSON.stringify({ routine }),
    });
  }

  // Exercise Templates
  async getExerciseTemplates(page = 1, pageSize = 10) {
    return this.request(`/v1/exercise_templates?page=${page}&pageSize=${pageSize}`);
  }

  async getExerciseTemplate(exerciseTemplateId: string) {
    return this.request(`/v1/exercise_templates/${exerciseTemplateId}`);
  }

  // Exercise History
  async getExerciseHistory(exerciseTemplateId: string, page = 1, pageSize = 10) {
    return this.request(`/v1/exercise_history/${exerciseTemplateId}?page=${page}&pageSize=${pageSize}`);
  }

  // Routine Folders
  async getRoutineFolders(page = 1, pageSize = 10) {
    return this.request(`/v1/routine_folders?page=${page}&pageSize=${pageSize}`);
  }

  async getRoutineFolder(folderId: string) {
    return this.request(`/v1/routine_folders/${folderId}`);
  }

  async createRoutineFolder(title: string) {
    return this.request("/v1/routine_folders", {
      method: "POST",
      body: JSON.stringify({ routine_folder: { title } }),
    });
  }

  async updateRoutineFolder(folderId: string, title: string) {
    return this.request(`/v1/routine_folders/${folderId}`, {
      method: "PUT",
      body: JSON.stringify({ routine_folder: { title } }),
    });
  }

  // Body Measurements
  async getBodyMeasurements(page = 1, pageSize = 10) {
    return this.request(`/v1/body_measurements?page=${page}&pageSize=${pageSize}`);
  }

  async getBodyMeasurementByDate(date: string) {
    return this.request(`/v1/body_measurements/${date}`);
  }

  async upsertBodyMeasurement(date: string, measurement: unknown) {
    return this.request(`/v1/body_measurements/${date}`, {
      method: "POST",
      body: JSON.stringify({ measurement }),
    });
  }
}
