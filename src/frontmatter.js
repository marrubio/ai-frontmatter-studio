const YAML = require('yaml');

const BUILT_IN_TOOL_ALIASES = [
  'agent',
  'edit',
  'execute',
  'read',
  'search',
  'todo',
  'web'
];

const MODEL_OPTIONS = [
  'Claude Opus 4.5 (copilot)',
  'Claude Sonnet 4.5 (copilot)',
  'GPT-5 (copilot)',
  'GPT-5.2 (copilot)',
  'GPT-5.6 Luna (copilot)',
  'GPT-5.6 Terra (copilot)',
  'GPT-5.6 Sol (copilot)',
  'Kimi K2.7 Code (copilot)',
  'Kimi K3 (copilot)',
  'MAI-Code-1.1-Flash (copilot)',
  'Grok 4.5 (copilot)',
  'Grok 4.6 (copilot)',
  'Gemini 3.5 Flash (copilot)',
  'Gemini 3.6 Flash (copilot)',
  'Gemini 3.7 Flash (copilot)',
  'Gemini 3.8 Flash (copilot)',
  'Gemini 2.5 Pro (copilot)'
];

const KNOWN_KEYS = new Set([
  'name',
  'description',
  'argument-hint',
  'tools',
  'agents',
  'model',
  'user-invocable',
  'disable-model-invocation',
  'infer',
  'target',
  'mcp-servers',
  'handoffs',
  'hooks',
  'metadata'
]);

function splitFrontmatter(content) {
  const openingMarker = content.match(/^\uFEFF?---\r?\n/);
  if (!openingMarker) {
    return { frontmatterText: '', body: content, hasFrontmatter: false };
  }

  const endMarker = /\r?\n---(?:\r?\n|$)/g;
  endMarker.lastIndex = openingMarker[0].length;
  const endMatch = endMarker.exec(content);

  if (!endMatch) {
    return { frontmatterText: '', body: content, hasFrontmatter: false };
  }

  return {
    frontmatterText: content.slice(openingMarker[0].length, endMatch.index),
    body: content.slice(endMatch.index + endMatch[0].length),
    hasFrontmatter: true
  };
}

function normalizeList(value) {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined && item !== null && `${item}`.trim()).map((item) => `${item}`.trim());
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [`${value}`.trim()].filter(Boolean);
}

function normalizeKeyValuePairs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).map(([key, entryValue]) => ({
    key,
    value: entryValue === undefined || entryValue === null ? '' : `${entryValue}`
  }));
}

function parseYamlOrDefault(text, fallback) {
  if (!text || !text.trim()) {
    return fallback;
  }

  return YAML.parse(text);
}

function toYamlBlock(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.length ? YAML.stringify(value).trim() : '[]';
  }

  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return '';
  }

  return YAML.stringify(value).trim();
}

function createEmptyState(uriPath = '') {
  return {
    path: uriPath,
    body: '',
    hasFrontmatter: true,
    validationError: '',
    extraPropertiesYaml: '',
    fields: {
      description: { enabled: true, value: '' },
      name: { enabled: false, value: '' },
      'argument-hint': { enabled: false, value: '' },
      tools: { enabled: false, mode: 'selected', items: [] },
      agents: { enabled: false, mode: 'selected', items: [] },
      model: { enabled: false, items: [] },
      'user-invocable': { enabled: false, value: true },
      'disable-model-invocation': { enabled: false, value: false },
      infer: { enabled: false, value: true },
      target: { enabled: false, value: 'vscode' },
      'mcp-servers': { enabled: false, yamlText: '' },
      handoffs: { enabled: false, items: [] },
      hooks: { enabled: false, yamlText: '' },
      metadata: { enabled: false, items: [] }
    }
  };
}

function createEmptySkillState(uriPath = '') {
  return {
    path: uriPath,
    body: '',
    hasFrontmatter: true,
    validationError: '',
    extraPropertiesYaml: '',
    fields: {
      name: { enabled: false, value: '' },
      description: { enabled: true, value: '' }
    }
  };
}

