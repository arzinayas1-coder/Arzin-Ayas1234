import {
  GoogleGenAI,
  Type,
  type Content,
  type FunctionDeclaration,
  type Part,
  type Schema,
} from '@google/genai';
import type { CoarenaModelDTO, ProviderId, ProviderModelDTO } from '../shared/types.ts';

export interface UnifiedToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: UnifiedToolParameter;
  properties?: Record<string, UnifiedToolParameter>;
  required?: string[];
}

export interface UnifiedToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, UnifiedToolParameter>;
    required?: string[];
  };
}

export interface UnifiedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type UnifiedMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls?: UnifiedToolCall[]; rawGeminiContent?: Content }
  | { role: 'tool_results'; results: Array<{ id: string; name: string; response: unknown }> };

export interface ProviderCallOptions {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxOutputTokens: number;
  systemInstruction: string;
  messages: UnifiedMessage[];
  tools: UnifiedToolDefinition[];
  signal?: AbortSignal;
}

export interface ProviderStepResult {
  text: string;
  toolCalls: UnifiedToolCall[];
  rawGeminiContent?: Content;
  externalRequestId?: string;
}

function getGeminiClient(overrideKey?: string): GoogleGenAI {
  const apiKey = overrideKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server vault or environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function toGeminiType(t: UnifiedToolParameter['type']): Type {
  switch (t) {
    case 'string':
      return Type.STRING;
    case 'number':
      return Type.NUMBER;
    case 'boolean':
      return Type.BOOLEAN;
    case 'array':
      return Type.ARRAY;
    case 'object':
      return Type.OBJECT;
  }
}

function toGeminiSchema(param: UnifiedToolParameter): Schema {
  const schema: Schema = {
    type: toGeminiType(param.type),
    description: param.description,
  };
  if (param.enum) schema.enum = param.enum;
  if (param.items) schema.items = toGeminiSchema(param.items);
  if (param.properties) {
    const props: Record<string, Schema> = {};
    for (const [k, v] of Object.entries(param.properties)) {
      props[k] = toGeminiSchema(v);
    }
    schema.properties = props;
  }
  if (param.required) schema.required = param.required;
  return schema;
}

function toGeminiFunctionDeclarations(tools: UnifiedToolDefinition[]): FunctionDeclaration[] {
  return tools.map((t) => {
    const props: Record<string, Schema> = {};
    for (const [k, v] of Object.entries(t.parameters.properties)) {
      props[k] = toGeminiSchema(v);
    }
    return {
      name: t.name,
      description: t.description,
      parameters: {
        type: Type.OBJECT,
        properties: props,
        required: t.parameters.required,
      },
    };
  });
}

async function callGeminiStep(opts: ProviderCallOptions): Promise<ProviderStepResult> {
  const ai = getGeminiClient(opts.apiKey);
  const contents: Content[] = [];

  for (const msg of opts.messages) {
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.text }] });
    } else if (msg.role === 'assistant') {
      if (msg.rawGeminiContent) {
        contents.push(msg.rawGeminiContent);
      } else {
        const parts: Part[] = [];
        if (msg.text) parts.push({ text: msg.text });
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            parts.push({ functionCall: { id: tc.id, name: tc.name, args: tc.args } });
          }
        }
        contents.push({ role: 'model', parts });
      }
    } else if (msg.role === 'tool_results') {
      contents.push({
        role: 'user',
        parts: msg.results.map((r) => ({
          functionResponse: {
            id: r.id,
            name: r.name,
            response: { output: r.response },
          },
        })),
      });
    }
  }

  const response = await ai.models.generateContent({
    model: opts.model || 'gemini-3.1-flash-lite',
    contents,
    config: {
      systemInstruction: opts.systemInstruction,
      tools: [{ functionDeclarations: toGeminiFunctionDeclarations(opts.tools) }],
    },
  });

  const candidateContent = response.candidates?.[0]?.content;
  const toolCalls: UnifiedToolCall[] = (response.functionCalls ?? []).map((fc, idx) => ({
    id: fc.id || `call_${Date.now()}_${idx}`,
    name: fc.name || '',
    args: (fc.args as Record<string, unknown>) || {},
  }));

  return {
    text: response.text ?? '',
    toolCalls,
    rawGeminiContent: candidateContent,
  };
}

