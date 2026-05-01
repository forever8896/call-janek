import { supabase } from '../lib/supabase'
import { callClaude } from '../lib/claude'

interface SpamResult {
  is_spam: boolean
  confidence: number
  reason: string
}

const SYSTEM = `You are a content filter for a journalist tip-intake system.
Janek Rubes is an investigative journalist (Honest Guide, Prague) who investigates
scams: taxi fraud, fake currency exchanges, restaurant overcharging, and online crime.

Classify whether the submitted tip is SPAM or a LEGITIMATE report.
Legitimate reports describe a personal experience with a scam, suspicious business,
or fraudulent activity — even if vague or poorly written.
Spam includes: advertisements, nonsense, test messages, insults, unrelated content.

The input may be in Czech, Slovak, or English. Assess content, not language quality.`

export async function runSpam(reportId: string): Promise<{ skipped?: boolean; data?: unknown }> {
  const { data: report } = await supabase
    .from('reports')
    .select('text_description, transcript')
    .eq('id', reportId)
    .single()

  const text = report?.text_description ?? report?.transcript ?? ''

  const result = await callClaude<SpamResult>({
    system: SYSTEM,
    prompt: `Classify this tip:\n\n${text}`,
    tool: {
      name: 'classify_spam',
      description: 'Classify whether the tip is spam or legitimate',
      schema: {
        type: 'object',
        properties: {
          is_spam:    { type: 'boolean', description: 'true if spam, false if legitimate' },
          confidence: { type: 'number',  description: 'Confidence score 0.0–1.0' },
          reason:     { type: 'string',  description: 'One sentence explanation' },
        },
        required: ['is_spam', 'confidence', 'reason'],
      },
    },
  })

  if (result.is_spam) {
    // High confidence spam → hard drop
    // Low confidence → quarantine for Janek to decide
    const newStatus = result.confidence >= 0.85 ? 'spam' : 'quarantine'
    await supabase
      .from('reports')
      .update({ status: newStatus })
      .eq('id', reportId)
  }

  return { data: result }
}