function createEmptyPromptState(uriPath = '') {
  return {
    path: uriPath,
    body: '',
    hasFrontmatter: true,
    validationError: '',
    extraPropertiesYaml: '',
    fields: {
      name: { enabled: false, value: '' },
      description: { enabled: false, value: '' },
      'argument-hint': { enabled: false, value: '' },
      agent: { enabled: false, value: '' },
      model: { enabled: false, items: [] },
      tools: { enabled: false, items: [] }
    }
  };
}

function parseAgentDocument(content, uriPath = '') {
  const state = createEmptyState(uriPath);
  const { frontmatterText, body, hasFrontmatter } = splitFrontmatter(content);
  state.body = body;
  state.hasFrontmatter = hasFrontmatter;

  if (!hasFrontmatter) {
    return state;
  }

  let parsed = {};
  try {
    parsed = YAML.parse(frontmatterText) || {};
  } catch (error) {
    state.validationError = error instanceof Error ? error.message : 'Invalid YAML frontmatter';
    return state;
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    state.validationError = 'Frontmatter must be a YAML object.';
    return state;
  }

  const extras = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!KNOWN_KEYS.has(key)) {
      extras[key] = value;
    }
  }

  state.extraPropertiesYaml = toYamlBlock(extras);

  if (parsed.description !== undefined) {
    state.fields.description = { enabled: true, value: `${parsed.description ?? ''}` };
  }
  if (parsed.name !== undefined) {
    state.fields.name = { enabled: true, value: `${parsed.name ?? ''}` };
  }
  if (parsed['argument-hint'] !== undefined) {
    state.fields['argument-hint'] = { enabled: true, value: `${parsed['argument-hint'] ?? ''}` };
  }
  if (parsed.tools !== undefined) {
    const toolItems = normalizeList(parsed.tools);
    let mode = 'selected';
    if (toolItems.length === 1 && toolItems[0] === '*') {
      mode = 'all';
    } else if (Array.isArray(parsed.tools) && parsed.tools.length === 0) {
      mode = 'none';
    }
    state.fields.tools = { enabled: true, mode, items: mode === 'selected' ? toolItems : [] };
  }
  if (parsed.agents !== undefined) {
    const agents = normalizeList(parsed.agents);
    let mode = 'selected';
    if (agents.length === 1 && agents[0] === '*') {
      mode = 'all';
    } else if (Array.isArray(parsed.agents) && parsed.agents.length === 0) {
      mode = 'none';
    }
    state.fields.agents = { enabled: true, mode, items: mode === 'selected' ? agents : [] };
  }
  if (parsed.model !== undefined) {
    state.fields.model = { enabled: true, items: normalizeList(parsed.model) };
  }
  if (parsed['user-invocable'] !== undefined) {
    state.fields['user-invocable'] = { enabled: true, value: parsed['user-invocable'] };
  }
  if (parsed['disable-model-invocation'] !== undefined) {
    state.fields['disable-model-invocation'] = { enabled: true, value: parsed['disable-model-invocation'] };
  }
  if (parsed.infer !== undefined) {
    state.fields.infer = { enabled: true, value: parsed.infer };
  }
  if (parsed.target !== undefined) {
    state.fields.target = { enabled: true, value: `${parsed.target}` };
  }
  if (parsed['mcp-servers'] !== undefined) {
    state.fields['mcp-servers'] = { enabled: true, yamlText: toYamlBlock(parsed['mcp-servers']) };
  }
  if (parsed.handoffs !== undefined) {
    const handoffs = Array.isArray(parsed.handoffs) ? parsed.handoffs : [];
    state.fields.handoffs = {
      enabled: true,
      items: handoffs.map((handoff) => ({
        label: `${handoff?.label ?? ''}`,
        agent: `${handoff?.agent ?? ''}`,
        prompt: `${handoff?.prompt ?? ''}`,
        send: handoff?.send === undefined ? false : handoff.send,
        model: `${handoff?.model ?? ''}`
      }))
    };
  }
  if (parsed.hooks !== undefined) {
    state.fields.hooks = { enabled: true, yamlText: toYamlBlock(parsed.hooks) };
  }
  if (parsed.metadata !== undefined) {
    state.fields.metadata = { enabled: true, items: normalizeKeyValuePairs(parsed.metadata) };
  }

  return state;
}

