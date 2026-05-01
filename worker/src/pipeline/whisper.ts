import { supabase } from '../lib/supabase'
import { transcribeAudio } from '../lib/openai'

export async function runWhisper(reportId: string): Promise<{ skipped?: boolean; data?: unknown }> {
  const { data: report } = await supabase
    .from('reports')
    .select('transcript')
    .eq('id', reportId)
    .single()

  // Text-only report — transcript already set or no audio to process
  if (report?.transcript) return { skipped: true }

  const { data: media } = await supabase
    .from('report_media')
    .select('storage_path')
    .eq('report_id', reportId)
    .eq('kind', 'audio')
    .limit(1)
    .maybeSingle()

  if (!media) return { skipped: true }

  const { data: fileData, error } = await supabase.storage
    .from('voice')
    .download(media.storage_path)

  if (error || !fileData) throw new Error(`Failed to download audio: ${error?.message}`)

  const filename = media.storage_path.split('/').pop() ?? 'audio.m4a'
  const transcript = await transcribeAudio(fileData, filename)

  await supabase
    .from('reports')
    .update({ transcript, status: 'queued' })
    .eq('id', reportId)

  return { data: { transcript_length: transcript.length } }
}
