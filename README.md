# ai-frontmatter-studio

Editar visualmente el FrontMatter YAML de artefactos de IA.

## MVP actual

Esta base contiene una extensión mínima de Visual Studio Code que:

- descubre assets de Copilot/Agent Customizations en el workspace
- muestra un árbol lateral **Copilot Assets** con Agents, Skills, Instructions, Prompts, MCP Servers y Plugins
- permite crear y editar archivos `*.agent.md` mediante un formulario visual
- permite crear y editar archivos `SKILL.md` mediante un formulario visual
- permite crear y editar archivos `*.prompt.md` mediante un formulario visual
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

El campo `model` se edita mediante un selector. La lista predeterminada se puede
personalizar en la configuración de VS Code con `aiFrontmatterStudio.modelOptions`,
por ejemplo:

```json
{
  "aiFrontmatterStudio.modelOptions": [
    "GPT-5 (copilot)",
    "Claude Sonnet 4.5 (copilot)"
  ]
}
```

## Scripts

```bash
npm test
npm run lint
```

## Probar la extensión en Visual Studio Code

1. Instala las dependencias desde la terminal integrada:

  ```bash
  npm install
  ```

2. Pulsa `F5` o abre **Run and Debug** y selecciona **Run Extension**. VS Code abrirá una ventana **Extension Development Host** con la extensión cargada.

3. En la ventana de desarrollo, crea un archivo `.github/agents/test.agent.md` con este contenido:

  ```markdown
  ---
  name: Test Agent
  description: A test agent for AI Frontmatter Studio
  tools:
    - read
    - search
  ---

  You are a test agent.
  ```

4. Abre la vista **Copilot Assets** en la barra de actividad. El archivo debe aparecer dentro de **Agents**.

5. Haz clic en el agente para abrir el editor visual, modifica un campo y pulsa **Save**. Comprueba que el archivo Markdown se actualizó.

Para depurar la extensión, coloca puntos de interrupción en `src/extension.js` y recarga la ventana **Extension Development Host** con `Ctrl+R`.

La extensión no requiere un paso de compilación. `npm install` es necesario porque el parser utiliza el paquete `yaml`.

## Referencias

- GitHub Copilot custom agents: https://docs.github.com/en/copilot/reference/custom-agents-configuration
- VS Code custom agents: https://code.visualstudio.com/docs/agent-customization/custom-agents
- GitHub Copilot agent skills: https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
- VS Code prompt files: https://code.visualstudio.com/docs/agent-customization/prompt-files
