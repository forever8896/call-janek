import Anthropic from '@anthropic-ai/sdk'
import { env } from './env'

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

// Haiku is used for all pipeline classification steps: fast, cheap, sufficient.
const MODEL = 'claude-haiku-4-5-20251001'

interface ToolSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

interface CallParams<T> {
  system: string
  prompt: string
  tool: {
    name: string
    description: string
    schema: ToolSchema
  }
  maxTokens?: number
}

// Forces Claude to return structured JSON via tool use — no regex parsing.
// System prompt is cached (ephemeral) because it's identical across pipeline steps
// for the same report batch, hitting Anthropic's 5-min prompt cache.
export async function callClaude<T>(params: CallParams<T>): Promise<T> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 1024,
    system: [
      {
        type: 'text',
        text: params.system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [
      {
        name: params.tool.name,
        description: params.tool.description,
        input_schema: params.tool.schema,
      },
    ],
    tool_choice: { type: 'tool', name: params.tool.name },
    messages: [{ role: 'user', content: params.prompt }],
  })

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!toolUse) throw new Error(`Claude did not return tool_use for step using tool ${params.tool.name}`)

  return toolUse.input as T
}
