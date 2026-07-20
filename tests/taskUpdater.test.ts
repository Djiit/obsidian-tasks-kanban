import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskUpdater } from "../src/services/TaskUpdater";
import { TasksIntegration } from "../src/services/TasksIntegration";
import type { Task, StatusInfo } from "../src/services/TasksIntegration";
import { TFile } from "obsidian";

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
  getDateSettings: vi.fn(),
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
    mockTasksIntegration.getDateSettings.mockResolvedValue({
      setDoneDate: true,
      setCancelledDate: true,
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: true,
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: false, // Disabled to test just symbol replacement
        setCancelledDate: false,
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: false,
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: false,
        setCancelledDate: false,
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: false,
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: false,
        setCancelledDate: true,
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: false,
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: false,
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: true,
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: true,
        setCancelledDate: false,
      });

      const result = await taskUpdater.updateTaskStatus(task, " ");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [ ] Done task",
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
      mockTasksIntegration.getDateSettings.mockResolvedValue({
        setDoneDate: false,
        setCancelledDate: true,
      });

      const result = await taskUpdater.updateTaskStatus(task, " ");
      expect(result).toBe(true);
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        "- [ ] Cancelled task",
      );
    });
  });
});
