const jsonHeaders = {
  'Content-Type': 'application/json'
};

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

const apiBase = normalizeBase(import.meta.env.VITE_API_BASE);

let csrfTokenState = null;
let csrfTokenPromise = null;

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const csrfHeaders = await csrfHeadersFor(method);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(apiBase + path, {
    credentials: 'include',
    ...options,
    headers: {
      ...(isFormData ? {} : jsonHeaders),
      ...csrfHeaders,
      ...(options.headers || {})
    }
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 403 && !safeMethods.has(method.toUpperCase())) {
      csrfTokenState = null;
    }
    const message = typeof body === 'string' ? body : body?.message || response.statusText;
    throw new Error(message || 'Request failed');
  }

  return body;
}

export async function apiGetMe() {
  return request('/api/me', { method: 'GET', headers: {} });
}

export async function apiLogin(payload) {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiRegister(payload) {
  return request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiLogout() {
  const response = await request('/api/auth/logout', { method: 'POST', headers: {} });
  csrfTokenState = null;
  return response;
}

export function apiList(resource) {
  return request(resource, { method: 'GET', headers: {} });
}

export function apiCreate(resource, payload) {
  return request(resource, { method: 'POST', body: JSON.stringify(payload) });
}

export function apiUpdate(resource, id, payload) {
  return request(`${resource}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function apiDelete(resource, id) {
  return request(`${resource}/${id}`, { method: 'DELETE', headers: {} });
}

export async function apiGoalsOverview(date, year) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (year) params.set('year', year);
  const query = params.toString() ? `?${params}` : '';
  return request(`/api/goals/overview${query}`, { method: 'GET', headers: {} });
}

export async function apiCreateGoal(payload) {
  return request('/api/goals', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiUpdateGoal(id, payload) {
  return request(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiDeleteGoal(id) {
  return request(`/api/goals/${id}`, { method: 'DELETE', headers: {} });
}

export async function apiMarkGoalActivity(id, payload) {
  return request(`/api/goals/${id}/activity`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiClearGoalActivity(id, date) {
  return request(`/api/goals/${id}/activity/${encodeURIComponent(date)}`, { method: 'DELETE', headers: {} });
}

export async function apiHabitsOverview(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return request(`/api/habits/overview${query}`, { method: 'GET', headers: {} });
}

export async function apiCreateHabit(payload) {
  return request('/api/habits', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiUpdateHabit(id, payload) {
  return request(`/api/habits/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiDeleteHabit(id) {
  return request(`/api/habits/${id}`, { method: 'DELETE', headers: {} });
}

export async function apiCheckInHabit(id, payload) {
  return request(`/api/habits/${id}/checkins`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiClearHabitCheckIn(id, date) {
  return request(`/api/habits/${id}/checkins/${encodeURIComponent(date)}`, { method: 'DELETE', headers: {} });
}

export async function apiHabitCheckins(id, from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params}` : '';
  return request(`/api/habits/${id}/checkins${query}`, { method: 'GET', headers: {} });
}

export async function apiSmaartDashboard() {
  return request('/api/smaart-goals/dashboard', { method: 'GET', headers: {} });
}

export async function apiSmaartPriorities() {
  return request('/api/smaart-goals/priorities', { method: 'GET', headers: {} });
}

export async function apiSmaartUpdatePriorityProfile(payload) {
  return request('/api/smaart-goals/priorities/preferences', { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiSmaartGoals(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value);
    }
  }
  const query = params.toString() ? `?${params}` : '';
  return request(`/api/smaart-goals${query}`, { method: 'GET', headers: {} });
}

export async function apiSmaartCreateGoal(payload) {
  return request('/api/smaart-goals', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiSmaartGoalDetail(id) {
  return request(`/api/smaart-goals/${id}`, { method: 'GET', headers: {} });
}

export async function apiSmaartUpdateGoal(id, payload) {
  return request(`/api/smaart-goals/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiSmaartDeleteGoal(id) {
  return request(`/api/smaart-goals/${id}`, { method: 'DELETE', headers: {} });
}

export async function apiSmaartArchiveGoal(id) {
  return request(`/api/smaart-goals/${id}/archive`, { method: 'POST', headers: {} });
}

export async function apiSmaartRestoreGoal(id) {
  return request(`/api/smaart-goals/${id}/restore`, { method: 'POST', headers: {} });
}

export async function apiSmaartCreateSprint(goalId, payload) {
  return request(`/api/smaart-goals/${goalId}/sprints`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiSmaartUpdateSprint(goalId, sprintId, payload) {
  return request(`/api/smaart-goals/${goalId}/sprints/${sprintId}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiSmaartDeleteSprint(goalId, sprintId) {
  return request(`/api/smaart-goals/${goalId}/sprints/${sprintId}`, { method: 'DELETE', headers: {} });
}

export async function apiSmaartCreateTask(goalId, payload) {
  return request(`/api/smaart-goals/${goalId}/tasks`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiSmaartCreateSprintTask(goalId, sprintId, payload) {
  return request(`/api/smaart-goals/${goalId}/sprints/${sprintId}/tasks`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiSmaartUpdateTask(taskId, payload) {
  return request(`/api/smaart-tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiSmaartDuplicateTask(taskId) {
  return request(`/api/smaart-tasks/${taskId}/duplicate`, { method: 'POST', headers: {} });
}

export async function apiSmaartUpdateTaskStatus(taskId, status) {
  return request(`/api/smaart-tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function apiSmaartDeleteTask(taskId) {
  return request(`/api/smaart-tasks/${taskId}`, { method: 'DELETE', headers: {} });
}

export async function apiSmaartKanban() {
  return request('/api/smaart-goals/kanban', { method: 'GET', headers: {} });
}

export async function apiSmaartCalendar(from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params}` : '';
  return request(`/api/smaart-goals/calendar${query}`, { method: 'GET', headers: {} });
}

export async function apiSmaartArchive() {
  return request('/api/smaart-goals/archive', { method: 'GET', headers: {} });
}

export async function apiMindVaultOverview() {
  return request('/api/mindvault/overview', { method: 'GET', headers: {} });
}

export async function apiMindVaultInbox() {
  return request('/api/mindvault/inbox', { method: 'GET', headers: {} });
}

export async function apiMindVaultLibrary() {
  return request('/api/mindvault/library', { method: 'GET', headers: {} });
}

export async function apiMindVaultInsights() {
  return request('/api/mindvault/insights', { method: 'GET', headers: {} });
}

export async function apiMindVaultAnalytics() {
  return request('/api/mindvault/analytics', { method: 'GET', headers: {} });
}

export async function apiMindVaultStats() {
  return request('/api/mindvault/stats', { method: 'GET', headers: {} });
}

export async function apiMindVaultCreateSubject(payload) {
  return request('/api/mindvault/subjects', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiMindVaultUpdateSubject(id, payload) {
  return request(`/api/mindvault/subjects/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiMindVaultDeleteSubject(id) {
  return request(`/api/mindvault/subjects/${id}`, { method: 'DELETE', headers: {} });
}

export async function apiMindVaultCreateSprint(payload) {
  return request('/api/mindvault/sprints', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiMindVaultUpdateSprint(id, payload) {
  return request(`/api/mindvault/sprints/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiMindVaultDeleteSprint(id) {
  return request(`/api/mindvault/sprints/${id}`, { method: 'DELETE', headers: {} });
}

export async function apiMindVaultCreateItem(payload) {
  return request('/api/mindvault/items', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiMindVaultUpdateItem(id, payload) {
  return request(`/api/mindvault/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiMindVaultDeleteItem(id) {
  return request(`/api/mindvault/items/${id}`, { method: 'DELETE', headers: {} });
}

export async function apiMindVaultReviewItem(id, payload) {
  return request(`/api/mindvault/items/${id}/reviews`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiMindVaultQueue() {
  return request('/api/mindvault/queue', { method: 'GET', headers: {} });
}

export async function apiMindVaultReviewQueue(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return request(`/api/mindvault/review-queue${query}`, { method: 'GET', headers: {} });
}

export async function apiMindVaultItems() {
  return request('/api/mindvault/items', { method: 'GET', headers: {} });
}

export async function apiMindVaultSubjects() {
  return request('/api/mindvault/subjects', { method: 'GET', headers: {} });
}

export async function apiMindVaultSprints() {
  return request('/api/mindvault/sprints', { method: 'GET', headers: {} });
}

export async function apiMindVaultCreateResource(itemId, payload) {
  return request(`/api/mindvault/items/${itemId}/resources`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiMindVaultUploadResource(itemId, formData) {
  return request(`/api/mindvault/items/${itemId}/resources`, { method: 'POST', body: formData });
}

export async function apiMindVaultDeleteResource(resourceId) {
  return request(`/api/mindvault/resources/${resourceId}`, { method: 'DELETE', headers: {} });
}

export async function apiCreateDecisionThread(payload) {
  return request('/api/decisions', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiListDecisionThreads() {
  return request('/api/decisions', { method: 'GET', headers: {} });
}

export async function apiListDecisionMessages(threadId) {
  return request(`/api/decisions/${threadId}/messages`, { method: 'GET', headers: {} });
}

export async function apiDeleteDecisionThread(threadId) {
  return request(`/api/decisions/${threadId}`, { method: 'DELETE', headers: {} });
}

export function getGoogleAuthUrl() {
  if (apiBase) {
    return `${apiBase}/oauth2/authorization/google`;
  }
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return '';
  }
  return '/oauth2/authorization/google';
}

export async function streamDecisionChat(payload, onChunk) {
  const csrfHeaders = await csrfHeadersFor('POST');
  const response = await fetch(apiBase + '/api/ai/chat', {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...jsonHeaders,
      ...csrfHeaders,
      Accept: 'text/event-stream'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex >= 0) {
      const eventBlock = buffer.slice(0, separatorIndex).trim();
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf('\n\n');

      if (!eventBlock) {
        continue;
      }

      const dataLine = eventBlock
        .split('\n')
        .find((line) => line.startsWith('data:'));
      if (!dataLine) {
        continue;
      }

      const rawData = dataLine.replace(/^data:\s?/, '');
      const parsed = tryParseJson(rawData);
      if (parsed?.content) {
        fullText += parsed.content;
        onChunk?.(parsed);
      }
      if (parsed?.done) {
        return fullText;
      }
    }
  }

  return fullText;
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return { content: value };
  }
}

function normalizeBase(value) {
  if (!value) {
    return '';
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

async function csrfHeadersFor(method) {
  if (safeMethods.has(method.toUpperCase())) {
    return {};
  }
  const csrf = await ensureCsrfToken();
  return csrf?.headerName && csrf?.token ? { [csrf.headerName]: csrf.token } : {};
}

async function ensureCsrfToken() {
  if (csrfTokenState) {
    return csrfTokenState;
  }
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch('/api/auth/csrf', {
      credentials: 'include',
      headers: {
        Accept: 'application/json'
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to initialize security token');
        }
        return response.json();
      })
      .then((token) => {
        csrfTokenState = token;
        return token;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }
  return csrfTokenPromise;
}
