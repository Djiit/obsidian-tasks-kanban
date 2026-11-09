import { describe, it, expect, vi } from "vitest";
import { TasksIntegration } from "../src/services/TasksIntegration";

const CORE_STATUSES = [
  { symbol: " ", name: "Todo", type: "TODO" },
  {
    symbol: "/",
    name: "In Progress",
    type: "IN_PROGRESS",
    nextStatusSymbol: "x",
  },
  { symbol: "x", name: "Done", type: "DONE" },
];

const CUSTOM_STATUSES = [
  { symbol: "-", name: "Cancelled", type: "CANCELLED" },
  { symbol: "1", name: "Priority 1", type: "NON_TASK" },
  { symbol: "L", name: "Priority Low", type: "NON_TASK" },
];

interface AppOptions {
  /** The object returned by app.plugins.getPlugin("obsidian-tasks-plugin"). */
  tasksPlugin?: unknown;
  /** Raw content of the Tasks plugin's data.json; null makes the read fail. */
  dataJson?: string | null;
}

function makeApp(options: AppOptions = {}) {
  const tasksPlugin =
    options.tasksPlugin === undefined ? { settings: {} } : options.tasksPlugin;
  return {
    plugins: {
      getPlugin: vi.fn((id: string) =>
        id === "obsidian-tasks-plugin" ? tasksPlugin : null,
      ),
    },
    workspace: {
      on: vi.fn(() => ({})),
      offref: vi.fn(),
      trigger: vi.fn(),
    },
    vault: {
      configDir: ".obsidian",
      adapter: {
        read: vi.fn(async () => {
          if (options.dataJson == null) {
            throw new Error("ENOENT");
          }
          return options.dataJson;
        }),
      },
    },
  } as never;
}

function statusSettingsJson(core: unknown, custom: unknown): string {
  return JSON.stringify({
    statusSettings: { coreStatuses: core, customStatuses: custom },
  });
}

describe("TasksIntegration statuses", () => {
  it("returns the default statuses before loadStatuses() has run", () => {
    const integration = new TasksIntegration(makeApp());

    expect(integration.getStatuses().map((s) => s.symbol)).toEqual([
      " ",
      "/",
      "x",
    ]);
  });

  it("loads core and custom statuses from the Tasks plugin's in-memory settings", async () => {
    const integration = new TasksIntegration(
      makeApp({
        tasksPlugin: {
          settings: {
            statusSettings: {
              coreStatuses: CORE_STATUSES,
              customStatuses: CUSTOM_STATUSES,
            },
          },
        },
      }),
    );

    await integration.loadStatuses();

    expect(integration.getStatuses()).toEqual([
      ...CORE_STATUSES,
      ...CUSTOM_STATUSES,
    ]);
  });

  it("falls back to the persisted data.json when in-memory settings are missing", async () => {
    const integration = new TasksIntegration(
      makeApp({
        tasksPlugin: {},
        dataJson: statusSettingsJson(CORE_STATUSES, CUSTOM_STATUSES),
      }),
    );

    await integration.loadStatuses();

    expect(integration.getStatuses().map((s) => s.name)).toEqual([
      "Todo",
      "In Progress",
      "Done",
      "Cancelled",
      "Priority 1",
      "Priority Low",
    ]);
  });

  it("keeps the default statuses when no configuration can be read", async () => {
    const integration = new TasksIntegration(
      makeApp({ tasksPlugin: null, dataJson: null }),
    );

    await integration.loadStatuses();

    expect(integration.getStatuses().map((s) => s.symbol)).toEqual([
      " ",
      "/",
      "x",
    ]);
  });

  it("notifies subscribers when loadStatuses() changes the status list", async () => {
    const integration = new TasksIntegration(
      makeApp({
        tasksPlugin: {
          settings: {
            statusSettings: {
              coreStatuses: CORE_STATUSES,
              customStatuses: CUSTOM_STATUSES,
            },
          },
        },
      }),
    );
    const listener = vi.fn();
    integration.onStatusesChanged(listener);

    await integration.loadStatuses();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify again when a reload yields the same statuses", async () => {
    const tasksPlugin = {
      settings: {
        statusSettings: {
          coreStatuses: CORE_STATUSES,
          customStatuses: CUSTOM_STATUSES,
        },
      },
    };
    const integration = new TasksIntegration(makeApp({ tasksPlugin }));
    const listener = vi.fn();
    integration.onStatusesChanged(listener);

    await integration.loadStatuses();
    await integration.loadStatuses();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies again when a reload yields different statuses", async () => {
    const tasksPlugin = {
      settings: {
        statusSettings: { coreStatuses: CORE_STATUSES, customStatuses: [] },
      },
    };
    const integration = new TasksIntegration(makeApp({ tasksPlugin }));
    const listener = vi.fn();
    integration.onStatusesChanged(listener);

    await integration.loadStatuses();
    tasksPlugin.settings.statusSettings.customStatuses = CUSTOM_STATUSES;
    await integration.loadStatuses();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("stops notifying after the unsubscribe function runs", async () => {
    const integration = new TasksIntegration(
      makeApp({
        tasksPlugin: {
          settings: {
            statusSettings: {
              coreStatuses: CORE_STATUSES,
              customStatuses: CUSTOM_STATUSES,
            },
          },
        },
      }),
    );
    const listener = vi.fn();
    const unsubscribe = integration.onStatusesChanged(listener);
    unsubscribe();

    await integration.loadStatuses();

    expect(listener).not.toHaveBeenCalled();
  });

  it("clears subscribers on unload", async () => {
    const app = makeApp({
      tasksPlugin: {
        settings: {
          statusSettings: {
            coreStatuses: CORE_STATUSES,
            customStatuses: CUSTOM_STATUSES,
          },
        },
      },
    });
    const integration = new TasksIntegration(app);
    const listener = vi.fn();
    integration.onStatusesChanged(listener);

    integration.unload();
    await integration.loadStatuses();

    expect(listener).not.toHaveBeenCalled();
  });
});