async function callOpenAICompatibleStep(opts: ProviderCallOptions): Promise<ProviderStepResult> {
  if (!opts.apiKey && opts.provider !== 'custom') {
    throw new Error(`No API key configured in server vault for provider "${opts.provider}".`);
  }

  const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const oaiMessages: Array<Record<string, unknown>> = [
    { role: 'system', content: opts.systemInstruction },
  ];

  for (const msg of opts.messages) {
    if (msg.role === 'user') {
      oaiMessages.push({ role: 'user', content: msg.text });
    } else if (msg.role === 'assistant') {
      const assistantMsg: Record<string, unknown> = {
        role: 'assistant',
        content: msg.text || null,
      };
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          },
        }));
      }
      oaiMessages.push(assistantMsg);
    } else if (msg.role === 'tool_results') {
      for (const r of msg.results) {
        oaiMessages.push({
          role: 'tool',
          tool_call_id: r.id,
          content: typeof r.response === 'string' ? r.response : JSON.stringify(r.response),
        });
      }
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.apiKey) {
    headers.Authorization = `Bearer ${opts.apiKey}`;
  }
  if (opts.provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3000';
    headers['X-Title'] = 'FORGE AI';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model,
      messages: oaiMessages,
      temperature: opts.temperature,
      max_tokens: opts.maxOutputTokens,
      tools: opts.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Provider ${opts.provider} HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    id?: string;
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  const externalRequestId = json.id || res.headers.get('x-coarena-request-id') || undefined;
  const choiceMsg = json.choices?.[0]?.message;
  const toolCalls: UnifiedToolCall[] = (choiceMsg?.tool_calls ?? []).map((tc) => {
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(tc.function.arguments || '{}');
    } catch {
      parsedArgs = {};
    }
    return {
      id: tc.id,
      name: tc.function.name,
      args: parsedArgs,
    };
  });

  return {
    text: choiceMsg?.content || '',
    toolCalls,
    externalRequestId,
  };
}

