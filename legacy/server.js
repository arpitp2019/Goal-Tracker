const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT || 3000);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8'
};

const BOOK_MODELS = [
  {
    name: 'Eisenhower Matrix',
    keywords: ['urgent', 'important', 'deadline', 'prioritize', 'prioritise', 'today', 'this week', 'focus'],
    why: 'Separates urgent work from important work so you do not confuse motion with progress.',
    how: 'Sort the decision into do now, schedule, delegate, or ignore.'
  },
  {
    name: 'Rubber Band Model',
    keywords: ['torn', 'between', 'stay', 'leave', 'two', 'either', 'or', 'pull'],
    why: 'Useful when two attractive directions are pulling hard in opposite directions.',
    how: 'Name the tension on each side and write what would make the tension disappear.'
  },
  {
    name: 'Yes/No Rule',
    keywords: ['simple', 'clear', 'criteria', 'rule', 'filter', 'yes', 'no', 'decision'],
    why: 'Helps when the decision should be made with a few upfront criteria instead of endless analysis.',
    how: 'Write the non-negotiable criteria first, then check the choice against them.'
  },
  {
    name: 'Choice Overload Model',
    keywords: ['too many', 'options', 'overwhelmed', 'paralyzed', 'confused', 'compare'],
    why: 'Explains why too much choice slows action and creates indecision.',
    how: 'Reduce the option set to a short list before evaluating tradeoffs.'
  },
  {
    name: 'Consequences Model',
    keywords: ['consequences', 'future', 'downstream', 'impact', 'result', 'if i do nothing'],
    why: 'Forces you to treat inaction as a real choice with consequences.',
    how: 'Write the immediate, delayed, and hidden effects of each option and of doing nothing.'
  },
  {
    name: 'The Stop Rule',
    keywords: ['research', 'stuck', 'delay', 'analysis', 'more information', 'commit'],
    why: 'Helpful when gathering more information is really just a disguised delay tactic.',
    how: 'Define the point at which you stop researching and move to action.'
  },
  {
    name: 'Hard Choice Model',
    keywords: ['safe', 'rational', 'bold', 'intuitive', 'mode'],
    why: 'Makes your default decision style visible so you can choose a better one on purpose.',
    how: 'Identify which mode you are using and whether a different mode would be smarter here.'
  },
  {
    name: 'Cognitive Bias Check',
    keywords: ['bias', 'anchoring', 'confirm', 'availability', 'fast', 'slow', 'thinking'],
    why: 'Catches the classic thinking mistakes that distort judgment.',
    how: 'Check whether you are anchored, cherry-picking evidence, over-weighting the memorable, or rushing.'
  },
  {
    name: 'Crossroads Model',
    keywords: ['career', 'job', 'path', 'future', 'life', 'major', 'change'],
    why: 'Maps where you are coming from, what matters, and what is blocking the way forward.',
    how: 'List the past, present, values, blockers, and the road that best aligns.'
  },
  {
    name: 'Rumsfeld Matrix',
    keywords: ['risk', 'uncertain', 'unknown', 'unknowns', 'safe', 'danger'],
    why: 'Clarifies what is known, unknown, and unknowable so risks do not stay fuzzy.',
    how: 'Map known knowns, known unknowns, and unknown unknowns before deciding.'
  },
  {
    name: 'Black Swan Model',
    keywords: ['rare', 'unexpected', 'extreme', 'tail risk', 'surprise', 'event'],
    why: 'Reminds you that rare events can dominate outcomes and invalidate normal expectations.',
    how: 'Ask what extreme but plausible event could break the plan.'
  },
  {
    name: 'Prisoner\'s Dilemma',
    keywords: ['trust', 'cooperate', 'other person', 'relationship', 'partner', 'team'],
    why: 'Useful when the decision depends on trust, incentives, or repeated interactions with other people.',
    how: 'Ask whether cooperation, defection, or a repeated-game strategy is best.'
  },
  {
    name: 'Pareto Principle',
    keywords: ['80/20', 'impact', 'focus', 'effort', 'results', 'high leverage'],
    why: 'Finds the small number of actions that create most of the result.',
    how: 'Identify the 20 percent of actions that drive 80 percent of the payoff.'
  }
];

