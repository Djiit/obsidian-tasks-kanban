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
}));

// Global test setup
afterEach(() => {
    vi.clearAllMocks();
});
