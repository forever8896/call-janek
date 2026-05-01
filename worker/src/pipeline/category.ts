import { supabase } from '../lib/supabase'
import { callClaude } from '../lib/claude'
import type { Category } from '../types/shared'

interface CategoryResult {
  category: Category
  confidence: number
  reasoning: string
}

const SYSTEM = `You are a categorization assistant for an investigative journalist's tip system.
Classify the submitted tip into exactly one category:

- taxi_scam: overcharging, fake meters, unauthorized drivers, route manipulation
- fake_exchange: fake currency exchange offices, bad rates, street money changers
- online_fraud: internet scams, phishing, fake e-shops, social media fraud, investment scams
- restaurant_scam: menu price manipulation, fake charges, tourist trap restaurants
- other: anything that doesn't fit the above but is a legitimate scam/fraud tip

The input may be in Czech, Slovak, or English.`

export async function runCategory(reportId: string): Promise<{ skipped?: boolean; data?: unknown }> {
  const { data: report } = await supabase
    .from('reports')
    .select('text_description, transcript')
    .eq('id', reportId)
    .single()

  const text = report?.text_description ?? report?.transcript ?? ''

  const result = await callClaude<CategoryResult>({
    system: SYSTEM,
    prompt: `Categorize this tip:\n\n${text}`,
    tool: {
      name: 'categorize_report',
      description: 'Classify the tip into a scam category',
      schema: {
        type: 'object',
        properties: {
          category:   { type: 'string', enum: ['taxi_scam','fake_exchange','online_fraud','restaurant_scam','other'] },
          confidence: { type: 'number', description: 'Confidence 0.0–1.0' },
          reasoning:  { type: 'string', description: 'One sentence explanation' },
        },
        required: ['category', 'confidence', 'reasoning'],
      },
    },
  })

  await supabase
    .from('reports')
    .update({ category: result.category })
    .eq('id', reportId)

  return { data: result }
}
