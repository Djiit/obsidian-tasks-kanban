import { describe, it, expect, vi } from "vitest";
import TasksKanbanPlugin from "../src/main";
import { TasksKanbanSettingsTab } from "../src/settings/SettingsTab";

/**
 * Minimal App double: enough for TasksKanbanPlugin.onload() and
 * createAndOpenBlankBoard() to run under the obsidian mock.
 */
function makeApp() {
  return {
    plugins: {
      getPlugin: (id: string) =>
        id === "obsidian-tasks-plugin" ? { settings: {} } : null,
    },
    workspace: {
      on: vi.fn(() => ({})),
      offref: vi.fn(),
      trigger: vi.fn(),
      getLeavesOfType: vi.fn(() => []),
      getLeaf: vi.fn(() => ({
        setViewState: vi.fn(async () => {}),
        view: null,
      })),
      setActiveLeaf: vi.fn(),
    },
    vault: {
      configDir: ".obsidian",
      adapter: {
        read: vi.fn(async () => {
          throw new Error("ENOENT");
        }),
      },
    },
  } as never;
}

/**
 * Instantiate the plugin with the lifecycle methods the obsidian mock's Plugin
 * base class doesn't provide stubbed out, capturing the registered settings tab.
 */
function makePlugin(app: ReturnType<typeof makeApp>) {
  const plugin = new TasksKanbanPlugin(app, {} as never);
  let settingsTab: TasksKanbanSettingsTab | null = null;
  Object.assign(plugin, {
    app,
    loadData: vi.fn(async () => null),
    saveData: vi.fn(async () => {}),
    addSettingTab: vi.fn((tab: TasksKanbanSettingsTab) => {
      settingsTab = tab;
    }),
    registerView: vi.fn(),
    addCommand: vi.fn(),
  });
  return {
    plugin,
    getSettingsTab: () => settingsTab as TasksKanbanSettingsTab | null,
  };
}

describe("TasksKanbanPlugin", () => {
  it("registers the settings tab on load", async () => {
    const { plugin, getSettingsTab } = makePlugin(makeApp());

    await plugin.onload();

    expect(getSettingsTab()).toBeInstanceOf(TasksKanbanSettingsTab);
  });

  it("re-renders the settings tab when a blank board is created from a command", async () => {
    const { plugin, getSettingsTab } = makePlugin(makeApp());
    await plugin.onload();
    const tab = getSettingsTab();
    expect(tab).not.toBeNull();
    const refreshSpy = vi.spyOn(tab as TasksKanbanSettingsTab, "refresh");

    const id = await plugin.createAndOpenBlankBoard();

    expect(refreshSpy).toHaveBeenCalled();
    expect(plugin.getPluginData().savedBoards.map((b) => b.id)).toContain(id);
  });
});