function parseSkillDocument(content, uriPath = '') {
  const state = createEmptySkillState(uriPath);
  const { frontmatterText, body, hasFrontmatter } = splitFrontmatter(content);
  state.body = body;
  state.hasFrontmatter = hasFrontmatter;

  if (!hasFrontmatter) {
    return state;
  }

  let parsed = {};
  try {
    parsed = YAML.parse(frontmatterText) || {};
  } catch (error) {
    state.validationError = error instanceof Error ? error.message : 'Invalid YAML frontmatter';
    return state;
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    state.validationError = 'Frontmatter must be a YAML object.';
    return state;
  }

  const extras = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key !== 'name' && key !== 'description') {
      extras[key] = value;
    }
  }

  state.extraPropertiesYaml = toYamlBlock(extras);
  if (parsed.name !== undefined) {
    state.fields.name = { enabled: true, value: `${parsed.name ?? ''}` };
  }
  if (parsed.description !== undefined) {
    state.fields.description = { enabled: true, value: `${parsed.description ?? ''}` };
  }

  return state;
}

function parsePromptDocument(content, uriPath = '') {
  const state = createEmptyPromptState(uriPath);
  const { frontmatterText, body, hasFrontmatter } = splitFrontmatter(content);
  state.body = body;
  state.hasFrontmatter = hasFrontmatter;

  if (!hasFrontmatter) {
    return state;
  }

  let parsed = {};
  try {
    parsed = YAML.parse(frontmatterText) || {};
  } catch (error) {
    state.validationError = error instanceof Error ? error.message : 'Invalid YAML frontmatter';
    return state;
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    state.validationError = 'Frontmatter must be a YAML object.';
    return state;
  }

  const knownKeys = new Set(['name', 'description', 'argument-hint', 'agent', 'model', 'tools']);
  const extras = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!knownKeys.has(key)) {
      extras[key] = value;
    }
  }

  state.extraPropertiesYaml = toYamlBlock(extras);
  for (const key of ['name', 'description', 'argument-hint', 'agent']) {
    if (parsed[key] !== undefined) {
      state.fields[key] = { enabled: true, value: `${parsed[key] ?? ''}` };
    }
  }
  if (parsed.model !== undefined) {
    state.fields.model = { enabled: true, items: normalizeList(parsed.model) };
  }
  if (parsed.tools !== undefined) {
    state.fields.tools = { enabled: true, items: normalizeList(parsed.tools) };
  }

  return state;
}

function validateState(state) {
  const errors = [];

  if (!state.fields.description.value.trim()) {
    errors.push('Description is required.');
  }

  for (const key of ['user-invocable', 'disable-model-invocation', 'infer']) {
    if (state.fields[key].enabled && typeof state.fields[key].value !== 'boolean') {
      errors.push(`${key} must be a boolean.`);
    }
  }

  for (const handoff of state.fields.handoffs.items || []) {
    if (handoff && handoff.send !== undefined && typeof handoff.send !== 'boolean') {
      errors.push('handoffs.send must be a boolean.');
    }
  }

  if (state.fields.tools.enabled && state.fields.agents.enabled && state.fields.agents.mode !== 'none') {
    const selectedTools = state.fields.tools.mode === 'selected' ? state.fields.tools.items : state.fields.tools.mode === 'all' ? ['*'] : [];
    const agentsConfigured = state.fields.agents.mode === 'all' || state.fields.agents.items.length > 0;
    if (agentsConfigured && !(selectedTools.includes('*') || selectedTools.includes('agent'))) {
      errors.push('When agents are configured, tools must include the agent tool or allow all tools.');
    }
  }

  try {
    const mcpServers = parseYamlOrDefault(state.fields['mcp-servers'].yamlText, []);
    if (state.fields['mcp-servers'].enabled && !Array.isArray(mcpServers)) {
      errors.push('mcp-servers must be a YAML array.');
    }
  } catch (error) {
    errors.push(`Invalid mcp-servers YAML: ${error.message}`);
  }

  try {
    const hooks = parseYamlOrDefault(state.fields.hooks.yamlText, {});
    if (state.fields.hooks.enabled && (Array.isArray(hooks) || typeof hooks !== 'object' || hooks === null)) {
      errors.push('hooks must be a YAML object.');
    }
  } catch (error) {
    errors.push(`Invalid hooks YAML: ${error.message}`);
  }

  try {
    const extra = parseYamlOrDefault(state.extraPropertiesYaml, {});
    if (state.extraPropertiesYaml.trim() && (Array.isArray(extra) || typeof extra !== 'object' || extra === null)) {
      errors.push('Extra properties must be a YAML object.');
    }
  } catch (error) {
    errors.push(`Invalid extra properties YAML: ${error.message}`);
  }

  return errors;
}

