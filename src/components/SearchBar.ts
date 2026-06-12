import { setIcon } from "obsidian";

import type { SearchState } from "../utils/searchFilter";

/**
 * The top search bar: a free-text title input and a multi-select tag dropdown.
 *
 * Callback-driven — it owns no task data. On any change it reports the current
 * {@link SearchState} to the `onChange` callback; the board does the filtering.
 */
export class SearchBar {
  private container: HTMLElement;
  private onChange: (state: SearchState) => void;

  private root: HTMLElement;
  private titleInput: HTMLInputElement;
  private tagsButton: HTMLElement;
  private tagsButtonLabel: HTMLElement;
  private tagsMenu: HTMLElement;

  private availableTags: string[] = [];
  private selectedTags = new Set<string>();
  private titleQuery = "";

  private debounceTimer: number | null = null;
  private outsideClickHandler: (e: MouseEvent) => void;

  constructor(
    container: HTMLElement,
    onChange: (state: SearchState) => void,
    initialSelectedTags: string[] = [],
  ) {
    this.container = container;
    this.onChange = onChange;
    this.selectedTags = new Set(initialSelectedTags);

    this.root = this.container.createDiv({ cls: "tasks-kanban-search" });

    // Title text input
    this.titleInput = this.root.createEl("input", {
      cls: "tasks-kanban-search-input",
      attr: { type: "text", placeholder: "Filter by title…" },
    });
    this.titleInput.addEventListener("input", () => {
      this.titleQuery = this.titleInput.value;
      this.debouncedEmit();
    });

    // Tag multi-select: a button that toggles a checkbox popover.
    const tagsWrapper = this.root.createDiv({
      cls: "tasks-kanban-search-tags",
    });
    this.tagsButton = tagsWrapper.createDiv({
      cls: "tasks-kanban-search-tags-button",
    });
    this.tagsButtonLabel = this.tagsButton.createSpan({
      cls: "tasks-kanban-search-tags-button-label",
      text: "Tags",
    });
    const caret = this.tagsButton.createSpan({
      cls: "tasks-kanban-search-tags-caret",
    });
    setIcon(caret, "chevron-down");

    this.tagsMenu = tagsWrapper.createDiv({
      cls: "tasks-kanban-search-tags-menu",
    });
    this.tagsMenu.hide();

    this.tagsButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });
    // Keep clicks inside the menu from closing it via the document handler.
    this.tagsMenu.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    this.outsideClickHandler = () => this.closeMenu();
    activeDocument.addEventListener("click", this.outsideClickHandler);

    this.renderTagsMenu();
    this.updateTagsButtonLabel();
  }

  /**
   * Provide the available tag set (e.g. derived from the current tasks).
   * Rebuilds the checkbox list, preserving still-valid selections and dropping
   * any selection whose tag no longer exists.
   */
  setTags(tags: string[]): void {
    this.availableTags = tags;

    // Drop selections that disappeared from the vault.
    let changed = false;
    for (const tag of Array.from(this.selectedTags)) {
      if (!tags.includes(tag)) {
        this.selectedTags.delete(tag);
        changed = true;
      }
    }

    this.renderTagsMenu();
    this.updateTagsButtonLabel();

    if (changed) {
      this.emit();
    }
  }

  getState(): SearchState {
    return {
      titleQuery: this.titleQuery,
      selectedTags: Array.from(this.selectedTags),
    };
  }

  /**
   * Set the bar to the given state without emitting an `onChange`. Used when the
   * canonical query changes elsewhere (e.g. the query modal) and the bar must
   * reflect the new title and tag selection.
   *
   * Selected tags are kept even if not currently in `availableTags` (the query
   * may reference a tag that no task carries right now); they will show in the
   * menu once {@link setTags} surfaces them and otherwise still count as active.
   */
  setState(state: SearchState): void {
    this.titleQuery = state.titleQuery;
    this.titleInput.value = state.titleQuery;
    this.selectedTags = new Set(state.selectedTags);
    this.renderTagsMenu();
    this.updateTagsButtonLabel();
  }

  destroy(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    activeDocument.removeEventListener("click", this.outsideClickHandler);
    this.root.remove();
  }

  private toggleMenu(): void {
    if (this.tagsMenu.isShown()) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  private openMenu(): void {
    this.tagsMenu.show();
    this.tagsButton.addClass("tasks-kanban-search-tags-button-open");
  }

  private closeMenu(): void {
    this.tagsMenu.hide();
    this.tagsButton.removeClass("tasks-kanban-search-tags-button-open");
  }

  private renderTagsMenu(): void {
    this.tagsMenu.empty();

    if (this.availableTags.length === 0) {
      this.tagsMenu.createDiv({
        cls: "tasks-kanban-search-tags-empty",
        text: "No tags",
      });
      return;
    }

    // "Clear" affordance, only meaningful when something is selected.
    const clearRow = this.tagsMenu.createDiv({
      cls: "tasks-kanban-search-tags-clear",
      text: "Clear selection",
    });
    clearRow.addEventListener("click", () => {
      if (this.selectedTags.size === 0) {
        return;
      }
      this.selectedTags.clear();
      this.renderTagsMenu();
      this.updateTagsButtonLabel();
      this.emit();
    });

    for (const tag of this.availableTags) {
      const row = this.tagsMenu.createEl("label", {
        cls: "tasks-kanban-search-tags-option",
      });
      const checkbox = row.createEl("input", {
        attr: { type: "checkbox" },
      });
      checkbox.checked = this.selectedTags.has(tag);
      row.createSpan({ text: tag });

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.selectedTags.add(tag);
        } else {
          this.selectedTags.delete(tag);
        }
        this.updateTagsButtonLabel();
        this.emit();
      });
    }
  }

  private updateTagsButtonLabel(): void {
    const count = this.selectedTags.size;
    this.tagsButtonLabel.setText(count > 0 ? `Tags (${count})` : "Tags");
    if (count > 0) {
      this.tagsButton.addClass("tasks-kanban-search-tags-button-active");
    } else {
      this.tagsButton.removeClass("tasks-kanban-search-tags-button-active");
    }
  }

  private debouncedEmit(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.emit();
    }, 150);
  }

  private emit(): void {
    this.onChange(this.getState());
  }
}
