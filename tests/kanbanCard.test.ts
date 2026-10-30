import { afterEach, describe, it, expect, vi } from "vitest";
import { Component, MarkdownRenderer } from "obsidian";
import { KanbanCard } from "../src/components/KanbanCard";
import type { Task } from "../src/services/TasksIntegration";

const TASK: Task = {
  id: "t1",
  status: { symbol: " ", name: "Todo", type: "TODO" },
  description: "A todo task",
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
  taskLocation: { path: "notes.md", lineNumber: 12 },
  originalMarkdown: "- [ ] A todo task",
};

function mockIntegration(file: unknown) {
  const openFile = vi.fn().mockResolvedValue(undefined);
  const getLeaf = vi.fn().mockReturnValue({ openFile });
  const getFileByPath = vi.fn().mockReturnValue(file);
  const openLinkText = vi.fn().mockResolvedValue(undefined);
  const integration = {
    getTasks: vi.fn().mockReturnValue([]),
    app: {
      vault: { getFileByPath },
      workspace: { getLeaf, openLinkText },
    },
  };
  return {
    integration: integration as any,
    openFile,
    getFileByPath,
    openLinkText,
  };
}

/** Let the asynchronous Markdown rendering finish. */
function flushRendering(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Make the renderer emit `html` inside a paragraph, as Obsidian does. */
function renderAs(html: string) {
  return vi
    .spyOn(MarkdownRenderer, "render")
    .mockImplementation(async (_app, _markdown, el) => {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = html;
      el.appendChild(paragraph);
    });
}

function description(container: HTMLElement): HTMLElement {
  return container.querySelector(".tasks-kanban-card-description")!;
}

describe("KanbanCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the source file and scrolls to the task's line on click", () => {
    const file = { path: "notes.md" };
    const { integration, openFile, getFileByPath } = mockIntegration(file);
    const container = document.createElement("div");
    const card = new KanbanCard(container, TASK, integration);
    card.render();

    container.click();

    expect(getFileByPath).toHaveBeenCalledWith("notes.md");
    expect(openFile).toHaveBeenCalledWith(file, { eState: { line: 12 } });
    card.destroy();
  });

  it("does nothing when the source file can't be found", () => {
    const { integration, openFile } = mockIntegration(null);
    const container = document.createElement("div");
    const card = new KanbanCard(container, TASK, integration);
    card.render();

    container.click();

    expect(openFile).not.toHaveBeenCalled();
    card.destroy();
  });

  describe("description", () => {
    it("renders the description as Markdown relative to the task's file", () => {
      const render = vi.spyOn(MarkdownRenderer, "render");
      const { integration } = mockIntegration(null);
      const container = document.createElement("div");
      const card = new KanbanCard(
        container,
        { ...TASK, description: "Read **this** #later", tags: ["#later"] },
        integration,
      );
      card.render();

      expect(render).toHaveBeenCalledWith(
        integration.app,
        "Read **this**",
        description(container),
        "notes.md",
        expect.any(Component),
      );
      card.destroy();
    });

    it("unwraps the paragraph so the text sits directly in the card", async () => {
      const { integration } = mockIntegration(null);
      const container = document.createElement("div");
      const card = new KanbanCard(container, TASK, integration);
      card.render();
      await flushRendering();

      expect(description(container).querySelector("p")).toBeNull();
      expect(description(container).textContent).toBe("A todo task");
      card.destroy();
    });

    it("keeps links from taking over the card's drag", async () => {
      renderAs('<a class="external-link" href="https://example.com">x</a>');
      const { integration } = mockIntegration(null);
      const container = document.createElement("div");
      const card = new KanbanCard(container, TASK, integration);
      card.render();
      await flushRendering();

      expect(container.querySelector("a")!.getAttribute("draggable")).toBe(
        "false",
      );
      card.destroy();
    });

    it("unloads its render component when the card is destroyed", () => {
      const unload = vi.spyOn(Component.prototype, "unload");
      const { integration } = mockIntegration(null);
      const card = new KanbanCard(
        document.createElement("div"),
        TASK,
        integration,
      );
      card.render();

      card.destroy();

      expect(unload).toHaveBeenCalledOnce();
    });
  });

  describe("links in the description", () => {
    it("opens an internal link instead of the task's file", async () => {
      renderAs(
        '<a class="internal-link" data-href="Other note" href="Other note">Other</a>',
      );
      const { integration, openFile, openLinkText } = mockIntegration({
        path: "notes.md",
      });
      const container = document.createElement("div");
      const card = new KanbanCard(container, TASK, integration);
      card.render();
      await flushRendering();

      container.querySelector("a")!.click();

      expect(openLinkText).toHaveBeenCalledWith(
        "Other note",
        "notes.md",
        false,
      );
      expect(openFile).not.toHaveBeenCalled();
      card.destroy();
    });

    it("leaves an external link to the browser without opening the task's file", async () => {
      renderAs('<a class="external-link" href="https://example.com">x</a>');
      const { integration, openFile, openLinkText } = mockIntegration({
        path: "notes.md",
      });
      const container = document.createElement("div");
      const card = new KanbanCard(container, TASK, integration);
      card.render();
      await flushRendering();
      const link = container.querySelector("a")!;
      // jsdom cannot navigate; record whether the card blocked the default.
      let defaultPrevented: boolean | undefined;
      link.addEventListener("click", (event) => {
        defaultPrevented = event.defaultPrevented;
        event.preventDefault();
      });

      link.click();

      expect(defaultPrevented).toBe(false);
      expect(openLinkText).not.toHaveBeenCalled();
      expect(openFile).not.toHaveBeenCalled();
      card.destroy();
    });

    it("still opens the task's file when the text around a link is clicked", async () => {
      renderAs(
        'See <a class="internal-link" data-href="Other" href="Other">Other</a>',
      );
      const file = { path: "notes.md" };
      const { integration, openFile } = mockIntegration(file);
      const container = document.createElement("div");
      const card = new KanbanCard(container, TASK, integration);
      card.render();
      await flushRendering();

      description(container).click();

      expect(openFile).toHaveBeenCalledWith(file, { eState: { line: 12 } });
      card.destroy();
    });
  });
});
