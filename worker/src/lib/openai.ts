import OpenAI from 'openai'
import { env } from './env'

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

export async function transcribeAudio(audioBlob: Blob, filename: string): Promise<string> {
  const file = new File([audioBlob], filename, { type: audioBlob.type || 'audio/mpeg' })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'cs',
    response_format: 'text',
  })

  return transcription as unknown as string
}

export async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  })

  const embedding = response.data[0]?.embedding
  if (!embedding) throw new Error('OpenAI embeddings returned empty result')

  return embedding
}
