import { setIcon } from "obsidian";

import type { SearchState } from "../utils/searchFilter";

/**
 * The top search bar: a free-text title input and a tag dropdown supporting
 * both include (⊕) and exclude (⊖) per tag.
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
  private includedTags = new Set<string>();
  private excludedTags = new Set<string>();
  private titleQuery = "";

  private debounceTimer: number | null = null;
  private outsideClickHandler: (e: MouseEvent) => void;

  constructor(
    container: HTMLElement,
    onChange: (state: SearchState) => void,
    initialSelectedTags: string[] = [],
    initialExcludedTags: string[] = [],
  ) {
    this.container = container;
    this.onChange = onChange;
    this.includedTags = new Set(initialSelectedTags);
    this.excludedTags = new Set(initialExcludedTags);

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
   * Rebuilds the tag list, preserving still-valid selections and dropping
   * any selection whose tag no longer exists.
   */
  setTags(tags: string[]): void {
    this.availableTags = tags;

    // Drop selections that disappeared from the vault.
    let changed = false;
    for (const tag of Array.from(this.includedTags)) {
      if (!tags.includes(tag)) {
        this.includedTags.delete(tag);
        changed = true;
      }
    }
    for (const tag of Array.from(this.excludedTags)) {
      if (!tags.includes(tag)) {
        this.excludedTags.delete(tag);
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
      selectedTags: Array.from(this.includedTags),
      excludedTags: Array.from(this.excludedTags),
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
    this.includedTags = new Set(state.selectedTags);
    this.excludedTags = new Set(state.excludedTags ?? []);
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

    const hasActive = this.includedTags.size > 0 || this.excludedTags.size > 0;

    // "Clear" affordance, only meaningful when something is active.
    const clearRow = this.tagsMenu.createDiv({
      cls: "tasks-kanban-search-tags-clear",
      text: "Clear selection",
    });
    if (!hasActive) {
      clearRow.addClass("tasks-kanban-search-tags-clear-disabled");
    }
    clearRow.addEventListener("click", () => {
      if (!hasActive) {
        return;
      }
      this.includedTags.clear();
      this.excludedTags.clear();
      this.renderTagsMenu();
      this.updateTagsButtonLabel();
      this.emit();
    });

    for (const tag of this.availableTags) {
      const row = this.tagsMenu.createDiv({
        cls: "tasks-kanban-search-tags-option",
      });

      const isIncluded = this.includedTags.has(tag);
      const isExcluded = this.excludedTags.has(tag);

      // Include button (⊕)
      const includeBtn = row.createEl("button", {
        cls: `tasks-kanban-search-tags-btn${isIncluded ? " tasks-kanban-search-tags-btn-include" : ""}`,
        attr: {
          type: "button",
          "aria-label": `Include tag ${tag}`,
          "aria-pressed": String(isIncluded),
        },
        text: "\u2295",
      });
      includeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isIncluded) {
          this.includedTags.delete(tag);
        } else {
          this.includedTags.add(tag);
          this.excludedTags.delete(tag);
        }
        this.renderTagsMenu();
        this.updateTagsButtonLabel();
        this.emit();
      });

      // Exclude button (⊖)
      const excludeBtn = row.createEl("button", {
        cls: `tasks-kanban-search-tags-btn${isExcluded ? " tasks-kanban-search-tags-btn-exclude" : ""}`,
        attr: {
          type: "button",
          "aria-label": `Exclude tag ${tag}`,
          "aria-pressed": String(isExcluded),
        },
        text: "\u2296",
      });
      excludeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isExcluded) {
          this.excludedTags.delete(tag);
        } else {
          this.excludedTags.add(tag);
          this.includedTags.delete(tag);
        }
        this.renderTagsMenu();
        this.updateTagsButtonLabel();
        this.emit();
      });

      row.createSpan({
        cls: `tasks-kanban-search-tags-label${isExcluded ? " tasks-kanban-search-tags-label-excluded" : ""}`,
        text: tag,
      });
    }
  }

  private updateTagsButtonLabel(): void {
    const inc = this.includedTags.size;
    const exc = this.excludedTags.size;
    const total = inc + exc;
    if (total > 0) {
      const parts: string[] = [];
      if (inc > 0) parts.push(`+${inc}`);
      if (exc > 0) parts.push(`-${exc}`);
      this.tagsButtonLabel.setText(`Tags (${parts.join(" ")})`);
      this.tagsButton.addClass("tasks-kanban-search-tags-button-active");
    } else {
      this.tagsButtonLabel.setText("Tags");
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
