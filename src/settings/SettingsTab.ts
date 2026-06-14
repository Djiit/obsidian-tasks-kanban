import { App, PluginSettingTab, Setting, TextAreaComponent } from "obsidian";

import { parseQuery, type BoardQuery } from "../query/boardQuery";
import type TasksKanbanPlugin from "../main";

const DOCS_URL =
  "https://github.com/Djiit/obsidian-tasks-kanban/blob/main/docs/query-syntax.md";

/**
 * Settings tab for the Tasks Kanban plugin.
 * Provides a way to edit the board query from the Settings pane.
 */
export class TasksKanbanSettingsTab extends PluginSettingTab {
  private plugin: TasksKanbanPlugin;
  private textarea!: TextAreaComponent;
  private errorEl!: HTMLElement;
  private parsed: BoardQuery;

  constructor(app: App, plugin: TasksKanbanPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.parsed = parseQuery(plugin.getBoardState().query).query;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setHeading();

    // Literal query syntax shown as an example; intentionally verbatim.
    const placeholder = [
      "tag includes #work",
      "description includes write tests",
      "sort by due reverse",
    ].join("\n");

    const querySetting = new Setting(containerEl)
      .setName("Board query")
      .setClass("tasks-kanban-setting-query")
      .setDesc(
        "Edit the query that filters and sorts tasks on the kanban board. One instruction per line.",
      )
      .addTextArea((textArea) => {
        this.textarea = textArea;
        textArea.inputEl.rows = 10;
        textArea.inputEl.spellcheck = false;
        textArea.inputEl.placeholder = placeholder;
        textArea.setValue(this.plugin.getBoardState().query);
        textArea.onChange(() => this.validate());
      });

    querySetting.descEl.createEl("br");
    querySetting.descEl.createEl("a", {
      text: "See the documentation.",
      href: DOCS_URL,
    });

    this.errorEl = containerEl.createDiv({
      cls: "tasks-kanban-settings-errors",
    });

    new Setting(containerEl).addButton((button) => {
      button
        .setButtonText("Save")
        .setCta()
        .onClick(() => {
          void this.save();
        });
    });

    this.validate();
  }

  /**
   * Re-parse the textarea and render any errors.
   */
  private validate(): void {
    const { query, errors } = parseQuery(this.textarea.getValue());
    this.parsed = query;

    this.errorEl.empty();
    if (errors.length === 0) {
      return;
    }
    for (const error of errors) {
      this.errorEl.createDiv({
        cls: "tasks-kanban-settings-error",
        text: error,
      });
    }
  }

  private async save(): Promise<void> {
    if (this.errorEl.children.length > 0) {
      return; // Don't save if there are validation errors
    }

    await this.plugin.saveBoardStateFromSettings({
      ...this.plugin.getBoardState(),
      query: this.textarea.getValue(),
    });
  }
}
