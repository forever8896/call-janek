import { env } from './env'

interface TavilyResult {
  url: string
  title: string
  content: string
  score: number
}

interface TavilyResponse {
  results: TavilyResult[]
}

export interface SearchResult {
  url: string
  title: string
  snippet: string
}

export async function searchWeb(query: string, maxResults = 3): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      include_raw_content: false,
      include_answer: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as TavilyResponse

  return data.results.map((r) => ({
    url: r.url,
    title: r.title,
    snippet: r.content.slice(0, 500),
  }))
}
