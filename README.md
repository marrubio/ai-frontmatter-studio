# ai-frontmatter-studio

Editar visualmente el FrontMatter YAML de artefactos de IA.

## MVP actual

Esta base contiene una extensión mínima de Visual Studio Code que:

- descubre assets de Copilot/Agent Customizations en el workspace
- muestra un árbol lateral **Copilot Assets** con Agents, Skills, Instructions, Prompts, MCP Servers y Plugins
- permite crear y editar archivos `*.agent.md` mediante un formulario visual
- soporta las propiedades documentadas oficialmente para el frontmatter de agentes:
  - `name`
  - `description`
  - `argument-hint`
  - `tools`
  - `agents`
  - `model`
  - `user-invocable`
  - `disable-model-invocation`
  - `infer` (deprecated)
  - `target`
  - `mcp-servers`
  - `handoffs`
  - `hooks` (preview)
  - `metadata`
- conserva propiedades extra mediante un bloque avanzado de YAML

## Scripts

```bash
npm test
npm run lint
```

## Referencias

- GitHub Copilot custom agents: https://docs.github.com/en/copilot/reference/custom-agents-configuration
- VS Code custom agents: https://code.visualstudio.com/docs/agent-customization/custom-agents