function env(name, fallback = '') {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function hasApiKey(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function createProviderProfiles() {
  return {
    openai: {
      key: 'openai',
      label: 'OpenAI',
      kind: 'openai-compatible',
      baseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      apiKey: env('OPENAI_API_KEY'),
      defaultModel: env('OPENAI_MODEL', 'gpt-4o-mini')
    },
    deepseek: {
      key: 'deepseek',
      label: 'DeepSeek',
      kind: 'openai-compatible',
      baseUrl: env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
      apiKey: env('DEEPSEEK_API_KEY'),
      defaultModel: env('DEEPSEEK_MODEL', 'deepseek-chat')
    },
    minimax: {
      key: 'minimax',
      label: 'Minimax',
      kind: 'openai-compatible',
      baseUrl: env('MINIMAX_BASE_URL', 'https://api.minimax.chat/v1'),
      apiKey: env('MINIMAX_API_KEY'),
      defaultModel: env('MINIMAX_MODEL', 'minimax-chat')
    },
    anthropic: {
      key: 'anthropic',
      label: 'Claude / Anthropic',
      kind: 'anthropic',
      apiKey: env('ANTHROPIC_API_KEY'),
      defaultModel: env('ANTHROPIC_MODEL', 'claude-3-5-haiku-latest')
    },
    mock: {
      key: 'mock',
      label: 'Demo mode',
      kind: 'mock',
      defaultModel: env('FLOWDASH_MOCK_MODEL', 'flowdash-mock')
    }
  };
}

function getProviderList() {
  const profiles = createProviderProfiles();
  return Object.values(profiles).map((profile) => ({
    key: profile.key,
    label: profile.label,
    kind: profile.kind,
    defaultModel: profile.defaultModel,
    available: profile.kind === 'mock' ? true : hasApiKey(profile.apiKey)
  }));
}

function getDefaultProviderKey() {
  const configured = env('FLOWDASH_AI_PROVIDER');
  const profiles = createProviderProfiles();
  if (configured && profiles[configured]) {
    const profile = profiles[configured];
    if (profile.kind === 'mock' || hasApiKey(profile.apiKey)) {
      return configured;
    }
  }

  for (const key of ['openai', 'deepseek', 'minimax', 'anthropic']) {
    const profile = profiles[key];
    if (profile && hasApiKey(profile.apiKey)) return key;
  }

  return 'mock';
}

function getDefaultModel(providerKey) {
  const override = env('FLOWDASH_AI_MODEL');
  if (override) return override;
  const profiles = createProviderProfiles();
  const profile = profiles[providerKey] || profiles.mock;
  return profile.defaultModel || profiles.mock.defaultModel;
}

function getProviderProfile(providerKey) {
  const profiles = createProviderProfiles();
  const fallbackKey = getDefaultProviderKey();
  const key = profiles[providerKey] ? providerKey : fallbackKey;
  return profiles[key] || profiles.mock;
}

function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function topKeywords(text, limit = 6) {
  const stopwords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'your', 'from', 'have', 'will',
    'into', 'about', 'what', 'when', 'where', 'how', 'why', 'can', 'should',
    'would', 'could', 'then', 'than', 'they', 'them', 'their', 'there', 'been',
    'want', 'need', 'make', 'take', 'choose', 'decision', 'decision-making',
    'think', 'thinking', 'like', 'just', 'more', 'less', 'some', 'what', 'your',
    'you', 'are', 'is', 'to', 'of', 'in', 'on', 'at', 'a', 'an', 'or', 'if',
    'it', 'as', 'be', 'by', 'do', 'does', 'did', 'not', 'i', 'we', 'me', 'my'
  ]);

  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length > 2 && !stopwords.has(token));

  const counts = new Map();
  tokens.forEach((token) => {
    counts.set(token, (counts.get(token) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function createTranscript(messages) {
  return (messages || [])
    .map((message, index) => {
      const role = message.role === 'assistant' ? 'Assistant' : 'User';
      const content = String(message.content || '').trim();
      return `${index + 1}. ${role}: ${content}`;
    })
    .join('\n\n');
}

function inferTopic(payload) {
  const threadTitle = String(payload.threadTitle || '').trim();
  if (threadTitle) return threadTitle;

  const lastUserMessage = [...(payload.messages || [])]
    .reverse()
    .find((message) => message.role === 'user');

  const rawText = lastUserMessage ? String(lastUserMessage.content || '') : '';
  const words = topKeywords(rawText, 6);
  if (words.length > 0) return words.join(' ');
  return 'your decision';
}

function pickRelevantModels(text) {
  const normalized = String(text || '').toLowerCase();
  const scores = BOOK_MODELS.map((model) => {
    const hits = model.keywords.reduce((count, keyword) => {
      const pattern = new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}\\b`, 'g');
      return count + ((normalized.match(pattern) || []).length > 0 ? 1 : 0);
    }, 0);
    return { ...model, hits };
  });

  const ranked = scores
    .filter((model) => model.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (ranked.length > 0) {
    return ranked.slice(0, 4).map((model) => ({
      name: model.name,
      whyItFits: model.why,
      howToUse: model.how
    }));
  }

  return BOOK_MODELS.slice(0, 3).map((model) => ({
    name: model.name,
    whyItFits: model.why,
    howToUse: model.how
  }));
}

function lineArrayFromKeywords(keywords, fallbackLines) {
  if (keywords.length === 0) return fallbackLines;
  return keywords.map((keyword) => `Use ${keyword} as a concrete constraint, signal, or test.`);
}

function buildMockResponse(payload, source = 'mock') {
  const transcript = createTranscript(payload.messages);
  const focusFramework = String(payload.focusFramework || 'synthesis');
  const topic = inferTopic(payload);
  const keywords = topKeywords(transcript || topic, 6);
  const bookModels = pickRelevantModels(transcript || topic);
  const confidence = keywords.length > 4 ? 'medium' : 'low';

  const firstPrinciplesFacts = [
    `The decision is really about ${topic}.`,
    'Separate what is known from what is assumed.',
    ...lineArrayFromKeywords(keywords, ['Identify the smallest reversible experiment that would reduce uncertainty.'])
  ];

  const inversionFailures = [
    `Avoid staying vague about ${topic}.`,
    'Do not add complexity before you know what problem must be solved.',
    'Do not wait for perfect certainty before taking the next cheap test.'
  ];

  const secondOrderEffects = [
    `Immediate effect: ${topic} becomes clearer.`,
    'Second order effect: you learn which tradeoff matters most.',
    'Third order effect: future choices get easier because the decision criteria are explicit.'
  ];

  const synthesisRecommendation = keywords.length > 0
    ? `Use a small, reversible next step on ${keywords[0]} before committing fully.`
    : 'Choose the smallest reversible next step that buys learning quickly.';

  const nextAction = keywords.length > 0
    ? `Write down the decision, then test ${keywords[0]} with one cheap experiment in the next 48 hours.`
    : 'Write the choice on one line, set the default option, and define a cheap test within 48 hours.';

  return {
    threadTitle: topic,
    assistantMessage: `Here’s the framework breakdown for ${topic}. ${synthesisRecommendation}`,
    frameworks: {
      firstPrinciples: {
        headline: 'Reduce the problem to facts, constraints, and tests.',
        coreFacts: firstPrinciplesFacts,
        assumptions: [
          `Assumption to challenge: ${topic} needs a full commitment right now.`,
          'Assumption to test: the best answer is the one that minimizes regret, not the one that feels most polished.'
        ],
        questions: [
          'What do we know for certain?',
          'What would have to be true for each option to work?',
          'What is the smallest test that would change the decision?',
        ],
        answer: `Start from the underlying facts of ${topic}, cut away the story, and test the core constraint with a small action.`
      },
      inversion: {
        headline: 'Find the ways this decision could fail, then design guardrails.',
        failureModes: inversionFailures,
        guardrails: [
          'Define what would make this a bad decision.',
          'Protect against delay, ambiguity, and untested assumptions.',
          'Set a stop rule so research does not become procrastination.'
        ],
        answer: `If ${topic} fails, it will usually fail because the assumption stayed hidden or the plan was too big to test.`
      },
      secondOrder: {
        headline: 'Look past the immediate win and inspect the knock-on effects.',
        immediateEffects: [
          `You get a clearer view of ${topic}.`,
          'You reduce emotional noise by writing the decision down.'
        ],
        secondOrderEffects: secondOrderEffects,
        answer: 'The most useful move is the one that improves future decisions, not just the current one.'
      },
      decisionModels: {
        headline: 'The most relevant models from The Decision Book.',
        models: bookModels,
        answer: `These models fit because they match the shape of the decision: ${bookModels.map((model) => model.name).join(', ')}.`
      },
      synthesis: {
        headline: 'Recommendation and next move.',
        recommendation: synthesisRecommendation,
        tradeoffs: [
          'Fast action reduces uncertainty but can lock in a bad path if the wrong assumption is true.',
          'More analysis can improve confidence, but only if it changes what you know.'
        ],
        risks: [
          'Overthinking the decision instead of testing it.',
          'Treating one model as the whole answer.'
        ],
        nextAction,
        confidence
      }
    },
    providerUsed: source,
    modelUsed: payload.model || getDefaultModel(payload.provider),
    generatedAt: new Date().toISOString()
  };
}

function buildSystemPrompt() {
  return [
    'You are FlowDash Decision Coach, a sharp but friendly decision-making assistant.',
    'Use first principles, inversion, second order thinking, and The Decision Book models.',
    'Be practical and concise, not flowery.',
    'Return JSON only. Do not wrap it in markdown fences.',
    'Required JSON shape:',
    JSON.stringify({
      threadTitle: 'short title',
      assistantMessage: 'short chat reply',
      frameworks: {
        firstPrinciples: {
          headline: 'string',
          coreFacts: ['string'],
          assumptions: ['string'],
          questions: ['string'],
          answer: 'string'
        },
        inversion: {
          headline: 'string',
          failureModes: ['string'],
          guardrails: ['string'],
          answer: 'string'
        },
        secondOrder: {
          headline: 'string',
          immediateEffects: ['string'],
          secondOrderEffects: ['string'],
          answer: 'string'
        },
        decisionModels: {
          headline: 'string',
          models: [{ name: 'string', whyItFits: 'string', howToUse: 'string' }],
          answer: 'string'
        },
        synthesis: {
          headline: 'string',
          recommendation: 'string',
          tradeoffs: ['string'],
          risks: ['string'],
          nextAction: 'string',
          confidence: 'low|medium|high'
        }
      }
    }, null, 2)
  ].join('\n');
}

function buildUserPrompt(payload) {
  const transcript = createTranscript(payload.messages);
  const topic = inferTopic(payload);
  const focus = String(payload.focusFramework || 'synthesis');
  return [
    `Decision topic: ${topic}`,
    `Active thinking lens: ${focus}`,
    payload.summary ? `Existing summary: ${payload.summary}` : '',
    payload.threadTitle ? `Thread title: ${payload.threadTitle}` : '',
    '',
    'Conversation transcript:',
    transcript || '(no transcript yet)',
    '',
    'Please answer with the full JSON object described in the system prompt.'
  ].filter(Boolean).join('\n');
}

function parseProviderJson(text) {
  const raw = String(text || '').trim();
  const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const jsonText = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonText);
}

function normalizeArray(value, fallback = []) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [...fallback];
}

function normalizeModels(value, fallback = []) {
  if (!Array.isArray(value)) return [...fallback];
  return value
    .map((model) => ({
      name: String(model && model.name ? model.name : '').trim(),
      whyItFits: String(model && (model.whyItFits || model.why || '')).trim(),
      howToUse: String(model && (model.howToUse || model.how || '')).trim()
    }))
    .filter((model) => model.name);
}

function normalizeFrameworks(rawFrameworks, payload) {
  const fallback = buildMockResponse(payload, 'mock').frameworks;
  const frameworks = rawFrameworks && typeof rawFrameworks === 'object' ? rawFrameworks : {};

  return {
    firstPrinciples: {
      headline: String(frameworks.firstPrinciples?.headline || fallback.firstPrinciples.headline).trim(),
      coreFacts: normalizeArray(frameworks.firstPrinciples?.coreFacts, fallback.firstPrinciples.coreFacts),
      assumptions: normalizeArray(frameworks.firstPrinciples?.assumptions, fallback.firstPrinciples.assumptions),
      questions: normalizeArray(frameworks.firstPrinciples?.questions, fallback.firstPrinciples.questions),
      answer: String(frameworks.firstPrinciples?.answer || fallback.firstPrinciples.answer).trim()
    },
    inversion: {
      headline: String(frameworks.inversion?.headline || fallback.inversion.headline).trim(),
      failureModes: normalizeArray(frameworks.inversion?.failureModes, fallback.inversion.failureModes),
      guardrails: normalizeArray(frameworks.inversion?.guardrails, fallback.inversion.guardrails),
      answer: String(frameworks.inversion?.answer || fallback.inversion.answer).trim()
    },
    secondOrder: {
      headline: String(frameworks.secondOrder?.headline || fallback.secondOrder.headline).trim(),
      immediateEffects: normalizeArray(frameworks.secondOrder?.immediateEffects, fallback.secondOrder.immediateEffects),
      secondOrderEffects: normalizeArray(frameworks.secondOrder?.secondOrderEffects, fallback.secondOrder.secondOrderEffects),
      answer: String(frameworks.secondOrder?.answer || fallback.secondOrder.answer).trim()
    },
    decisionModels: {
      headline: String(frameworks.decisionModels?.headline || fallback.decisionModels.headline).trim(),
      models: normalizeModels(frameworks.decisionModels?.models, fallback.decisionModels.models),
      answer: String(frameworks.decisionModels?.answer || fallback.decisionModels.answer).trim()
    },
    synthesis: {
      headline: String(frameworks.synthesis?.headline || fallback.synthesis.headline).trim(),
      recommendation: String(frameworks.synthesis?.recommendation || fallback.synthesis.recommendation).trim(),
      tradeoffs: normalizeArray(frameworks.synthesis?.tradeoffs, fallback.synthesis.tradeoffs),
      risks: normalizeArray(frameworks.synthesis?.risks, fallback.synthesis.risks),
      nextAction: String(frameworks.synthesis?.nextAction || fallback.synthesis.nextAction).trim(),
      confidence: String(frameworks.synthesis?.confidence || fallback.synthesis.confidence || 'medium').trim() || 'medium'
    }
  };
}

function normalizeDecisionResponse(raw, payload, providerKey, model) {
  const fallback = buildMockResponse(payload, 'mock');
  const source = String(raw?.source || providerKey || 'provider');
  const threadTitle = String(raw?.threadTitle || fallback.threadTitle).trim() || fallback.threadTitle;
  const assistantMessage = String(raw?.assistantMessage || raw?.message || fallback.assistantMessage).trim() || fallback.assistantMessage;
  const frameworks = normalizeFrameworks(raw?.frameworks || raw?.analysis || {}, payload);

  if (!frameworks.synthesis.recommendation) {
    frameworks.synthesis.recommendation = fallback.frameworks.synthesis.recommendation;
  }

  return {
    threadTitle,
    assistantMessage,
    frameworks,
    providerUsed: source,
    modelUsed: model || payload.model || fallback.modelUsed,
    generatedAt: new Date().toISOString()
  };
}

async function callOpenAiCompatible(profile, model, prompt) {
  const response = await fetch(`${profile.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${profile.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.2,
      max_tokens: 1600
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI-compatible request failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
  return content;
}

async function callAnthropic(profile, model, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': profile.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1600,
      system: prompt.system,
      messages: [
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Anthropic request failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  if (Array.isArray(data?.content)) {
    return data.content.map((part) => part?.text || '').join('\n');
  }
  return String(data?.content || '');
}

async function runDecisionRelay(payload) {
  const providerKey = String(payload.provider || '').trim();
  const profile = getProviderProfile(providerKey);
  const model = String(payload.model || '').trim() || getDefaultModel(profile.key);
  const prompt = {
    system: buildSystemPrompt(),
    user: buildUserPrompt(payload)
  };

  if (profile.kind === 'mock' || !hasApiKey(profile.apiKey)) {
    return buildMockResponse(payload, profile.kind === 'mock' ? 'mock' : 'fallback');
  }

  try {
    const text = profile.kind === 'anthropic'
      ? await callAnthropic(profile, model, prompt)
      : await callOpenAiCompatible(profile, model, prompt);
    const parsed = parseProviderJson(text);
    return normalizeDecisionResponse(parsed, payload, profile.key, model);
  } catch (err) {
    const fallback = buildMockResponse(payload, 'fallback');
    return {
      ...fallback,
      assistantMessage: `${fallback.assistantMessage} (Fallback mode because the relay could not reach ${profile.label}.)`,
      providerUsed: 'fallback',
      modelUsed: model,
      generatedAt: new Date().toISOString()
    };
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  res.end(text);
}

async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) {
      throw new Error('Request body too large.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveStaticPath(urlPath) {
  const safePath = decodeURIComponent(urlPath.split('?')[0] || '/');
  const normalized = safePath === '/' ? '/index.html' : safePath;
  const absolute = path.resolve(ROOT_DIR, `.${normalized}`);
  const relative = path.relative(ROOT_DIR, absolute);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Forbidden path.');
  }

  return absolute;
}

async function serveStatic(req, res, urlPath) {
  let filePath = resolveStaticPath(urlPath);
  let stat;

  try {
    stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fs.stat(filePath);
    }
  } catch (err) {
    if (path.extname(filePath)) {
      sendText(res, 404, 'Not found.');
      return;
    }
    filePath = path.join(ROOT_DIR, 'index.html');
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch (err) {
    sendText(res, 404, 'Not found.');
  }
}

async function handleDecisionConfig(res) {
  const providerList = getProviderList();
  const defaultProvider = getDefaultProviderKey();
  sendJson(res, 200, {
    defaultProvider,
    defaultModel: getDefaultModel(defaultProvider),
    demoMode: defaultProvider === 'mock',
    providers: providerList
  });
}

async function handleDecisionChat(req, res) {
  try {
    const body = await readBody(req);
    const payload = safeJsonParse(body, null);
    if (!payload || typeof payload !== 'object') {
      sendJson(res, 400, { error: 'Invalid JSON payload.' });
      return;
    }

    const response = await runDecisionRelay(payload);
    sendJson(res, 200, {
      ok: true,
      ...response
    });
  } catch (err) {
    sendJson(res, 500, {
      error: err.message || 'Decision relay failed.'
    });
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && requestUrl.pathname === '/api/decision-config') {
    await handleDecisionConfig(res);
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/decision-chat') {
    await handleDecisionChat(req, res);
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method not allowed.');
    return;
  }

  await serveStatic(req, res, requestUrl.pathname);
});

server.listen(PORT, () => {
  console.log(`FlowDash relay listening on http://localhost:${PORT}`);
  console.log(`Default AI provider: ${getDefaultProviderKey()}`);
});
