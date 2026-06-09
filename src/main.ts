import { Plugin, type WorkspaceLeaf, Notice } from 'obsidian';

import { TasksBoardView } from './views/TasksBoardView';
import { TasksIntegration } from './services/TasksIntegration';

const VIEW_TYPE = 'tasks-board';

export default class TasksKanbanPlugin extends Plugin {
    private tasksIntegration: TasksIntegration | null = null;

    async onload() {
        const tasksPlugin = this.app.plugins.getPlugin('obsidian-tasks-plugin');
        if (!tasksPlugin) {
            new Notice(
                'Tasks Kanban requires the Tasks plugin. Install it from Community Plugins.',
            );
            return;
        }

        this.tasksIntegration = new TasksIntegration(this.app);

        this.registerView(
            VIEW_TYPE,
            (leaf: WorkspaceLeaf) => new TasksBoardView(leaf, this.tasksIntegration!),
        );

        this.addCommand({
            id: 'open-tasks-kanban',
            name: 'Open Tasks Kanban Board',
            callback: () => this.activateView(),
        });
    }

    onunload() {
        if (this.tasksIntegration) {
            this.tasksIntegration.unload();
            this.tasksIntegration = null;
        }
    }

    async activateView() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        if (leaves.length > 0) {
            this.app.workspace.setActiveLeaf(leaves[0]);
            return;
        }

        await this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE,
            active: true,
        });

        this.app.workspace.revealLeaf(
            this.app.workspace.getLeavesOfType(VIEW_TYPE)[0],
        );
    }
}
