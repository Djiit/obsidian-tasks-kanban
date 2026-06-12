import type { EventRef } from "obsidian";
import type { TasksCacheUpdateData } from "../services/TasksIntegration";

declare module "obsidian" {
  interface App {
    plugins: {
      getPlugin(id: string): unknown;
    };
  }

  interface Workspace {
    on(
      name: "obsidian-tasks-plugin:cache-update",
      callback: (data: TasksCacheUpdateData) => void,
    ): EventRef;
  }
}
