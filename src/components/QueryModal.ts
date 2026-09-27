import { App, Modal } from "obsidian";

import {
  parseQuery,
  serializeQuery,
  type BoardQuery,
} from "../query/boardQuery";

/**
 * A modal for editing the board's raw query string.
 *
 * Seeded with the current serialized {@link BoardQuery}, it parses on every edit
 * to show inline validation feedback, and reports the parsed query back through
 * `onSubmit` when saved. The query is the canonical source of truth, so editing
 * it here is equivalent to (and a superset of) using the search/sort bars.
 */
export class QueryModal extends Modal {
  private readonly initialText: string;
  private readonly onSubmit: (query: BoardQuery) => void;

  private textarea!: HTMLTextAreaElement;
  private errorEl!: HTMLElement;
  private warningEl!: HTMLElement;
  private parsed: BoardQuery;

  constructor(
    app: App,
    query: BoardQuery,
    onSubmit: (query: BoardQuery) => void,
  ) {
    super(app);
    this.initialText = serializeQuery(query);
    this.parsed = query;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("tasks-kanban-query-modal");

    contentEl.createEl("h3", { text: "Edit board query" });

    contentEl.createEl("p", {
      cls: "tasks-kanban-query-modal-help",
      text: "One instruction per line. Supported: tag/path/folder includes, tag/path/folder does not include, description includes, date filters (e.g., due before tomorrow), sort by, and group by.",
    });

    // Literal query syntax shown as an example; intentionally verbatim.
    const placeholder = [
      "tag includes #work",
      "description includes write tests",
      "sort by due reverse",
      "group by priority",
    ].join("\n");

    this.textarea = contentEl.createEl("textarea", {
      cls: "tasks-kanban-query-modal-input",
      attr: { rows: "10", spellcheck: "false", placeholder },
    });
    this.textarea.value = this.initialText;
    this.textarea.addEventListener("input", () => this.validate());

    this.errorEl = contentEl.createDiv({
      cls: "tasks-kanban-query-modal-errors",
    });

    this.warningEl = contentEl.createDiv({
      cls: "tasks-kanban-query-modal-warnings",
    });

    const buttons = contentEl.createDiv({
      cls: "tasks-kanban-query-modal-buttons",
    });
    const cancelButton = buttons.createEl("button", {
      text: "Cancel",
      attr: { type: "button" },
    });
    cancelButton.addEventListener("click", () => this.close());

    const saveButton = buttons.createEl("button", {
      cls: "mod-cta",
      text: "Save",
      attr: { type: "button" },
    });
    saveButton.addEventListener("click", () => {
      this.onSubmit(this.parsed);
      this.close();
    });

    this.validate();
    this.textarea.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /** Re-parse the textarea and render any errors or deprecation warnings. */
  private validate(): void {
    const { query, errors, warnings } = parseQuery(this.textarea.value);
    this.parsed = query;

    this.errorEl.empty();
    for (const error of errors) {
      this.errorEl.createDiv({
        cls: "tasks-kanban-query-modal-error",
        text: error,
      });
    }

    this.warningEl.empty();
    for (const warning of warnings) {
      this.warningEl.createDiv({
        cls: "tasks-kanban-query-modal-warning",
        text: warning,
      });
    }
  }
}
