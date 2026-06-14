import { setIcon } from "obsidian";

import {
  DEFAULT_GROUP_STATE,
  GROUP_FIELD_LABELS,
  type GroupField,
  type GroupState,
} from "../utils/groupTasks";
import type { SortDirection } from "../utils/sortTasks";

/**
 * The board group control: a field dropdown and an ascending/descending toggle
 * that splits the board into swimlanes. Mirrors {@link SortBar}.
 *
 * Callback-driven — it owns no task data. On any change it reports the current
 * {@link GroupState} to the `onChange` callback; the board does the grouping.
 */
export class GroupBar {
  private container: HTMLElement;
  private onChange: (state: GroupState) => void;

  private root: HTMLElement;
  private fieldSelect: HTMLSelectElement;
  private directionButton: HTMLButtonElement;

  private field: GroupField = DEFAULT_GROUP_STATE.field;
  private direction: SortDirection = DEFAULT_GROUP_STATE.direction;

  constructor(
    container: HTMLElement,
    onChange: (state: GroupState) => void,
    initial: GroupState = DEFAULT_GROUP_STATE,
  ) {
    this.container = container;
    this.onChange = onChange;
    this.field = initial.field;
    this.direction = initial.direction;

    this.root = this.container.createDiv({ cls: "tasks-kanban-group" });

    this.root.createSpan({
      cls: "tasks-kanban-group-label",
      text: "Group",
    });

    // Field dropdown — iteration order of GROUP_FIELD_LABELS is the UI order.
    this.fieldSelect = this.root.createEl("select", {
      cls: "tasks-kanban-group-select dropdown",
    });
    for (const [value, label] of Object.entries(GROUP_FIELD_LABELS)) {
      const option = this.fieldSelect.createEl("option", {
        text: label,
      });
      option.value = value;
    }
    this.fieldSelect.value = this.field;
    this.fieldSelect.addEventListener("change", () => {
      this.field = this.fieldSelect.value as GroupField;
      this.updateDirectionButton();
      this.emit();
    });

    // Direction toggle — only meaningful when a field is selected.
    this.directionButton = this.root.createEl("button", {
      cls: "tasks-kanban-group-direction",
      attr: { type: "button" },
    });
    this.directionButton.addEventListener("click", () => {
      this.direction = this.direction === "asc" ? "desc" : "asc";
      this.updateDirectionButton();
      this.emit();
    });

    this.updateDirectionButton();
  }

  getState(): GroupState {
    return { field: this.field, direction: this.direction };
  }

  /**
   * Set the control to the given state without emitting an `onChange`. Used when
   * the canonical query changes elsewhere (e.g. the query modal) and the bar must
   * reflect the new grouping.
   */
  setState(state: GroupState): void {
    this.field = state.field;
    this.direction = state.direction;
    this.fieldSelect.value = this.field;
    this.updateDirectionButton();
  }

  destroy(): void {
    this.root.remove();
  }

  /**
   * Sync the direction toggle's icon, tooltip, and enabled state with the
   * current field and direction. The toggle is disabled when no field is
   * selected, since direction has no effect without grouping.
   */
  private updateDirectionButton(): void {
    const enabled = this.field !== "none";
    this.directionButton.disabled = !enabled;
    this.directionButton.toggleClass(
      "tasks-kanban-group-direction-disabled",
      !enabled,
    );

    const ascending = this.direction === "asc";
    setIcon(
      this.directionButton,
      ascending ? "arrow-up-narrow-wide" : "arrow-down-wide-narrow",
    );
    this.directionButton.setAttribute(
      "aria-label",
      ascending ? "Ascending" : "Descending",
    );
  }

  private emit(): void {
    this.onChange(this.getState());
  }
}
