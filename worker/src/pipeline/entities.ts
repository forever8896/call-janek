import { supabase } from '../lib/supabase'
import { callClaude } from '../lib/claude'
import type { Entity } from '../types/shared'

interface EntitiesResult {
  entities: Entity[]
}

const SYSTEM = `You are an entity extractor for an investigative journalist's tip system.
Extract named entities that could help identify where a scam occurred or who runs it.

Entity types:
- place: named location (street, square, district, city area, landmark)
- business: named business, company, exchange office, taxi company, restaurant
- person: named individual (scammer, suspect) — only if clearly named, not generic descriptions

Prague context: Tips often reference Wenceslas Square (Václavské náměstí),
Old Town Square (Staroměstské náměstí), airport (Letiště Praha), etc.

Return empty array if no specific named entities are mentioned.
The input may be in Czech, Slovak, or English.`

export async function runEntities(reportId: string): Promise<{ skipped?: boolean; data?: unknown }> {
  const { data: report } = await supabase
    .from('reports')
    .select('text_description, transcript, location, business_name')
    .eq('id', reportId)
    .single()

  const text = [
    report?.text_description ?? report?.transcript ?? '',
    report?.location ? `Location mentioned: ${report.location}` : '',
    report?.business_name ? `Business mentioned: ${report.business_name}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const result = await callClaude<EntitiesResult>({
    system: SYSTEM,
    prompt: `Extract entities from this tip:\n\n${text}`,
    tool: {
      name: 'extract_entities',
      description: 'Extract named places, businesses, and persons from the tip',
      schema: {
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type:       { type: 'string', enum: ['place','business','person'] },
                name:       { type: 'string' },
                address:    { type: 'string', description: 'Street address if mentioned' },
                confidence: { type: 'number', description: '0.0–1.0' },
              },
              required: ['type','name','confidence'],
            },
          },
        },
        required: ['entities'],
      },
    },
  })

  await supabase
    .from('reports')
    .update({ entities: result.entities as never })
    .eq('id', reportId)

  return { data: result }
}
