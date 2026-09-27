import { describe, it, expect, vi, beforeEach } from "vitest";
import { Setting } from "obsidian";
import { TasksKanbanSettingsTab } from "../src/settings/SettingsTab";
import type TasksKanbanPlugin from "../src/main";
import type { StatusInfo } from "../src/services/TasksIntegration";
import type {
  ColumnConfig,
  PluginData,
  SavedBoard,
} from "../src/types/persistence";

const STATUSES: StatusInfo[] = [
  { symbol: " ", name: "Todo", type: "TODO" },
  { symbol: "/", name: "In progress", type: "IN_PROGRESS" },
  { symbol: "x", name: "Done", type: "DONE" },
];

interface TestHarness {
  tab: TasksKanbanSettingsTab;
  plugin: {
    getPluginData: () => PluginData;
    getStatuses: () => StatusInfo[];
    saveSettings: ReturnType<typeof vi.fn>;
  };
  data: PluginData;
  update: ReturnType<typeof vi.fn>;
}

function makeData(overrides: Partial<PluginData> = {}): PluginData {
  return {
    baseQuery: "",
    baseCollapsedColumns: [],
    baseCollapsedGroups: [],
    baseColumns: [],
    savedBoards: [],
    ...overrides,
  };
}

function makeBoard(overrides: Partial<SavedBoard> = {}): SavedBoard {
  return {
    id: "board-1",
    name: "Work",
    query: "",
    collapsedColumns: [],
    columns: [],
    ...overrides,
  };
}

function makeHarness(data: PluginData): TestHarness {
  const plugin = {
    getPluginData: () => data,
    getStatuses: () => STATUSES,
    saveSettings: vi.fn(
      async (
        baseQuery: string,
        baseColumns: ColumnConfig[],
        savedBoards: SavedBoard[],
      ) => {
        data = { ...data, baseQuery, baseColumns, savedBoards };
      },
    ),
  };
  const tab = new TasksKanbanSettingsTab(
    { workspace: { getLeavesOfType: () => [] } } as never,
    plugin as unknown as TasksKanbanPlugin,
  );
  const update = vi.spyOn(tab, "update").mockReturnValue(undefined);
  return { tab, plugin, data, update };
}

type AnyDefinition = Record<string, any>;

/** Flatten groups into a single list of leaf setting definitions. */
function flatten(defs: AnyDefinition[]): AnyDefinition[] {
  return defs.flatMap((def) =>
    def.items ? flatten(def.items) : [def],
  ) as AnyDefinition[];
}

function findByName(
  defs: AnyDefinition[],
  name: string,
): AnyDefinition | undefined {
  return flatten(defs).find((def) => def.name === name);
}

function columnItem(
  defs: AnyDefinition[],
  title: string,
): AnyDefinition | undefined {
  return flatten(defs).find(
    (def) => typeof def.render === "function" && def.name === title,
  );
}

function makeColumn(overrides: Partial<ColumnConfig> = {}): ColumnConfig {
  return { id: "col-1", title: "Ongoing", symbols: ["/"], ...overrides };
}

