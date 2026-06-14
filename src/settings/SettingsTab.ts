import {
  App,
  type ButtonComponent,
  PluginSettingTab,
  Setting,
} from "obsidian";

import { parseQuery } from "../query/boardQuery";
import { createSavedBoard } from "../query/savedBoards";
import type { SavedBoard } from "../types/persistence";
import type TasksKanbanPlugin from "../main";

const DOCS_URL =
  "https://github.com/Djiit/obsidian-tasks-kanban/blob/main/docs/query-syntax.md";

// Literal query syntax shown as an example placeholder; intentionally verbatim.
const QUERY_PLACEHOLDER = [
  "tag includes #work",
  "description includes write tests",
  "sort by due reverse",
  "group by priority",
].join("\n");

/**
 * Settings tab for the Tasks Kanban plugin.
 *
 * Edits the shared base query plus a list of saved boards (views). All edits are
 * kept in working copies and committed together via Save; the Save button is
 * disabled while any query has parse errors.
 */
export class TasksKanbanSettingsTab extends PluginSettingTab {
  private plugin: TasksKanbanPlugin;

  // Working copies, committed on Save.
  private baseQuery = "";
  private savedBoards: SavedBoard[] = [];

  // Parse-error state, keyed by field ("base" or a saved-board id).
  private errors = new Map<string, string[]>();
  private saveButton: ButtonComponent | null = null;

  constructor(app: App, plugin: TasksKanbanPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    // Seed working copies from the plugin's current data each time the tab opens.
    const data = this.plugin.getPluginData();
    this.baseQuery = data.baseQuery;
    this.savedBoards = data.savedBoards.map((b) => ({ ...b }));
    this.errors.clear();

    this.render();
  }

  /** (Re)build the whole settings pane from the working copies. */
  private render(): void {
    const { containerEl } = this;
    containerEl.empty();
    this.saveButton = null;

    new Setting(containerEl).setName("Base query").setHeading();

    containerEl.createEl("p", {
      cls: "tasks-kanban-settings-help",
      text: "Applied on top of every board. Saved queries are merged with it.",
    });

    this.renderQueryField(containerEl, "base", this.baseQuery, (value) => {
      this.baseQuery = value;
    });

    new Setting(containerEl).setName("Saved boards").setHeading();

    for (const board of this.savedBoards) {
      this.renderSavedBoard(containerEl, board);
    }

    new Setting(containerEl).addButton((button) => {
      button.setButtonText("Add saved board").onClick(() => {
        this.savedBoards.push(createSavedBoard("New board"));
        this.render();
      });
    });

    const saveSetting = new Setting(containerEl).addButton((button) => {
      this.saveButton = button;
      button
        .setButtonText("Save")
        .setCta()
        .setDisabled(this.hasErrors())
        .onClick(() => {
          void this.save();
        });
    });
    saveSetting.settingEl.addClass("tasks-kanban-settings-save");
  }

  /** Render a saved board's name input, query textarea, and delete button. */
  private renderSavedBoard(containerEl: HTMLElement, board: SavedBoard): void {
    new Setting(containerEl)
      .setName("Name")
      .addText((text) => {
        text.setValue(board.name).onChange((value) => {
          board.name = value;
        });
      })
      .addExtraButton((button) => {
        button
          .setIcon("trash")
          .setTooltip("Delete saved board")
          .onClick(() => {
            this.savedBoards = this.savedBoards.filter(
              (b) => b.id !== board.id,
            );
            this.errors.delete(board.id);
            this.render();
          });
      });

    this.renderQueryField(containerEl, board.id, board.query, (value) => {
      board.query = value;
    });
  }

  /**
   * Render a query textarea bound to `key`, validating on every change. Errors
   * render into a sibling div and toggle the Save button — without re-rendering
   * the pane (which would blur the textarea the user is typing in).
   */
  private renderQueryField(
    containerEl: HTMLElement,
    key: string,
    initialValue: string,
    onChange: (value: string) => void,
  ): void {
    const querySetting = new Setting(containerEl)
      .setName("Query")
      .setClass("tasks-kanban-setting-query")
      .setDesc("One instruction per line.")
      .addTextArea((textArea) => {
        textArea.inputEl.rows = 8;
        textArea.inputEl.spellcheck = false;
        textArea.inputEl.placeholder = QUERY_PLACEHOLDER;
        textArea.setValue(initialValue);
        textArea.onChange((value) => {
          onChange(value);
          this.validateField(key, value, errorEl);
        });
      });

    querySetting.descEl.createEl("br");
    querySetting.descEl.createEl("a", {
      text: "See the documentation.",
      href: DOCS_URL,
    });

    const errorEl = containerEl.createDiv({
      cls: "tasks-kanban-settings-errors",
    });

    // Seed initial error state.
    this.validateField(key, initialValue, errorEl);
  }

  /**
   * Parse `value`, store its errors under `key`, render them into `errorEl`, and
   * keep the Save button's disabled state in sync.
   */
  private validateField(
    key: string,
    value: string,
    errorEl: HTMLElement,
  ): void {
    const { errors } = parseQuery(value);

    if (errors.length === 0) {
      this.errors.delete(key);
    } else {
      this.errors.set(key, errors);
    }

    errorEl.empty();
    for (const error of errors) {
      errorEl.createDiv({ cls: "tasks-kanban-settings-error", text: error });
    }

    this.saveButton?.setDisabled(this.hasErrors());
  }

  private hasErrors(): boolean {
    return this.errors.size > 0;
  }

  private async save(): Promise<void> {
    if (this.hasErrors()) {
      return;
    }
    await this.plugin.saveSettings(this.baseQuery, this.savedBoards);
  }
}
