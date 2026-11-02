import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskUpdater } from "../src/services/TaskUpdater";
import { TasksIntegration } from "../src/services/TasksIntegration";
import type { Task, StatusInfo } from "../src/services/TasksIntegration";
import { TFile } from "obsidian";
import { FIELD_SYNTAX } from "../src/utils/taskFormat";
import type { TaskFormat } from "../src/utils/taskFormat";

// Mock App with vault
const mockApp = {
  vault: {
    read: vi.fn().mockResolvedValue(""),
    modify: vi.fn().mockResolvedValue(undefined),
    getAbstractFileByPath: vi.fn(),
    configDir: "/mock-config",
    adapter: {
      read: vi.fn().mockRejectedValue(new Error("File not found")),
    },
  },
  workspace: {
    on: vi.fn(),
    offref: vi.fn(),
    trigger: vi.fn(),
  },
  plugins: {
    getPlugin: vi.fn(),
  },
  metadataCache: {},
} as any;

// Mock TasksIntegration
const mockTasksIntegration = {
  getStatusBySymbol: vi.fn(),
  getWriteSettings: vi.fn(),
  getEditTaskLineModal: vi.fn(),
  getTasks: vi.fn(),
  subscribe: vi.fn(),
  unload: vi.fn(),
  app: mockApp,
  taskUpdater: null as any,
} as any;

// Test data
const DONE_STATUS: StatusInfo = {
  symbol: "x",
  name: "Done",
  type: "DONE",
};

const TODO_STATUS: StatusInfo = {
  symbol: " ",
  name: "Todo",
  type: "TODO",
};

const CANCELLED_STATUS: StatusInfo = {
  symbol: "-",
  name: "Cancelled",
  type: "CANCELLED",
};

const IN_PROGRESS_STATUS: StatusInfo = {
  symbol: "/",
  name: "In Progress",
  type: "IN_PROGRESS",
};

function createTask(
  statusSymbol: string,
  lineNumber: number,
  description: string = "Test task",
): Task {
  return {
    id: "test-id",
    status: { symbol: statusSymbol, name: "Test", type: "TODO" },
    description,
    tags: [],
    priority: null,
    dueDate: null,
    startDate: null,
    scheduledDate: null,
    doneDate: null,
    createdDate: null,
    cancelledDate: null,
    recurrence: null,
    dependsOn: [],
    taskLocation: {
      path: "/test/file.md",
      lineNumber,
    },
    originalMarkdown: `- [${statusSymbol}] ${description}`,
  };
}

function createMockFile(content: string): TFile {
  // Create a proper instance that passes instanceof check
  const file = Object.create(TFile.prototype);
  (file as any).path = "/test/file.md";
  (file as any).basename = "file.md";
  (file as any).parent = null;
  (file as any).vault = mockApp.vault;
  (file as any).name = "file.md";
  (file as any).extension = "md";
  (file as any).created = 0;
  (file as any).ctime = 0;
  (file as any).mtime = 0;
  (file as any).size = content.length;
  (file as any).stat = async () => ({}) as any;
  (file as any).read = async () => content;
  (file as any).write = async () => {};
  (file as any).append = async () => {};
  (file as any).prepend = async () => {};
  (file as any).delete = async () => true;
  (file as any).rename = async () => {};
  (file as any).star = async () => {};
  (file as any).unstar = async () => {};
  (file as any).isStarred = () => false;
  (file as any).pin = async () => {};
  (file as any).unpin = async () => {};
  (file as any).isPinned = () => false;
  (file as any).getCache = () => null;
  (file as any).getCachedData = () => null;
  return file as TFile;
}