async function callAnthropicStep(opts: ProviderCallOptions): Promise<ProviderStepResult> {
  if (!opts.apiKey) {
    throw new Error(`No API key configured in server vault for "${opts.provider}".`);
  }

  const normalizedBase = opts.baseUrl.replace(/\/+$/, '');
  const url = normalizedBase.endsWith('/v1')
    ? `${normalizedBase}/messages`
    : `${normalizedBase}/v1/messages`;
  const anthropicMessages: Array<Record<string, unknown>> = [];

  for (const msg of opts.messages) {
    if (msg.role === 'user') {
      anthropicMessages.push({ role: 'user', content: msg.text });
    } else if (msg.role === 'assistant') {
      const blocks: Array<Record<string, unknown>> = [];
      if (msg.text) blocks.push({ type: 'text', text: msg.text });
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.args,
          });
        }
      }
      anthropicMessages.push({ role: 'assistant', content: blocks });
    } else if (msg.role === 'tool_results') {
      anthropicMessages.push({
        role: 'user',
        content: msg.results.map((r) => ({
          type: 'tool_result',
          tool_use_id: r.id,
          content: typeof r.response === 'string' ? r.response : JSON.stringify(r.response),
        })),
      });
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': opts.apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (opts.provider === 'coarena') {
    headers.Authorization = `Bearer ${opts.apiKey}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model,
      system: opts.systemInstruction,
      messages: anthropicMessages,
      max_tokens: opts.maxOutputTokens,
      temperature: opts.temperature,
      tools: opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    id?: string;
    content?: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    >;
  };

  let text = '';
  const toolCalls: UnifiedToolCall[] = [];
  for (const block of json.content ?? []) {
    if (block.type === 'text') {
      text += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({ id: block.id, name: block.name, args: block.input || {} });
    }
  }

  const externalRequestId = json.id || res.headers.get('x-coarena-request-id') || undefined;
  return { text, toolCalls, externalRequestId };
}

export async function runProviderStep(opts: ProviderCallOptions): Promise<ProviderStepResult> {
  if (opts.provider === 'gemini') {
    return callGeminiStep(opts);
  }
  if (opts.provider === 'anthropic') {
    return callAnthropicStep(opts);
  }
  if (
    opts.provider === 'coarena' &&
    opts.baseUrl.replace(/\/+$/, '').endsWith('/api')
  ) {
    return callAnthropicStep(opts);
  }
  return callOpenAICompatibleStep(opts);
}

export async function fetchCoarenaModels(apiKey?: string): Promise<CoarenaModelDTO[]> {
  const headers: Record<string, string> = {};
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  const res = await fetch('https://coarena.ai/api/v1/models', {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Coarena models HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      display_name?: string;
      context_length?: number;
      capabilities?: { tools?: boolean };
    }>;
  };
  return (json.data ?? []).map((m) => ({
    id: m.id,
    displayName: m.display_name || m.id,
    contextLength: m.context_length || 128000,
    supportsTools: m.capabilities?.tools ?? true,
    isFree: true,
  }));
}

export async function fetchProviderFreeModels(
  provider: ProviderId,
  apiKey?: string,
  fallbackModels: string[] = []
): Promise<ProviderModelDTO[]> {
  const toFallback = (list: string[]): ProviderModelDTO[] =>
    list.map((id) => ({
      id,
      displayName: id,
      contextLength: 128000,
      supportsTools: true,
      isFree: true,
    }));

  if (provider === 'coarena') {
    return fetchCoarenaModels(apiKey);
  }

  if (provider === 'openrouter') {
    const headers: Record<string, string> = {};
    if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return toFallback(fallbackModels);
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        name?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
        supported_parameters?: string[];
      }>;
    };
    const freeChatModels = (json.data ?? [])
      .filter((m) => {
        const isFreeTagged = m.id === 'openrouter/free' || m.id.endsWith(':free');
        const isZeroPrice =
          m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0;
        const isAudioOnly = m.id.includes('lyria');
        return (isFreeTagged || isZeroPrice) && !isAudioOnly;
      })
      .map((m) => ({
        id: m.id,
        displayName: m.name || m.id,
        contextLength: m.context_length || 128000,
        supportsTools: m.supported_parameters?.includes('tools') ?? true,
        isFree: true,
      }))
      .sort((a, b) => (a.id === 'openrouter/free' ? -1 : b.id === 'openrouter/free' ? 1 : 0));

    return freeChatModels.length > 0 ? freeChatModels : toFallback(fallbackModels);
  }

  if (provider === 'groq') {
    if (!apiKey?.trim()) return toFallback(fallbackModels);
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return toFallback(fallbackModels);
    const json = (await res.json()) as {
      data?: Array<{ id: string; context_window?: number; active?: boolean }>;
    };
    const models = (json.data ?? [])
      .filter(
        (m) =>
          m.active !== false &&
          !m.id.includes('whisper') &&
          !m.id.includes('orpheus') &&
          !m.id.includes('guard')
      )
      .map((m) => ({
        id: m.id,
        displayName: m.id,
        contextLength: m.context_window || 131072,
        supportsTools: true,
        isFree: true,
      }));
    return models.length > 0 ? models : toFallback(fallbackModels);
  }

  if (provider === 'nvidia') {
    if (!apiKey?.trim()) return toFallback(fallbackModels);
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return toFallback(fallbackModels);
    const json = (await res.json()) as { data?: Array<{ id: string }> };
    const excludeTerms = [
      'embed',
      'guard',
      'parse',
      'translate',
      'detector',
      'clip',
      'deplot',
      'fuyu',
      'kosmos',
      'neva',
      'vila',
      'reward',
      'safety',
      'topic-control',
      'calibration',
    ];
    const models = (json.data ?? [])
      .filter((m) => !excludeTerms.some((term) => m.id.toLowerCase().includes(term)))
      .map((m) => ({
        id: m.id,
        displayName: m.id,
        contextLength: 128000,
        supportsTools: true,
        isFree: true,
      }));
    return models.length > 0 ? models : toFallback(fallbackModels);
  }

  if (provider === 'gemini') {
    if (!apiKey?.trim()) return toFallback(fallbackModels);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return toFallback(fallbackModels);
    const json = (await res.json()) as {
      models?: Array<{
        name: string;
        displayName?: string;
        inputTokenLimit?: number;
        supportedGenerationMethods?: string[];
      }>;
    };
    const models = (json.models ?? [])
      .filter((m) => {
        const id = m.name.replace(/^models\//, '');
        const supportsGen = m.supportedGenerationMethods?.includes('generateContent') ?? false;
        const isFreeTierCandidate =
          (id.includes('flash') || id.startsWith('gemma-')) &&
          !id.includes('tts') &&
          !id.includes('image') &&
          !id.includes('2.5');
        return supportsGen && isFreeTierCandidate;
      })
      .map((m) => {
        const id = m.name.replace(/^models\//, '');
        return {
          id,
          displayName: m.displayName || id,
          contextLength: m.inputTokenLimit || 1000000,
          supportsTools: !id.startsWith('gemma-'),
          isFree: true,
        };
      });
    return models.length > 0 ? models : toFallback(fallbackModels);
  }

  return toFallback(fallbackModels);
}

export async function submitCoarenaFeedback(params: {
  apiKey: string;
  requestId: string;
  rating: 'good' | 'bad';
  note?: string;
}): Promise<{ request_id?: string; rating?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (params.apiKey.trim()) {
    headers.Authorization = `Bearer ${params.apiKey.trim()}`;
  }

  const body: Record<string, string> = {
    request_id: params.requestId,
    rating: params.rating === 'good' ? 'up' : 'down',
  };
  if (params.note?.trim()) {
    body.note = params.note.trim();
  }

  const res = await fetch('https://coarena.ai/api/v1/feedback', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Coarena feedback HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  return (await res.json()) as { request_id?: string; rating?: string };
}

export async function searchDocumentationWithGemini(
  query: string,
  overrideKey?: string
): Promise<{
  answer: string;
  sources: Array<{ title: string; uri: string }>;
}> {
  const ai = getGeminiClient(overrideKey);
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: `Provide concise, accurate technical documentation and code usage details for: ${query}`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources: Array<{ title: string; uri: string }> = [];
  for (const ch of chunks) {
    if (ch.web?.uri) {
      sources.push({ title: ch.web.title || ch.web.uri, uri: ch.web.uri });
    }
  }

  return {
    answer: response.text || 'No documentation results returned.',
    sources: sources.slice(0, 6),
  };
}
