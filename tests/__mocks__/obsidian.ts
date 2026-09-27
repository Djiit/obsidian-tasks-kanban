// Stub for the obsidian module during tests.
// The real module is provided by the Obsidian runtime.
export class Plugin {}
export class ItemView {}
export class WorkspaceLeaf {}
export class Notice {}
export class App {
  vault = {
    read: async () => "",
    write: async () => {},
    getAbstractFileByPath: () => null,
  };
  workspace = { getLeaf: () => ({ openFile: async () => {} }) };
  metadataCache = {};
}
export class Vault {}
export class Workspace {}
export class MetadataCache {}
export class TFile {}
export function setTooltip() {}

export class SettingTab {
  app: App;
  plugin: unknown;
  containerEl = document.createElement("div");
  settingItems: unknown[] = [];

  constructor(app: App, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
  }

  update() {}
  display() {}
}

export class PluginSettingTab extends SettingTab {}

/** Base for input-bearing component doubles: wraps a real DOM element. */
class ValueComponent<T extends HTMLElement> {
  inputEl: T;
  onChangeCb?: (value: string) => void;

  constructor(el: T) {
    this.inputEl = el;
  }

  setValue(value: string): this {
    this.inputEl.setAttribute("value", value);
    return this;
  }

  setPlaceholder(placeholder: string): this {
    this.inputEl.setAttribute("placeholder", placeholder);
    return this;
  }

  onChange(cb: (value: string) => void): this {
    this.onChangeCb = cb;
    return this;
  }

  simulate(value: string): void {
    this.onChangeCb?.(value);
  }
}

export class TextComponent extends ValueComponent<HTMLInputElement> {
  constructor() {
    super(document.createElement("input"));
  }
}

export class TextAreaComponent extends ValueComponent<HTMLTextAreaElement> {
  constructor() {
    super(document.createElement("textarea"));
  }
}

export class ToggleComponent {
  toggleEl = document.createElement("input");
  value = false;
  onChangeCb?: (value: boolean) => void;

  setValue(value: boolean): this {
    this.value = value;
    return this;
  }

  onChange(cb: (value: boolean) => void): this {
    this.onChangeCb = cb;
    return this;
  }

  simulate(value: boolean): void {
    this.value = value;
    this.onChangeCb?.(value);
  }
}

export class ButtonComponent {
  buttonEl = document.createElement("button");
  onClickCb?: (evt: MouseEvent) => void;

  setButtonText(text: string): this {
    this.buttonEl.textContent = text;
    return this;
  }

  setCta(): this {
    return this;
  }

  setDisabled(_disabled: boolean): this {
    return this;
  }

  onClick(cb: (evt: MouseEvent) => void): this {
    this.onClickCb = cb;
    return this;
  }

  click(): void {
    this.onClickCb?.({} as MouseEvent);
  }
}

export class ExtraButtonComponent extends ButtonComponent {
  setIcon(_icon: string): this {
    return this;
  }

  setTooltip(_tooltip: string): this {
    return this;
  }
}

export class Setting {
  containerEl: HTMLElement;
  settingEl = document.createElement("div");
  nameEl = document.createElement("div");
  descEl = document.createElement("div");
  controlEl = document.createElement("div");
  textComponents: TextComponent[] = [];
  textAreaComponents: TextAreaComponent[] = [];
  toggleComponents: ToggleComponent[] = [];
  buttonComponents: ButtonComponent[] = [];
  extraButtonComponents: ExtraButtonComponent[] = [];

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.settingEl.append(this.nameEl, this.descEl, this.controlEl);
    containerEl.appendChild(this.settingEl);
  }

  setName(name: string | DocumentFragment): this {
    this.nameEl.textContent =
      name instanceof DocumentFragment ? name.textContent : name;
    return this;
  }

  setDesc(desc: string | DocumentFragment): this {
    this.descEl.textContent =
      desc instanceof DocumentFragment ? desc.textContent : desc;
    return this;
  }

  setClass(cls: string): this {
    this.settingEl.classList.add(cls);
    return this;
  }

  setHeading(): this {
    return this;
  }

  addText(cb: (text: TextComponent) => unknown): this {
    const component = new TextComponent();
    this.textComponents.push(component);
    this.controlEl.appendChild(component.inputEl);
    cb(component);
    return this;
  }

  addTextArea(cb: (text: TextAreaComponent) => unknown): this {
    const component = new TextAreaComponent();
    this.textAreaComponents.push(component);
    this.controlEl.appendChild(component.inputEl);
    cb(component);
    return this;
  }

  addToggle(cb: (toggle: ToggleComponent) => unknown): this {
    const component = new ToggleComponent();
    this.toggleComponents.push(component);
    this.controlEl.appendChild(component.toggleEl);
    cb(component);
    return this;
  }

  addButton(cb: (button: ButtonComponent) => unknown): this {
    const component = new ButtonComponent();
    this.buttonComponents.push(component);
    this.controlEl.appendChild(component.buttonEl);
    cb(component);
    return this;
  }

  addExtraButton(cb: (button: ExtraButtonComponent) => unknown): this {
    const component = new ExtraButtonComponent();
    this.extraButtonComponents.push(component);
    this.controlEl.appendChild(component.buttonEl);
    cb(component);
    return this;
  }
}
