import { App, type ButtonComponent, PluginSettingTab, Setting } from "obsidian";

import { parseQuery } from "../query/boardQuery";
import { createSavedBoard } from "../query/savedBoards";
import type { ColumnConfig, SavedBoard } from "../types/persistence";
import type { StatusInfo } from "../services/TasksIntegration";
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

/** A unique id generator for new custom columns. */
function newColumnId(): string {
  return crypto.randomUUID();
}

/**
 * Settings tab for the Tasks Kanban plugin.
 *
 * Edits the shared base query + columns plus a list of saved boards (each with
 * its own query and columns). All edits are kept in working copies and committed
 * together via Save; the Save button is disabled while any query has parse errors.
 */
export class TasksKanbanSettingsTab extends PluginSettingTab {
  private plugin: TasksKanbanPlugin;

  // Working copies, committed on Save.
  private baseQuery = "";
  private baseColumns: ColumnConfig[] = [];
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
    this.baseColumns = data.baseColumns.map((c) => ({
      ...c,
      symbols: [...c.symbols],
    }));
    this.savedBoards = data.savedBoards.map((b) => ({
      ...b,
      columns: (b.columns ?? []).map((c) => ({
        ...c,
        symbols: [...c.symbols],
      })),
    }));
    this.errors.clear();

    this.render();
  }

  /** (Re)build the whole settings pane from the working copies. */
  private render(): void {
    const { containerEl } = this;
    containerEl.empty();
    this.saveButton = null;

    new Setting(containerEl).setName("Base board").setHeading();

    containerEl.createEl("p", {
      cls: "tasks-kanban-settings-help",
      text: "The query is applied on top of every board; saved boards are merged with it. Columns apply to the default board.",
    });

    this.renderQueryField(containerEl, "base", this.baseQuery, (value) => {
      this.baseQuery = value;
    });
    this.renderColumnsSection(containerEl, this.baseColumns, (next) => {
      this.baseColumns = next;
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

  /** Render a saved board's name, query, columns, and delete button. */
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
    this.renderColumnsSection(containerEl, board.columns ?? [], (next) => {
      board.columns = next;
    });
  }

  /**
   * Render the custom-columns editor for one board's column slice.
   *
   * A toggle switches between default status columns (`columns` empty) and a
   * custom set. When custom, each column has a name, a status-symbol multi-select
   * (the first checked symbol is the drop target), and a delete button, plus an
   * "Add column" button. Structural edits (toggle/add/delete) re-render the pane;
   * `onChange` hands the updated array back so the caller's working copy stays in
   * sync (the base slice is a field, a board's is a property).
   */
  private renderColumnsSection(
    containerEl: HTMLElement,
    columns: ColumnConfig[],
    onChange: (columns: ColumnConfig[]) => void,
  ): void {
    const custom = columns.length > 0;

    new Setting(containerEl)
      .setName("Custom columns")
      .setDesc(
        "Off: one column per status type. On: define columns as status-symbol partitions.",
      )
      .addToggle((toggle) => {
        toggle.setValue(custom).onChange((value) => {
          // Turning on seeds one empty column; turning off clears the set.
          onChange(
            value ? [{ id: newColumnId(), title: "", symbols: [] }] : [],
          );
          this.render();
        });
      });

    if (!custom) {
      return;
    }

    const statuses = this.plugin.getStatuses();
    for (const column of columns) {
      this.renderColumnRow(containerEl, column, columns, onChange, statuses);
    }

    new Setting(containerEl).addButton((button) => {
      button.setButtonText("Add column").onClick(() => {
        onChange([...columns, { id: newColumnId(), title: "", symbols: [] }]);
        this.render();
      });
    });
  }

  /** Render one custom-column row: name, status checkboxes, delete. */
  private renderColumnRow(
    containerEl: HTMLElement,
    column: ColumnConfig,
    columns: ColumnConfig[],
    onChange: (columns: ColumnConfig[]) => void,
    statuses: StatusInfo[],
  ): void {
    const setting = new Setting(containerEl)
      .setClass("tasks-kanban-setting-column")
      .addText((text) => {
        text
          .setPlaceholder("Column name")
          .setValue(column.title)
          .onChange((value) => {
            column.title = value;
          });
      })
      .addExtraButton((button) => {
        button
          .setIcon("trash")
          .setTooltip("Delete column")
          .onClick(() => {
            onChange(columns.filter((c) => c.id !== column.id));
            this.render();
          });
      });

    // Status-symbol checkbox list. The first checked symbol (in status order) is
    // the drop target; we keep `symbols` ordered to match the status list so the
    // drop symbol is predictable.
    const list = setting.controlEl.createDiv({
      cls: "tasks-kanban-column-symbols",
    });
    for (const status of statuses) {
      const label = list.createEl("label", {
        cls: "tasks-kanban-column-symbol",
      });
      const checkbox = label.createEl("input", { type: "checkbox" });
      checkbox.checked = column.symbols.includes(status.symbol);
      checkbox.addEventListener("change", () => {
        const checkedSymbols = statuses
          .map((s) => s.symbol)
          .filter((symbol) =>
            symbol === status.symbol
              ? checkbox.checked
              : column.symbols.includes(symbol),
          );
        column.symbols = checkedSymbols;
        this.refreshColumnHint(setting.controlEl, column, statuses);
      });
      label.createSpan({
        cls: "tasks-kanban-column-symbol-text",
        text: `${describeSymbol(status.symbol)} ${status.name}`,
      });
    }

    const hint = setting.controlEl.createDiv({
      cls: "tasks-kanban-column-hint",
    });
    this.renderColumnHint(hint, column, statuses);
  }

  /** Re-render the drop-symbol hint for a column after a checkbox toggles. */
  private refreshColumnHint(
    controlEl: HTMLElement,
    column: ColumnConfig,
    statuses: StatusInfo[],
  ): void {
    const hint = controlEl.querySelector<HTMLElement>(
      ".tasks-kanban-column-hint",
    );
    if (hint) {
      this.renderColumnHint(hint, column, statuses);
    }
  }

  /** Show which symbol a drop writes (the first selected), or a prompt if none. */
  private renderColumnHint(
    hint: HTMLElement,
    column: ColumnConfig,
    statuses: StatusInfo[],
  ): void {
    hint.empty();
    if (column.symbols.length === 0) {
      hint.setText("Select at least one status.");
      return;
    }
    const drop = column.symbols[0];
    const name = statuses.find((s) => s.symbol === drop)?.name ?? drop;
    hint.setText(`Dropped cards become: ${describeSymbol(drop)} ${name}`);
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
    // Drop columns left without a name or any symbols — they can't render.
    const clean = (columns: ColumnConfig[] | undefined): ColumnConfig[] =>
      (columns ?? []).filter((c) => c.symbols.length > 0);

    await this.plugin.saveSettings(
      this.baseQuery,
      clean(this.baseColumns),
      this.savedBoards.map((b) => ({ ...b, columns: clean(b.columns) })),
    );
  }
}

/** Render a status symbol for display, making whitespace visible. */
function describeSymbol(symbol: string): string {
  if (symbol === " ") {
    return "[ ]";
  }
  return `[${symbol}]`;
}
