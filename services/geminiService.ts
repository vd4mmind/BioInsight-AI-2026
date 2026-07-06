import { PaperData, SwarmResult } from "../types";

const fetchStream = async function* (endpoint: string, topics: string[]): AsyncGenerator<SwarmResult, void, unknown> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topics })
  });

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    console.error("Received HTML instead of JSON stream. The server might be booting up.");
    yield { papers: [], error: 'network' };
    return;
  }

  if (!response.ok) {
    if (response.status === 429) {
       yield { papers: [], error: 'rate_limit' };
       return;
    } else if (response.status === 401 || response.status === 403) {
       yield { papers: [], error: 'auth' };
       return;
    }
    yield { papers: [], error: 'network' };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    let boundary = buffer.indexOf('\n');
    while (boundary !== -1) {
      const line = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 1);
      
      if (line) {
        try {
          const chunk = JSON.parse(line);
          // if chunk is { error: string } at the top level, that was for express failures, but now we yield { papers, error }
          if (chunk.error && !chunk.papers) {
             yield { papers: [], error: 'network' };
             return;
          }
          yield chunk as SwarmResult;
        } catch (e) {
          console.error("Failed to parse chunk:", line);
        }
      }
      boundary = buffer.indexOf('\n');
    }
  }
};

export async function* fetchLiteratureAnalysisStream(activeTopics: string[]): AsyncGenerator<SwarmResult, void, unknown> {
    yield* fetchStream("/api/live", activeTopics);
}

export async function* fetchAiAnalysisStream(activeTopics: string[]): AsyncGenerator<SwarmResult, void, unknown> {
    yield* fetchStream("/api/ai", activeTopics);
}

export async function* fetchPatentStream(activeTopics: string[]): AsyncGenerator<SwarmResult, void, unknown> {
    yield* fetchStream("/api/patents", activeTopics);
}

export const runLinkPolisher = async (paper: PaperData): Promise<string | null> => {
    try {
        const response = await fetch("/api/polish-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paper })
        });
        if (response.ok) {
            const data = await response.json();
            return data.result || null;
        }
        return null;
    } catch (e) {
        return null;
    }
};
