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
