import { vi } from 'vitest';

// Mock Obsidian API
vi.mock('obsidian', () => ({
    Plugin: class {},
    ItemView: class {},
    WorkspaceLeaf: class {},
    Notice: class {},
    App: class {},
    Vault: class {},
    Workspace: class {},
    MetadataCache: class {},
    TFile: class {},
    setTooltip: vi.fn(),
}));

// Polyfill Obsidian-specific HTMLElement extensions used by components.
function polyfillElement(el: HTMLElement): void {
    if (!el.empty) {
        el.empty = function empty() {
            while (this.firstChild) this.removeChild(this.firstChild);
        };
    }
    if (!el.addClass) {
        el.addClass = function addClass(cls: string) {
            this.classList.add(cls);
        };
    }
    if (!el.removeClass) {
        el.removeClass = function removeClass(cls: string) {
            this.classList.remove(cls);
        };
    }
    if (!el.toggleClass) {
        el.toggleClass = function toggleClass(cls: string, force?: boolean) {
            this.classList.toggle(cls, force);
        };
    }
    if (!el.setText) {
        el.setText = function setText(text: string) {
            this.textContent = text;
        };
    }
    if (!el.createDiv) {
        el.createDiv = function createDiv(opts?: { cls?: string; text?: string }) {
            const div = document.createElement('div');
            if (opts?.cls) div.className = opts.cls;
            if (opts?.text) div.textContent = opts.text;
            this.appendChild(div);
            return div;
        } as HTMLElement['createDiv'];
    }
    if (!el.createSpan) {
        el.createSpan = function createSpan(opts?: { cls?: string; text?: string }) {
            const span = document.createElement('span');
            if (opts?.cls) span.className = opts.cls;
            if (opts?.text) span.textContent = opts.text;
            this.appendChild(span);
            return span;
        } as HTMLElement['createSpan'];
    }
}

// Apply polyfills to the prototype so every element gets them.
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
if (!proto.createDiv) {
    proto.createDiv = function createDiv(opts?: { cls?: string; text?: string }): HTMLDivElement {
        const div = document.createElement('div');
        if (opts?.cls) div.className = opts.cls;
        if (opts?.text) div.textContent = opts.text;
        this.appendChild(div);
        return div;
    } as (opts?: { cls?: string; text?: string }) => HTMLDivElement;
}
if (!proto.createSpan) {
    proto.createSpan = function createSpan(opts?: { cls?: string; text?: string }): HTMLSpanElement {
        const span = document.createElement('span');
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