function validateSkillState(state) {
  const errors = [];

  if (!state.fields.description.value.trim()) {
    errors.push('Description is required.');
  }

  try {
    const extra = parseYamlOrDefault(state.extraPropertiesYaml, {});
    if (state.extraPropertiesYaml.trim() && (Array.isArray(extra) || typeof extra !== 'object' || extra === null)) {
      errors.push('Extra properties must be a YAML object.');
    }
  } catch (error) {
    errors.push(`Invalid extra properties YAML: ${error.message}`);
  }

  return errors;
}

function validatePromptState(state) {
  const errors = [];

  try {
    const extra = parseYamlOrDefault(state.extraPropertiesYaml, {});
    if (state.extraPropertiesYaml.trim() && (Array.isArray(extra) || typeof extra !== 'object' || extra === null)) {
      errors.push('Extra properties must be a YAML object.');
    }
  } catch (error) {
    errors.push(`Invalid extra properties YAML: ${error.message}`);
  }

  return errors;
}

function buildFrontmatterObject(state) {
  const errors = validateState(state);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }

  const frontmatter = {};
  frontmatter.description = state.fields.description.value.trim();

  if (state.fields.name.enabled && state.fields.name.value.trim()) {
    frontmatter.name = state.fields.name.value.trim();
  }
  if (state.fields['argument-hint'].enabled && state.fields['argument-hint'].value.trim()) {
    frontmatter['argument-hint'] = state.fields['argument-hint'].value.trim();
  }
  if (state.fields.tools.enabled) {
    if (state.fields.tools.mode === 'all') {
      frontmatter.tools = ['*'];
    } else if (state.fields.tools.mode === 'none') {
      frontmatter.tools = [];
    } else {
      const tools = normalizeList(state.fields.tools.items);
      if (tools.length > 0) {
        frontmatter.tools = tools;
      }
    }
  }
  if (state.fields.agents.enabled) {
    if (state.fields.agents.mode === 'all') {
      frontmatter.agents = ['*'];
    } else if (state.fields.agents.mode === 'none') {
      frontmatter.agents = [];
    } else {
      const agents = normalizeList(state.fields.agents.items);
      if (agents.length > 0) {
        frontmatter.agents = agents;
      }
    }
  }
  if (state.fields.model.enabled) {
    const models = normalizeList(state.fields.model.items);
    if (models.length === 1) {
      frontmatter.model = models[0];
    } else if (models.length > 1) {
      frontmatter.model = models;
    }
  }
  if (state.fields['user-invocable'].enabled) {
    frontmatter['user-invocable'] = state.fields['user-invocable'].value;
  }
  if (state.fields['disable-model-invocation'].enabled) {
    frontmatter['disable-model-invocation'] = state.fields['disable-model-invocation'].value;
  }
  if (state.fields.infer.enabled) {
    frontmatter.infer = state.fields.infer.value;
  }
  if (state.fields.target.enabled && state.fields.target.value) {
    frontmatter.target = state.fields.target.value;
  }
  if (state.fields['mcp-servers'].enabled && state.fields['mcp-servers'].yamlText.trim()) {
    frontmatter['mcp-servers'] = parseYamlOrDefault(state.fields['mcp-servers'].yamlText, []);
  }
  if (state.fields.handoffs.enabled) {
    frontmatter.handoffs = (state.fields.handoffs.items || [])
      .filter((item) => item && (item.label || item.agent || item.prompt || item.model || item.send))
      .map((item) => {
        const handoff = {};
        if (`${item.label || ''}`.trim()) {
          handoff.label = `${item.label}`.trim();
        }
        if (`${item.agent || ''}`.trim()) {
          handoff.agent = `${item.agent}`.trim();
        }
        if (`${item.prompt || ''}`.trim()) {
          handoff.prompt = `${item.prompt}`.trim();
        }
        if (typeof item.send === 'boolean') {
          handoff.send = item.send;
        }
        if (`${item.model || ''}`.trim()) {
          handoff.model = `${item.model}`.trim();
        }
        return handoff;
      });
  }
  if (state.fields.hooks.enabled && state.fields.hooks.yamlText.trim()) {
    frontmatter.hooks = parseYamlOrDefault(state.fields.hooks.yamlText, {});
  }
  if (state.fields.metadata.enabled) {
    const metadata = {};
    for (const entry of state.fields.metadata.items || []) {
      if (entry && `${entry.key || ''}`.trim()) {
        metadata[`${entry.key}`.trim()] = `${entry.value || ''}`;
      }
    }
    if (Object.keys(metadata).length > 0) {
      frontmatter.metadata = metadata;
    }
  }

  const extraProperties = parseYamlOrDefault(state.extraPropertiesYaml, {});
  if (extraProperties && typeof extraProperties === 'object' && !Array.isArray(extraProperties)) {
    Object.assign(frontmatter, extraProperties);
  }

  return frontmatter;
}