describe("settings definitions: custom columns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("base board", () => {
    it("exposes a Custom columns toggle bound to baseColumnsEnabled", () => {
      const { tab } = makeHarness(makeData());

      const defs = tab.getSettingDefinitions() as unknown as AnyDefinition[];
      const toggle = findByName(defs, "Custom columns");

      expect(toggle?.control).toEqual({
        type: "toggle",
        key: "baseColumnsEnabled",
      });
    });

    it("reports whether custom columns are enabled", () => {
      const { tab } = makeHarness(makeData({ baseColumns: [makeColumn()] }));

      expect(tab.getControlValue("baseColumnsEnabled")).toBe(true);
    });

    it("seeds one empty column when the toggle is turned on, then re-renders", async () => {
      const { tab, plugin, update } = makeHarness(makeData());

      await tab.setControlValue("baseColumnsEnabled", true);

      const [, baseColumns] = plugin.saveSettings.mock.calls[0];
      expect(baseColumns).toHaveLength(1);
      expect(baseColumns[0]).toMatchObject({ title: "", symbols: [] });
      expect(update).toHaveBeenCalled();
    });

    it("clears custom columns when the toggle is turned off", async () => {
      const { tab, plugin } = makeHarness(
        makeData({ baseColumns: [makeColumn()] }),
      );

      await tab.setControlValue("baseColumnsEnabled", false);

      const [, baseColumns] = plugin.saveSettings.mock.calls[0];
      expect(baseColumns).toEqual([]);
    });

    it("renders one editor row per custom column plus an Add column action", () => {
      const { tab } = makeHarness(
        makeData({
          baseColumns: [
            makeColumn(),
            makeColumn({ id: "col-2", title: "Review", symbols: ["r"] }),
          ],
        }),
      );

      const defs = tab.getSettingDefinitions() as unknown as AnyDefinition[];

      expect(columnItem(defs, "Ongoing")).toBeDefined();
      expect(columnItem(defs, "Review")).toBeDefined();
      expect(findByName(defs, "Add column")?.action).toBeTypeOf("function");
    });

    it("persists column name edits from the editor row", async () => {
      const column = makeColumn();
      const { tab, plugin } = makeHarness(makeData({ baseColumns: [column] }));
      const defs = tab.getSettingDefinitions() as unknown as AnyDefinition[];
      const item = columnItem(defs, "Ongoing");

      const setting = new Setting(document.createElement("div"));
      item?.render(setting);
      setting.textComponents[0].simulate("In review");

      const [, baseColumns] = plugin.saveSettings.mock.calls[0];
      expect(baseColumns[0].title).toBe("In review");
    });

    it("persists symbol selection from the editor row", async () => {
      const column = makeColumn({ symbols: [] });
      const { tab, plugin } = makeHarness(makeData({ baseColumns: [column] }));
      const defs = tab.getSettingDefinitions() as unknown as AnyDefinition[];
      const item = columnItem(defs, "Ongoing");

      const setting = new Setting(document.createElement("div"));
      item?.render(setting);

      const checkboxes = setting.controlEl.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]',
      );
      expect(checkboxes).toHaveLength(3);

      checkboxes[1].checked = true;
      checkboxes[1].dispatchEvent(new Event("change"));

      const [, baseColumns] = plugin.saveSettings.mock.calls[0];
      expect(baseColumns[0].symbols).toEqual(["/"]);
    });

    it("deletes a column from the editor row", async () => {
      const columns = [makeColumn(), makeColumn({ id: "col-2" })];
      const { tab, plugin } = makeHarness(makeData({ baseColumns: columns }));
      const defs = tab.getSettingDefinitions() as unknown as AnyDefinition[];
      const item = columnItem(defs, "Ongoing");

      const setting = new Setting(document.createElement("div"));
      item?.render(setting);
      setting.extraButtonComponents[0].click();

      const [, baseColumns] = plugin.saveSettings.mock.calls[0];
      expect(baseColumns.map((c: ColumnConfig) => c.id)).toEqual(["col-2"]);
    });

    it("adds a column from the Add column action", async () => {
      const { tab, plugin } = makeHarness(
        makeData({ baseColumns: [makeColumn()] }),
      );
      const defs = tab.getSettingDefinitions() as unknown as AnyDefinition[];

      findByName(defs, "Add column")?.action(document.createElement("div"), 0);

      const [, baseColumns] = plugin.saveSettings.mock.calls[0];
      expect(baseColumns).toHaveLength(2);
      expect(baseColumns[1]).toMatchObject({ title: "", symbols: [] });
    });

    it("hides the Add column action while custom columns are off", () => {
      const { tab } = makeHarness(makeData());
      const defs = tab.getSettingDefinitions() as unknown as AnyDefinition[];
      const addItem = findByName(defs, "Add column");

      expect(addItem?.visible).toBeTypeOf("function");
      expect(addItem?.visible()).toBe(false);
    });
  });

  describe("saved boards", () => {
    it("exposes a per-board Custom columns toggle", () => {
      const board = makeBoard();
      const { tab } = makeHarness(makeData({ savedBoards: [board] }));

      const defs = tab.getSettingDefinitions() as unknown as AnyDefinition[];
      const toggle = flatten(defs).find(
        (def) => def.control?.key === "savedBoardColumnsEnabled-board-1",
      );

      expect(toggle?.name).toBe("Custom columns");
      expect(toggle?.control).toEqual({
        type: "toggle",
        key: "savedBoardColumnsEnabled-board-1",
      });
    });

    it("reports and toggles per-board custom columns", async () => {
      const board = makeBoard({ columns: [makeColumn()] });
      const { tab, plugin } = makeHarness(makeData({ savedBoards: [board] }));

      expect(tab.getControlValue("savedBoardColumnsEnabled-board-1")).toBe(
        true,
      );

      await tab.setControlValue("savedBoardColumnsEnabled-board-1", false);

      const [, , savedBoards] = plugin.saveSettings.mock.calls[0];
      expect(savedBoards[0].columns).toEqual([]);
    });

    it("seeds one empty column when a board's toggle is turned on", async () => {
      const board = makeBoard();
      const { tab, plugin } = makeHarness(makeData({ savedBoards: [board] }));

      await tab.setControlValue("savedBoardColumnsEnabled-board-1", true);

      const [, , savedBoards] = plugin.saveSettings.mock.calls[0];
      expect(savedBoards[0].columns).toHaveLength(1);
      expect(savedBoards[0].columns[0]).toMatchObject({
        title: "",
        symbols: [],
      });
    });

    it("renders per-board column editors and Add column action", () => {
      const board = makeBoard({ columns: [makeColumn({ title: "Review" })] });
      const { tab } = makeHarness(makeData({ savedBoards: [board] }));

      const defs = tab.getSettingDefinitions() as unknown as AnyDefinition[];

      expect(columnItem(defs, "Review")).toBeDefined();
      const addItems = flatten(defs).filter((def) => def.name === "Add column");
      const boardAdd = addItems.find((item) => item.visible?.() === true);
      expect(boardAdd?.action).toBeTypeOf("function");
    });

    it("persists symbol edits from a board's column editor", async () => {
      const column = makeColumn({ symbols: [] });
      const board = makeBoard({ columns: [column] });
      const { tab, plugin } = makeHarness(makeData({ savedBoards: [board] }));
      const defs = tab.getSettingDefinitions() as unknown as AnyDefinition[];
      const item = columnItem(defs, "Ongoing");

      const setting = new Setting(document.createElement("div"));
      item?.render(setting);

      const checkboxes = setting.controlEl.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]',
      );
      checkboxes[2].checked = true;
      checkboxes[2].dispatchEvent(new Event("change"));

      const [, , savedBoards] = plugin.saveSettings.mock.calls[0];
      expect(savedBoards[0].columns[0].symbols).toEqual(["x"]);
    });
  });
});
