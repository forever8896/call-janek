import { supabase } from '../lib/supabase'
import { callClaude } from '../lib/claude'

interface UrgencyResult {
  score: number
  reason: string
}

const SYSTEM = `You are an urgency scorer for an investigative journalist's tip queue.
Score the tip from 1 (low priority) to 10 (urgent) based on:

- Financial harm: how much money is at stake or lost
- Safety risk: any physical danger to people
- Scale: one victim vs many potential victims
- Actionability: can the journalist act on this quickly
- Recency: active ongoing scam vs historical incident

Be calibrated: most tips should score 3–6. Reserve 8–10 for serious, active, large-scale fraud.
The input may be in Czech, Slovak, or English.`

export async function runUrgency(reportId: string): Promise<{ skipped?: boolean; data?: unknown }> {
  const { data: report } = await supabase
    .from('reports')
    .select('text_description, transcript, category')
    .eq('id', reportId)
    .single()

  const text = report?.text_description ?? report?.transcript ?? ''

  const result = await callClaude<UrgencyResult>({
    system: SYSTEM,
    prompt: `Category: ${report?.category ?? 'unknown'}\n\nTip:\n${text}`,
    tool: {
      name: 'score_urgency',
      description: 'Score the urgency of this tip',
      schema: {
        type: 'object',
        properties: {
          score:  { type: 'integer', minimum: 1, maximum: 10 },
          reason: { type: 'string', description: 'One sentence justification for the score' },
        },
        required: ['score', 'reason'],
      },
    },
  })

  await supabase
    .from('reports')
    .update({ urgency_score: result.score, urgency_reason: result.reason })
    .eq('id', reportId)

  return { data: result }
}