function serializeAgentDocument(state) {
  const frontmatter = buildFrontmatterObject(state);
  const yamlText = YAML.stringify(frontmatter, {
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_SINGLE'
  }).trim();
  const body = state.body || '';
  return `---\n${yamlText}\n---\n${body}`;
}

function buildSkillFrontmatterObject(state) {
  const errors = validateSkillState(state);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }

  const frontmatter = {
    description: state.fields.description.value.trim()
  };

  if (state.fields.name.enabled && state.fields.name.value.trim()) {
    frontmatter.name = state.fields.name.value.trim();
  }

  const extraProperties = parseYamlOrDefault(state.extraPropertiesYaml, {});
  if (extraProperties && typeof extraProperties === 'object' && !Array.isArray(extraProperties)) {
    Object.assign(frontmatter, extraProperties);
  }

  return frontmatter;
}

function serializeSkillDocument(state) {
  const frontmatter = buildSkillFrontmatterObject(state);
  const yamlText = YAML.stringify(frontmatter, {
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_SINGLE'
  }).trim();
  const body = state.body || '';
  return `---\n${yamlText}\n---\n${body}`;
}

function buildPromptFrontmatterObject(state) {
  const errors = validatePromptState(state);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }

  const frontmatter = {};
  for (const key of ['name', 'description', 'argument-hint', 'agent']) {
    if (state.fields[key].enabled && state.fields[key].value.trim()) {
      frontmatter[key] = state.fields[key].value.trim();
    }
  }

  if (state.fields.model.enabled) {
    const models = normalizeList(state.fields.model.items);
    if (models.length === 1) {
      frontmatter.model = models[0];
    } else if (models.length > 1) {
      frontmatter.model = models;
    }
  }
  if (state.fields.tools.enabled) {
    const tools = normalizeList(state.fields.tools.items);
    if (tools.length > 0) {
      frontmatter.tools = tools;
    }
  }

  const extraProperties = parseYamlOrDefault(state.extraPropertiesYaml, {});
  if (extraProperties && typeof extraProperties === 'object' && !Array.isArray(extraProperties)) {
    Object.assign(frontmatter, extraProperties);
  }

  return frontmatter;
}

function serializePromptDocument(state) {
  const frontmatter = buildPromptFrontmatterObject(state);
  const yamlText = YAML.stringify(frontmatter, {
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_SINGLE'
  }).trim();
  const body = state.body || '';
  return `---\n${yamlText}\n---\n${body}`;
}

module.exports = {
  BUILT_IN_TOOL_ALIASES,
  MODEL_OPTIONS,
  KNOWN_KEYS,
  createEmptyState,
  createEmptySkillState,
  createEmptyPromptState,
  parseAgentDocument,
  parseSkillDocument,
  parsePromptDocument,
  serializeAgentDocument,
  serializeSkillDocument,
  serializePromptDocument,
  buildFrontmatterObject,
  buildSkillFrontmatterObject,
  buildPromptFrontmatterObject,
  validateState,
  validateSkillState,
  validatePromptState
};
