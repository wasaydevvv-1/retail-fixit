export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIRecommendationResponse {
  summary: string;
  candidates: Array<{
    vendorId: string;
    score: number;
    reason: string;
  }>;
}

export interface InferenceResult {
  content: string;
  latencyMs: number;
  model: string;
}
