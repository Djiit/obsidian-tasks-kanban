import { setIcon } from 'obsidian';

import {
    DEFAULT_SORT_STATE,
    SORT_FIELD_LABELS,
    type SortDirection,
    type SortField,
    type SortState,
} from '../utils/sortTasks';

/**
 * The board sort control: a field dropdown and an ascending/descending toggle.
 *
 * Callback-driven — it owns no task data. On any change it reports the current
 * {@link SortState} to the `onChange` callback; the board does the sorting.
 */
export class SortBar {
    private container: HTMLElement;
    private onChange: (state: SortState) => void;

    private root: HTMLElement;
    private fieldSelect: HTMLSelectElement;
    private directionButton: HTMLButtonElement;

    private field: SortField = DEFAULT_SORT_STATE.field;
    private direction: SortDirection = DEFAULT_SORT_STATE.direction;

    constructor(container: HTMLElement, onChange: (state: SortState) => void) {
        this.container = container;
        this.onChange = onChange;

        this.root = this.container.createDiv({ cls: 'tasks-kanban-sort' });

        this.root.createSpan({
            cls: 'tasks-kanban-sort-label',
            text: 'Sort',
        });

        // Field dropdown — iteration order of SORT_FIELD_LABELS is the UI order.
        this.fieldSelect = this.root.createEl('select', {
            cls: 'tasks-kanban-sort-select dropdown',
        });
        for (const [value, label] of Object.entries(SORT_FIELD_LABELS)) {
            const option = this.fieldSelect.createEl('option', {
                text: label,
            });
            option.value = value;
        }
        this.fieldSelect.value = this.field;
        this.fieldSelect.addEventListener('change', () => {
            this.field = this.fieldSelect.value as SortField;
            this.updateDirectionButton();
            this.emit();
        });

        // Direction toggle — only meaningful when a field is selected.
        this.directionButton = this.root.createEl('button', {
            cls: 'tasks-kanban-sort-direction',
            attr: { type: 'button' },
        });
        this.directionButton.addEventListener('click', () => {
            this.direction = this.direction === 'asc' ? 'desc' : 'asc';
            this.updateDirectionButton();
            this.emit();
        });

        this.updateDirectionButton();
    }

    getState(): SortState {
        return { field: this.field, direction: this.direction };
    }

    destroy(): void {
        this.root.remove();
    }

    /**
     * Sync the direction toggle's icon, tooltip, and enabled state with the
     * current field and direction. The toggle is disabled when no field is
     * selected, since direction has no effect on the unsorted order.
     */
    private updateDirectionButton(): void {
        const enabled = this.field !== 'none';
        this.directionButton.disabled = !enabled;
        this.directionButton.toggleClass(
            'tasks-kanban-sort-direction-disabled',
            !enabled,
        );

        const ascending = this.direction === 'asc';
        setIcon(
            this.directionButton,
            ascending ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow',
        );
        this.directionButton.setAttribute(
            'aria-label',
            ascending ? 'Ascending' : 'Descending',
        );
    }

    private emit(): void {
        this.onChange(this.getState());
    }
}