describe("TaskUpdater", () => {
  let taskUpdater: TaskUpdater;
  let mockFile: TFile;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks
    mockApp.vault.read.mockResolvedValue("");
    mockApp.vault.modify.mockResolvedValue(undefined);
    mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
    mockTasksIntegration.getStatusBySymbol.mockReturnValue(undefined);
    mockTasksIntegration.getWriteSettings.mockResolvedValue({
      setDoneDate: true,
      setCancelledDate: true,
      taskFormat: "tasksPluginEmoji",
    });

    // Create TaskUpdater with mock dependencies
    taskUpdater = new TaskUpdater(mockApp, mockTasksIntegration);

    // Create mock file
    mockFile = createMockFile("- [ ] Test task");
  });

  describe("updateTaskStatus", () => {
    // Helper to get today's date in YYYY-MM-DD format
    const getExpectedDate = () => {
      const today = new Date();
      return today.toISOString().split("T")[0];
    };

    beforeEach(() => {
      // Reset common mocks for each test
      mockApp.vault.read.mockResolvedValue("");
      mockApp.vault.modify.mockResolvedValue(undefined);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockTasksIntegration.getStatusBySymbol.mockReturnValue(undefined);
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: true,
        taskFormat: "tasksPluginEmoji",
      });
    });

    it("should return false if task has no path", async () => {
      const task = createTask(" ", 0);
      task.taskLocation = { path: "", lineNumber: 0 } as any;

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(false);
    });

    it("should return false if line number is undefined", async () => {
      const task = createTask(" ", 0);
      task.taskLocation = {
        path: "/test/file.md",
        lineNumber: undefined,
      } as any;

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(false);
    });

    it("should return false if file not found", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(false);
    });

    it("should return false if file is not a TFile", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue({} as any);

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(false);
    });

    it("should return false if line number is out of bounds", async () => {
      const task = createTask(" ", 10);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("line 0\nline 1");

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(false);
    });

    it("should return false if line does not match task pattern", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("This is not a task line");

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(false);
    });

    it("should replace status symbol", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("- [ ] Test task");

      // Mock status lookups - not DONE or CANCELLED, so no date added
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === " ") return TODO_STATUS;
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: false, // Disabled to test just symbol replacement
        setCancelledDate: false,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [x] Test task",
      );
    });

    it("should add done date when transitioning to DONE with setDoneDate enabled", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("- [ ] Test task");

      // Mock status lookups
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === " ") return TODO_STATUS;
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: false,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      const expectedDate = getExpectedDate();
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        `- [x] Test task ✅ ${expectedDate}`,
      );
    });

    it("should NOT add done date when setDoneDate is disabled", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("- [ ] Test task");

      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === " ") return TODO_STATUS;
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: false,
        setCancelledDate: false,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [x] Test task",
      );
    });

    it("should NOT add done date when already in DONE status", async () => {
      const task = createTask("x", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("- [x] Already done");

      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: false,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      // Should only replace symbol (no-op since same symbol) but not add date
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [x] Already done",
      );
    });

    it("should add cancelled date when transitioning to CANCELLED", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("- [ ] Test task");

      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === " ") return TODO_STATUS;
        if (symbol === "-") return CANCELLED_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: false,
        setCancelledDate: true,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, "-");
      expect(result).toBe(true);
      const expectedDate = getExpectedDate();
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        `- [-] Test task ❌ ${expectedDate}`,
      );
    });

    it("should replace existing done date when adding new one", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("- [ ] Test task ✅ 2026-07-19");

      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === " ") return TODO_STATUS;
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: false,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      const expectedDate = getExpectedDate();
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        `- [x] Test task ✅ ${expectedDate}`,
      );
    });

    it("should handle transition from IN_PROGRESS to DONE", async () => {
      const task = createTask("/", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("- [/] In progress task");

      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "/") return IN_PROGRESS_STATUS;
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: false,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      const expectedDate = getExpectedDate();
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        `- [x] In progress task ✅ ${expectedDate}`,
      );
    });

    it("should not add date for non-DONE/CANCELLED status transitions", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("- [ ] Test task");

      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === " ") return TODO_STATUS;
        if (symbol === "/") return IN_PROGRESS_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: true,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, "/");
      expect(result).toBe(true);
      // Should only replace symbol, no date added
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [/] Test task",
      );
    });

    it("should remove done date when transitioning FROM DONE to TODO", async () => {
      const task = createTask("x", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("- [x] Done task ✅ 2026-07-19");

      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "x") return DONE_STATUS;
        if (symbol === " ") return TODO_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: false,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, " ");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [ ] Done task",
      );
    });

    it("should remove cancelled date and add done date when transitioning FROM CANCELLED to DONE", async () => {
      // Regression test for https://github.com/Djiit/obsidian-tasks-kanban/issues/53
      // Cancelled -> Done must remove the ❌ cancelled date AND add ✅ done date,
      // not leave both dates on the line.
      const task = createTask("-", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue(
        "- [-] Cancelled task ❌ 2026-07-19",
      );

      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "-") return CANCELLED_STATUS;
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: true,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      const expectedDate = getExpectedDate();
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        `- [x] Cancelled task ✅ ${expectedDate}`,
      );
    });

    it("should remove done date and add cancelled date when transitioning FROM DONE to CANCELLED", async () => {
      // Regression test for https://github.com/Djiit/obsidian-tasks-kanban/issues/53
      // Done -> Cancelled must remove the ✅ done date AND add ❌ cancelled date,
      // not leave both dates on the line.
      const task = createTask("x", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("- [x] Done task ✅ 2026-07-19");

      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "x") return DONE_STATUS;
        if (symbol === "-") return CANCELLED_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: true,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, "-");
      expect(result).toBe(true);
      const expectedDate = getExpectedDate();
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        `- [-] Done task ❌ ${expectedDate}`,
      );
    });

    it("should remove cancelled date when transitioning FROM CANCELLED to TODO", async () => {
      const task = createTask("-", 0);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue(
        "- [-] Cancelled task ❌ 2026-07-19",
      );

      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "-") return CANCELLED_STATUS;
        if (symbol === " ") return TODO_STATUS;
        return undefined;
      });
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: false,
        setCancelledDate: true,
        taskFormat: "tasksPluginEmoji",
      });

      const result = await taskUpdater.updateTaskStatus(task, " ");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [ ] Cancelled task",
      );
    });
  });

  describe.each<TaskFormat>(["tasksPluginEmoji", "dataview"])(
    "transition matrix (%s format)",
    (format) => {
      const getExpectedDate = () => {
        const today = new Date();
        return today.toISOString().split("T")[0];
      };
      const doneSuffix = (date: string) =>
        FIELD_SYNTAX[format].doneDate.render(date);
      const cancelledSuffix = (date: string) =>
        FIELD_SYNTAX[format].cancelledDate.render(date);

      beforeEach(() => {
        mockApp.vault.read.mockResolvedValue("");
        mockApp.vault.modify.mockResolvedValue(undefined);
        mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
        mockTasksIntegration.getStatusBySymbol.mockReturnValue(undefined);
        mockTasksIntegration.getWriteSettings.mockResolvedValue({
          setDoneDate: true,
          setCancelledDate: true,
          taskFormat: format,
        });
      });

      it("TODO -> DONE adds a done date", async () => {
        const task = createTask(" ", 0);
        mockApp.vault.read.mockResolvedValue("- [ ] Test task");
        mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
          if (symbol === " ") return TODO_STATUS;
          if (symbol === "x") return DONE_STATUS;
          return undefined;
        });

        const result = await taskUpdater.updateTaskStatus(task, "x");
        expect(result).toBe(true);
        const expectedDate = getExpectedDate();
        expect(mockApp.vault.modify).toHaveBeenCalledWith(
          mockFile,
          `- [x] Test task${doneSuffix(expectedDate)}`,
        );
      });

      it("TODO -> CANCELLED adds a cancelled date", async () => {
        const task = createTask(" ", 0);
        mockApp.vault.read.mockResolvedValue("- [ ] Test task");
        mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
          if (symbol === " ") return TODO_STATUS;
          if (symbol === "-") return CANCELLED_STATUS;
          return undefined;
        });

        const result = await taskUpdater.updateTaskStatus(task, "-");
        expect(result).toBe(true);
        const expectedDate = getExpectedDate();
        expect(mockApp.vault.modify).toHaveBeenCalledWith(
          mockFile,
          `- [-] Test task${cancelledSuffix(expectedDate)}`,
        );
      });

      it("DONE -> TODO removes the done date", async () => {
        const task = createTask("x", 0);
        const staleDate = "2026-07-19";
        mockApp.vault.read.mockResolvedValue(
          `- [x] Done task${doneSuffix(staleDate)}`,
        );
        mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
          if (symbol === "x") return DONE_STATUS;
          if (symbol === " ") return TODO_STATUS;
          return undefined;
        });

        const result = await taskUpdater.updateTaskStatus(task, " ");
        expect(result).toBe(true);
        expect(mockApp.vault.modify).toHaveBeenCalledWith(
          mockFile,
          "- [ ] Done task",
        );
      });

      it("CANCELLED -> TODO removes the cancelled date", async () => {
        const task = createTask("-", 0);
        const staleDate = "2026-07-19";
        mockApp.vault.read.mockResolvedValue(
          `- [-] Cancelled task${cancelledSuffix(staleDate)}`,
        );
        mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
          if (symbol === "-") return CANCELLED_STATUS;
          if (symbol === " ") return TODO_STATUS;
          return undefined;
        });

        const result = await taskUpdater.updateTaskStatus(task, " ");
        expect(result).toBe(true);
        expect(mockApp.vault.modify).toHaveBeenCalledWith(
          mockFile,
          "- [ ] Cancelled task",
        );
      });

      it("DONE -> CANCELLED swaps the done date for a cancelled date", async () => {
        const task = createTask("x", 0);
        const staleDate = "2026-07-19";
        mockApp.vault.read.mockResolvedValue(
          `- [x] Done task${doneSuffix(staleDate)}`,
        );
        mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
          if (symbol === "x") return DONE_STATUS;
          if (symbol === "-") return CANCELLED_STATUS;
          return undefined;
        });

        const result = await taskUpdater.updateTaskStatus(task, "-");
        expect(result).toBe(true);
        const expectedDate = getExpectedDate();
        expect(mockApp.vault.modify).toHaveBeenCalledWith(
          mockFile,
          `- [-] Done task${cancelledSuffix(expectedDate)}`,
        );
      });

      it("CANCELLED -> DONE swaps the cancelled date for a done date", async () => {
        const task = createTask("-", 0);
        const staleDate = "2026-07-19";
        mockApp.vault.read.mockResolvedValue(
          `- [-] Cancelled task${cancelledSuffix(staleDate)}`,
        );
        mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
          if (symbol === "-") return CANCELLED_STATUS;
          if (symbol === "x") return DONE_STATUS;
          return undefined;
        });

        const result = await taskUpdater.updateTaskStatus(task, "x");
        expect(result).toBe(true);
        const expectedDate = getExpectedDate();
        // Field presence, not exact spacing: the cancelled field is stripped
        // after the done field is appended (append-before-strip ordering,
        // matching the DONE<->CANCELLED transition matrix), so adjacent
        // whitespace between the two fields can be absorbed by the strip
        // regex's trailing comma/space handling.
        const writtenLine = mockApp.vault.modify.mock.calls[0][1] as string;
        expect(writtenLine).not.toMatch(/cancelled/);
        expect(writtenLine).toContain(doneSuffix(expectedDate).trim());
      });

      it("IN_PROGRESS -> DONE adds a done date", async () => {
        const task = createTask("/", 0);
        mockApp.vault.read.mockResolvedValue("- [/] In progress task");
        mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
          if (symbol === "/") return IN_PROGRESS_STATUS;
          if (symbol === "x") return DONE_STATUS;
          return undefined;
        });

        const result = await taskUpdater.updateTaskStatus(task, "x");
        expect(result).toBe(true);
        const expectedDate = getExpectedDate();
        expect(mockApp.vault.modify).toHaveBeenCalledWith(
          mockFile,
          `- [x] In progress task${doneSuffix(expectedDate)}`,
        );
      });

      it("re-dropping into DONE does not duplicate the done date", async () => {
        const task = createTask("x", 0);
        const staleDate = "2026-07-19";
        mockApp.vault.read.mockResolvedValue(
          `- [x] Done task${doneSuffix(staleDate)}`,
        );
        mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
          if (symbol === "x") return DONE_STATUS;
          return undefined;
        });

        const result = await taskUpdater.updateTaskStatus(task, "x");
        expect(result).toBe(true);
        // Same status -> same status is not a transition, so the stale date
        // is left as-is (no duplicate is introduced).
        expect(mockApp.vault.modify).toHaveBeenCalledWith(
          mockFile,
          `- [x] Done task${doneSuffix(staleDate)}`,
        );
      });
    },
  );

  describe("dataview-specific formatting", () => {
    beforeEach(() => {
      mockApp.vault.read.mockResolvedValue("");
      mockApp.vault.modify.mockResolvedValue(undefined);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockTasksIntegration.getStatusBySymbol.mockReturnValue(undefined);
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: true,
        taskFormat: "dataview",
      });
    });

    const getExpectedDate = () => {
      const today = new Date();
      return today.toISOString().split("T")[0];
    };

    it("writes the done date as `[completion:: ...]` with two leading spaces", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.read.mockResolvedValue("- [ ] Test task");
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === " ") return TODO_STATUS;
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      const expectedDate = getExpectedDate();
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        `- [x] Test task  [completion:: ${expectedDate}]`,
      );
    });

    it("writes the cancelled date as `[cancelled:: ...]` with two leading spaces", async () => {
      const task = createTask(" ", 0);
      mockApp.vault.read.mockResolvedValue("- [ ] Test task");
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === " ") return TODO_STATUS;
        if (symbol === "-") return CANCELLED_STATUS;
        return undefined;
      });

      const result = await taskUpdater.updateTaskStatus(task, "-");
      expect(result).toBe(true);
      const expectedDate = getExpectedDate();
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        `- [-] Test task  [cancelled:: ${expectedDate}]`,
      );
    });

    it("removes the done field on leaving DONE", async () => {
      const task = createTask("x", 0);
      mockApp.vault.read.mockResolvedValue(
        "- [x] Test task  [completion:: 2026-07-19]",
      );
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "x") return DONE_STATUS;
        if (symbol === " ") return TODO_STATUS;
        return undefined;
      });

      const result = await taskUpdater.updateTaskStatus(task, " ");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [ ] Test task",
      );
    });

    it("does not duplicate the completion field on re-drop into DONE", async () => {
      const task = createTask("x", 0);
      mockApp.vault.read.mockResolvedValue(
        "- [x] Test task  [completion:: 2026-07-19]",
      );
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      const writtenLine = mockApp.vault.modify.mock.calls[0][1] as string;
      expect(writtenLine.match(/completion::/g)?.length).toBe(1);
    });

    it("strips the paren form on leaving DONE", async () => {
      const task = createTask("x", 0);
      mockApp.vault.read.mockResolvedValue(
        "- [x] Test task (completion:: 2026-07-19)",
      );
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "x") return DONE_STATUS;
        if (symbol === " ") return TODO_STATUS;
        return undefined;
      });

      const result = await taskUpdater.updateTaskStatus(task, " ");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [ ] Test task",
      );
    });

    it("strips the trailing-comma form on leaving DONE", async () => {
      const task = createTask("x", 0);
      mockApp.vault.read.mockResolvedValue(
        "- [x] Test task  [completion:: 2026-07-19],",
      );
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "x") return DONE_STATUS;
        if (symbol === " ") return TODO_STATUS;
        return undefined;
      });

      const result = await taskUpdater.updateTaskStatus(task, " ");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [ ] Test task",
      );
    });

    it("CANCELLED -> DONE removes the cancelled field and adds a completion field", async () => {
      const task = createTask("-", 0);
      mockApp.vault.read.mockResolvedValue(
        "- [-] Cancelled task  [cancelled:: 2026-07-19]",
      );
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "-") return CANCELLED_STATUS;
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      const expectedDate = getExpectedDate();
      const writtenLine = mockApp.vault.modify.mock.calls[0][1] as string;
      expect(writtenLine).not.toContain("cancelled::");
      expect(writtenLine).toContain(`[completion:: ${expectedDate}]`);
    });

    it("falls back to emoji format for an unrecognised taskFormat value", async () => {
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: true,
        taskFormat: "someFutureFormat",
      });
      const task = createTask(" ", 0);
      mockApp.vault.read.mockResolvedValue("- [ ] Test task");
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === " ") return TODO_STATUS;
        if (symbol === "x") return DONE_STATUS;
        return undefined;
      });

      const result = await taskUpdater.updateTaskStatus(task, "x");
      expect(result).toBe(true);
      const expectedDate = getExpectedDate();
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        `- [x] Test task ✅ ${expectedDate}`,
      );
    });

    // Regression guard for the "each format strips only its own syntax"
    // decision (see spec §3.1). This looks like a bug — an emoji token
    // sitting unstripped on a Dataview-format line — but it is deliberate:
    // under Dataview format the Tasks plugin never parsed that emoji token
    // as a date, so it is part of the user's own description text, and
    // removing it would silently edit user content.
    it("leaves a foreign emoji token untouched when format is dataview", async () => {
      const task = createTask("x", 0);
      mockApp.vault.read.mockResolvedValue("- [x] Test task ✅ 2026-07-19");
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "x") return DONE_STATUS;
        if (symbol === " ") return TODO_STATUS;
        return undefined;
      });

      const result = await taskUpdater.updateTaskStatus(task, " ");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [ ] Test task ✅ 2026-07-19",
      );
    });
  });

  describe("emoji-format foreign-token survival", () => {
    beforeEach(() => {
      mockApp.vault.read.mockResolvedValue("");
      mockApp.vault.modify.mockResolvedValue(undefined);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockTasksIntegration.getStatusBySymbol.mockReturnValue(undefined);
      mockTasksIntegration.getWriteSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: true,
        taskFormat: "tasksPluginEmoji",
      });
    });

    // Symmetric regression guard: under emoji format, a Dataview
    // `[completion:: ...]` field is not parsed by Tasks either, so it is
    // description text and must survive.
    it("leaves a foreign dataview field untouched when format is tasksPluginEmoji", async () => {
      const task = createTask("x", 0);
      mockApp.vault.read.mockResolvedValue(
        "- [x] Test task [completion:: 2026-07-19]",
      );
      mockTasksIntegration.getStatusBySymbol.mockImplementation((symbol) => {
        if (symbol === "x") return DONE_STATUS;
        if (symbol === " ") return TODO_STATUS;
        return undefined;
      });

      const result = await taskUpdater.updateTaskStatus(task, " ");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [ ] Test task [completion:: 2026-07-19]",
      );
    });
  });

  describe("editTask", () => {
    const editTaskLineModal = vi.fn();

    beforeEach(() => {
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue("# Notes\n- [ ] Test task\nend");
      editTaskLineModal.mockReset();
      mockTasksIntegration.getEditTaskLineModal.mockReturnValue(
        editTaskLineModal,
      );
    });

    it("opens the modal with the task's line and writes the edited line back", async () => {
      editTaskLineModal.mockResolvedValue("- [ ] Test task ⏫");

      const result = await taskUpdater.editTask(createTask(" ", 1));

      expect(result).toBe(true);
      expect(editTaskLineModal).toHaveBeenCalledWith("- [ ] Test task");
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "# Notes\n- [ ] Test task ⏫\nend",
      );
    });

    it("writes every line the modal returns, e.g. the next recurrence", async () => {
      editTaskLineModal.mockResolvedValue(
        "- [ ] Test task 🔁 every day 📅 2026-07-21\n- [x] Test task 🔁 every day 📅 2026-07-20",
      );

      const result = await taskUpdater.editTask(createTask(" ", 1));

      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "# Notes\n- [ ] Test task 🔁 every day 📅 2026-07-21\n- [x] Test task 🔁 every day 📅 2026-07-20\nend",
      );
    });

    it("leaves the file alone when the modal is cancelled", async () => {
      editTaskLineModal.mockResolvedValue("");

      const result = await taskUpdater.editTask(createTask(" ", 1));

      expect(result).toBe(false);
      expect(mockApp.vault.modify).not.toHaveBeenCalled();
    });

    it("does not overwrite a line that changed while the modal was open", async () => {
      editTaskLineModal.mockResolvedValue("- [ ] Test task ⏫");
      mockApp.vault.read.mockResolvedValue("# Notes\n- [x] Other task\nend");

      const result = await taskUpdater.editTask(createTask(" ", 1));

      expect(result).toBe(false);
      expect(mockApp.vault.modify).not.toHaveBeenCalled();
    });

    it("returns false without a modal when Tasks offers no edit API", async () => {
      mockTasksIntegration.getEditTaskLineModal.mockReturnValue(null);

      const result = await taskUpdater.editTask(createTask(" ", 1));

      expect(result).toBe(false);
      expect(mockApp.vault.modify).not.toHaveBeenCalled();
    });

    it("returns false when the task's file can't be found", async () => {
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const result = await taskUpdater.editTask(createTask(" ", 1));

      expect(result).toBe(false);
      expect(editTaskLineModal).not.toHaveBeenCalled();
    });
  });
});
