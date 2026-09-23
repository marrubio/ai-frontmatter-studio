const path = require('path');
const vscode = require('vscode');

const CATEGORY_DEFINITIONS = [
  {
    key: 'agents',
    label: 'Agents',
    icon: 'hubot',
    patterns: ['.github/agents/**/*.agent.md', '.agents/**/*.agent.md', '.claude/agents/**/*.md', '.copilot/agents/**/*.md'],
    editable: true,
    openCommand: 'aiFrontmatterStudio.openAgent'
  },
  {
    key: 'skills',
    label: 'Skills',
    icon: 'library',
    patterns: ['.github/skills/**/SKILL.md', '.claude/skills/**/SKILL.md', '.copilot/skills/**/*.md'],
    editable: true,
    openCommand: 'aiFrontmatterStudio.openSkill'
  },
  {
    key: 'instructions',
    label: 'Instructions',
    icon: 'book',
    patterns: ['.github/instructions/**/*.instructions.md'],
    editable: false
  },
  {
    key: 'prompts',
    label: 'Prompts',
    icon: 'comment-discussion',
    patterns: ['.github/prompts/**/*.prompt.md', '.copilot/prompts/**/*.md'],
    editable: true,
    openCommand: 'aiFrontmatterStudio.openPrompt'
  },
  {
    key: 'mcp',
    label: 'MCP Servers',
    icon: 'plug',
    patterns: ['.vscode/mcp.json'],
    editable: false
  },
  {
    key: 'plugins',
    label: 'Plugins',
    icon: 'extensions',
    patterns: ['**/plugin.json'],
    editable: false
  }
];

class AssetNode extends vscode.TreeItem {
  constructor(options) {
    super(options.label, options.collapsibleState ?? vscode.TreeItemCollapsibleState.None);
    this.nodeType = options.nodeType;
    this.categoryKey = options.categoryKey;
    this.resourceUri = options.resourceUri;
    this.contextValue = options.contextValue;
    this.iconPath = options.iconPath;
    this.description = options.description;
    this.command = options.command;
    this.tooltip = options.tooltip;
  }
}

class CopilotAssetsProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!vscode.workspace.workspaceFolders?.length) {
      if (element) {
        return [];
      }

      return [new AssetNode({
        label: 'Open a workspace folder to discover Copilot assets',
        nodeType: 'empty',
        contextValue: 'empty',
        iconPath: new vscode.ThemeIcon('info')
      })];
    }

    if (!element) {
      return Promise.all(CATEGORY_DEFINITIONS.map(async (category) => {
        const items = await discoverFiles(category.patterns);
        return new AssetNode({
          label: category.label,
          description: `${items.length}`,
          nodeType: 'category',
          categoryKey: category.key,
          contextValue: 'category',
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          iconPath: new vscode.ThemeIcon(category.icon),
          tooltip: `${category.label}: ${items.length} files found`
        });
      }));
    }

    if (element.nodeType !== 'category') {
      return [];
    }

    const category = CATEGORY_DEFINITIONS.find((entry) => entry.key === element.categoryKey);
    if (!category) {
      return [];
    }

    const resources = await discoverFiles(category.patterns);
    if (!resources.length) {
      return [new AssetNode({
        label: 'No files found',
        nodeType: 'empty',
        categoryKey: category.key,
        contextValue: 'empty',
        iconPath: new vscode.ThemeIcon('circle-slash')
      })];
    }

    return resources.map((resource) => {
      const relativePath = vscode.workspace.asRelativePath(resource, false);
      return new AssetNode({
        label: path.basename(resource.fsPath),
        description: path.dirname(relativePath) === '.' ? '' : path.dirname(relativePath),
        nodeType: 'file',
        categoryKey: category.key,
        contextValue: category.editable ? `${category.key}File` : 'file',
        resourceUri: resource,
        iconPath: new vscode.ThemeIcon(category.editable ? 'file-code' : 'file'),
        tooltip: relativePath,
        command: category.editable
          ? { command: category.openCommand, title: `Open ${category.label.slice(0, -1)} Form`, arguments: [resource] }
          : { command: 'vscode.open', title: 'Open File', arguments: [resource] }
      });
    });
  }
}

async function discoverFiles(patterns) {
  const results = [];
  const seen = new Set();

  for (const pattern of patterns) {
    const matches = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
    for (const match of matches) {
      if (!seen.has(match.fsPath)) {
        seen.add(match.fsPath);
        results.push(match);
      }
    }
  }

  return results.sort((left, right) => left.fsPath.localeCompare(right.fsPath));
}

module.exports = {
  CATEGORY_DEFINITIONS,
  AssetNode,
  CopilotAssetsProvider,
  discoverFiles
};
