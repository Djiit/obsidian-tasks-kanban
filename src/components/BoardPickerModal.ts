import { App, FuzzySuggestModal } from "obsidian";

/** A single openable board: the base board or a saved query. */
export interface BoardChoice {
  id: string;
  name: string;
}

/**
 * A fuzzy picker listing the base board and every saved query. Selecting one
 * invokes `onChoose` with its id so the plugin can open (or focus) that board.
 */
export class BoardPickerModal extends FuzzySuggestModal<BoardChoice> {
  private readonly choices: BoardChoice[];
  private readonly onChoose: (id: string) => void;

  constructor(
    app: App,
    choices: BoardChoice[],
    onChoose: (id: string) => void,
  ) {
    super(app);
    this.choices = choices;
    this.onChoose = onChoose;
    this.setPlaceholder("Open a board view…");
  }

  getItems(): BoardChoice[] {
    return this.choices;
  }

  getItemText(item: BoardChoice): string {
    return item.name;
  }

  onChooseItem(item: BoardChoice): void {
    this.onChoose(item.id);
  }
}
