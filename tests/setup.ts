import { vi } from "vitest";

// Mock Obsidian API with the shared stub module.
vi.mock("obsidian", async () => await import("./__mocks__/obsidian"));

// Apply polyfills directly to the prototype so every element gets them.
const proto = HTMLElement.prototype as Record<string, unknown>;
if (!proto.empty) {
  proto.empty = function empty() {
    while (this.firstChild) this.removeChild(this.firstChild);
  } as () => void;
}
if (!proto.addClass) {
  proto.addClass = function addClass(cls: string) {
    this.classList.add(cls);
  } as (cls: string) => void;
}
if (!proto.removeClass) {
  proto.removeClass = function removeClass(cls: string) {
    this.classList.remove(cls);
  } as (cls: string) => void;
}
if (!proto.toggleClass) {
  proto.toggleClass = function toggleClass(cls: string, force?: boolean) {
    this.classList.toggle(cls, force);
  } as (cls: string, force?: boolean) => void;
}
if (!proto.setText) {
  proto.setText = function setText(text: string) {
    this.textContent = text;
  } as (text: string) => void;
}
if (!proto.createEl) {
  proto.createEl = function createEl(
    tag: string,
    opts?: { cls?: string; text?: string; href?: string; type?: string },
  ): HTMLElement {
    const el = document.createElement(tag);
    if (opts?.cls) el.className = opts.cls;
    if (opts?.text) el.textContent = opts.text;
    if (opts?.href) el.setAttribute("href", opts.href);
    if (opts?.type) el.setAttribute("type", opts.type);
    this.appendChild(el);
    return el;
  } as (
    tag: string,
    opts?: { cls?: string; text?: string; href?: string; type?: string },
  ) => HTMLElement;
}
if (!proto.createDiv) {
  proto.createDiv = function createDiv(opts?: {
    cls?: string;
    text?: string;
  }): HTMLDivElement {
    const div = document.createElement("div");
    if (opts?.cls) div.className = opts.cls;
    if (opts?.text) div.textContent = opts.text;
    this.appendChild(div);
    return div;
  } as (opts?: { cls?: string; text?: string }) => HTMLDivElement;
}
if (!proto.createSpan) {
  proto.createSpan = function createSpan(opts?: {
    cls?: string;
    text?: string;
  }): HTMLSpanElement {
    const span = document.createElement("span");
    if (opts?.cls) span.className = opts.cls;
    if (opts?.text) span.textContent = opts.text;
    this.appendChild(span);
    return span;
  } as (opts?: { cls?: string; text?: string }) => HTMLSpanElement;
}

// Global test setup
afterEach(() => {
  vi.clearAllMocks();
});
