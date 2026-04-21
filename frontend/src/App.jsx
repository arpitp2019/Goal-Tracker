import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import {
  apiCreate,
  apiCreateDecisionThread,
  apiDelete,
  apiGetMe,
  apiList,
  apiListDecisionMessages,
  apiListDecisionThreads,
  apiLogin,
  apiLogout,
  apiRegister,
  apiUpdate,
  getGoogleAuthUrl,
  streamDecisionChat
} from './api';
import GoalTrackerPage from './GoalTrackerPage';
import MindVaultPage from './MindVaultWorkspace';

const navItems = [
  { path: '/', label: 'Home', icon: '◌' },
  { path: '/habits', label: 'Habits', icon: 'H' },
  { path: '/vault', label: 'MindVault', icon: '▣' },
  { path: '/decision', label: 'Decision Coach', icon: '✦' }
];

const decisionTabs = [
  { key: 'first-principles', label: 'First Principles' },
  { key: 'inversion', label: 'Inversion' },
  { key: 'second-order', label: 'Second Order' },
  { key: 'book-models', label: 'Book Models' },
  { key: 'synthesis', label: 'Synthesis' }
];

const decisionTemplates = {
  'first-principles': 'Break the decision into facts, assumptions, and constraints.',
  inversion: 'Show how this decision could fail and how to avoid it.',
  'second-order': 'Explain the immediate, next, and downstream effects.',
  'book-models': 'Choose the most appropriate model from The Decision Book and apply it.',
  synthesis: 'Synthesize the frameworks into a final recommendation.'
};

function App() {
  const [user, setUser] = useState(undefined);
  const [bootError, setBootError] = useState('');
  const routerBasename = normalizeRouterBasename(import.meta.env.BASE_URL);

  useEffect(() => {
    apiGetMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setBootError(''));
  }, []);

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
  };

  if (user === undefined) {
    return <CenteredSplash label="Loading FlowDash..." />;
  }

  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage
                onSignedIn={(nextUser) => setUser(nextUser)}
                bootError={bootError}
                setBootError={setBootError}
              />
            )
          }
        />
        <Route
          element={
            user ? (
              <AppShell user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/habits/*" element={<GoalTrackerPage />} />
          <Route path="/goals/*" element={<Navigate to="/habits/checklist" replace />} />
          <Route path="/vault" element={<Navigate to="/vault/overview" replace />} />
          <Route path="/vault/*" element={<MindVaultPage />} />
          <Route path="/decision" element={<DecisionCoachPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function normalizeRouterBasename(value) {
  const base = value || '/';
  if (base === '/') {
    return '/';
  }
  return base.replace(/\/$/, '');
}

function AppShell({ user, onLogout }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <h1>FlowDash</h1>
            <p>Personal ops for a smaller team</p>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} end={item.path === '/'}>
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <div className="eyebrow">Signed in as</div>
          <div className="sidebar-user">{user.displayName || user.email}</div>
          <div className="muted">{user.authProvider}</div>
          <button className="button secondary full" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}

function DashboardPage() {
  const cards = useMemo(
    () => [
      { title: 'Habits', path: '/habits', description: 'Keep steady progress visible and measurable.' },
      { title: 'MindVault', path: '/vault', description: 'Plan subjects, sprints, and daily reviews.' },
      { title: 'Decision Coach', path: '/decision', description: 'Think in frameworks and get a final recommendation.' }
    ],
    []
  );

  return (
    <section className="page">
      <div className="hero-card">
        <div>
          <p className="eyebrow">FlowDash</p>
          <h2>One product for focus, capture, and better choices.</h2>
          <p className="lead">
            The frontend is now a React app. The backend owns auth, persistence, and AI routing so the browser stays simple.
          </p>
        </div>
        <div className="hero-stat">
          <span>Backend-driven</span>
          <strong>PostgreSQL + Spring Boot + React</strong>
        </div>
      </div>

      <div className="card-grid">
        {cards.map((card) => (
          <article key={card.title} className="feature-card">
            <p className="eyebrow">{card.title}</p>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <NavLink className="button" to={card.path}>
              Open
            </NavLink>
          </article>
        ))}
      </div>
    </section>
  );
}

function CollectionPage({ config }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(config.defaults);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiList(config.resource);
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    apiList(config.resource)
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [config.resource]);

  const reset = () => {
    setEditingId(null);
    setForm(config.defaults);
  };

  const onEdit = (item) => {
    setEditingId(item.id);
    setForm({
      ...config.defaults,
      ...item,
      dueDate: item.dueDate || ''
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = normalizePayload(form);
      if (editingId) {
        await apiUpdate(config.resource, editingId, payload);
      } else {
        await apiCreate(config.resource, payload);
      }
      await load();
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this item?')) {
      return;
    }
    await apiDelete(config.resource, id);
    await load();
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{config.title}</p>
          <h2>{config.title}</h2>
          <p className="lead">{config.subtitle}</p>
        </div>
        <button className="button secondary" onClick={reset}>
          New item
        </button>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <div className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <h3>{config.title}</h3>
            <span className="muted">{loading ? 'Refreshing...' : `${items.length} items`}</span>
          </div>
          <div className="list">
            {items.length === 0 ? <div className="empty-state">{config.emptyLabel}</div> : null}
            {items.map((item) => (
              <article key={item.id} className="list-card">
                <div className="list-card-head">
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description || item.content || item.notes || 'No description'}</p>
                  </div>
                  <div className="card-actions">
                    <button className="text-button" onClick={() => onEdit(item)}>
                      Edit
                    </button>
                    <button className="text-button danger" onClick={() => remove(item.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                <div className="chips">
                  {'status' in item ? <span>{item.status}</span> : null}
                  {'cadence' in item ? <span>{item.cadence}</span> : null}
                  {'entryType' in item ? <span>{item.entryType}</span> : null}
                  {'priority' in item ? <span>Priority {item.priority}</span> : null}
                  {'favorite' in item && item.favorite ? <span>Favorite</span> : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <form className="panel form-panel" onSubmit={submit}>
          <div className="panel-header">
            <h3>{editingId ? 'Edit item' : 'Create item'}</h3>
            <span className="muted">Stored in the backend database</span>
          </div>

          {config.fields.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
            />
          ))}

          <div className="form-actions">
            <button className="button" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button className="button secondary" type="button" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function DecisionCoachPage() {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState(decisionTabs[0].key);
  const [results, setResults] = useState(() => Object.fromEntries(decisionTabs.map((tab) => [tab.key, { status: 'idle', text: '' }])));
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const loadThreads = useCallback(async () => {
    const data = await apiListDecisionThreads();
    setThreads(data);
    setActiveThreadId((current) => current || data[0]?.id || null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadThreads()
      .catch(() => {
        if (!cancelled) {
          setThreads([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadThreads]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    apiListDecisionMessages(activeThreadId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [activeThreadId]);

  const createThread = async (title) => {
    const thread = await apiCreateDecisionThread({ title });
    await loadThreads();
    setActiveThreadId(thread.id);
    return thread;
  };

  const runDecisionSuite = async (question) => {
    setWorking(true);
    setError('');
    try {
      const thread = activeThreadId
        ? threads.find((candidate) => candidate.id === activeThreadId) || { id: activeThreadId }
        : await createThread(question.slice(0, 80));

      const basePayload = {
        threadId: thread.id,
        prompt: question
      };

      const nextResults = Object.fromEntries(
        decisionTabs.map((tab) => [tab.key, { status: 'running', text: '' }])
      );
      setResults(nextResults);

      await Promise.all(
        decisionTabs.map(async (tab) => {
          try {
            const text = await streamDecisionChat(
              { ...basePayload, tabKey: tab.key, context: decisionTemplates[tab.key] },
              (chunk) => {
                setResults((current) => ({
                  ...current,
                  [tab.key]: {
                    status: 'running',
                    text: `${current[tab.key]?.text || ''}${chunk.content}`
                  }
                }));
              }
            );
            setResults((current) => ({
              ...current,
              [tab.key]: { status: 'done', text }
            }));
          } catch (streamError) {
            setResults((current) => ({
              ...current,
              [tab.key]: { status: 'error', text: streamError.message }
            }));
          }
        })
      );

      await loadThreads();
      if (thread?.id) {
        const refreshedMessages = await apiListDecisionMessages(thread.id);
        setMessages(refreshedMessages);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  const activeThread = threads.find((thread) => thread.id === activeThreadId);

  return (
    <section className="page decision-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Decision Coach</p>
          <h2>Parallel thinking tabs for better choices.</h2>
          <p className="lead">
            The backend decides which AI provider to use. The browser just runs the frameworks and stores the thread.
          </p>
        </div>
        <button className="button secondary" onClick={() => setActiveThreadId(null)}>
          New thread
        </button>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <div className="decision-layout">
        <aside className="panel decision-threads">
          <div className="panel-header">
            <h3>Threads</h3>
            <span className="muted">{threads.length} saved</span>
          </div>
          {loading ? <div className="empty-state">Loading threads...</div> : null}
          <div className="thread-list">
            {threads.map((thread) => (
              <button
                key={thread.id}
                className={`thread-item${thread.id === activeThreadId ? ' active' : ''}`}
                onClick={() => setActiveThreadId(thread.id)}
              >
                <strong>{thread.title}</strong>
                <span>{thread.summary || 'No summary yet'}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="decision-main">
          <div className="panel">
            <div className="panel-header">
              <h3>{activeThread?.title || 'Start a new decision'}</h3>
              <span className="muted">Frameworks run in parallel</span>
            </div>

            <div className="tabs">
              {decisionTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`tab${tab.key === activeTab ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="tab-panel">
              <div className="tab-panel-head">
                <h4>{decisionTabs.find((tab) => tab.key === activeTab)?.label}</h4>
                <span className="muted">{results[activeTab]?.status || 'idle'}</span>
              </div>
              <pre className="analysis-box">
                {results[activeTab]?.text || 'Run the suite to generate a live analysis.'}
              </pre>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Ask the coach</h3>
              <span className="muted">Stored per user in the backend database</span>
            </div>

            <textarea
              className="input textarea"
              placeholder="Should I switch jobs, launch the app, or keep iterating?"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
            />

            <div className="form-actions">
              <button className="button" disabled={working || !prompt.trim()} onClick={() => runDecisionSuite(prompt.trim())}>
                {working ? 'Thinking...' : 'Run all frameworks'}
              </button>
            </div>

            <div className="message-list">
              {messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  <div className="message-meta">
                    <strong>{message.role}</strong>
                    <span>{message.tabKey}</span>
                  </div>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoginPage({ onSignedIn, bootError, setBootError }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleAuthUrl = getGoogleAuthUrl();

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        email: form.email,
        password: form.password
      };
      const response =
        mode === 'login'
          ? await apiLogin(payload)
          : await apiRegister({ ...payload, displayName: form.displayName || form.email });
      onSignedIn(response);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setBootError('');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand compact">
          <div className="brand-mark">F</div>
          <div>
            <h1>FlowDash</h1>
            <p>Professional focus and decision-making for a small team</p>
          </div>
        </div>

        <div className="segmented">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label>
            Email
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>

          {mode === 'register' ? (
            <label>
              Display name
              <input
                className="input"
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                required
              />
            </label>
          ) : null}

          <label>
            Password
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
            />
          </label>

          <button className="button full" disabled={busy}>
            {busy ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="divider">or</div>

        {googleAuthUrl ? (
          <a className="button secondary full" href={googleAuthUrl}>
            {mode === 'register' ? 'Sign up with Google' : 'Continue with Google'}
          </a>
        ) : (
          <button className="button secondary full" type="button" disabled>
            Google signup needs the backend
          </button>
        )}

        {!googleAuthUrl ? <div className="notice">Deploy the Spring backend and set `VITE_API_BASE` to enable Google signup.</div> : null}

        {(error || bootError) && <div className="notice error">{error || bootError}</div>}
      </div>
    </div>
  );
}

function Field({ field, value, onChange }) {
  if (field.type === 'textarea') {
    return (
      <label className="field">
        <span>{field.label}</span>
        <textarea className="input textarea" value={value || ''} onChange={(event) => onChange(event.target.value)} rows={4} />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select className="input" value={value || ''} onChange={(event) => onChange(event.target.value)}>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="field checkbox">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{field.label}</span>
      </label>
    );
  }

  return (
    <label className="field">
      <span>{field.label}</span>
      <input
        className="input"
        type={field.type}
        value={value ?? ''}
        onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)}
      />
    </label>
  );
}

function CenteredSplash({ label }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <p className="eyebrow">FlowDash</p>
        <h1>{label}</h1>
      </div>
    </div>
  );
}

function normalizePayload(form) {
  const payload = { ...form };
  for (const [key, value] of Object.entries(payload)) {
    if (value === '') {
      payload[key] = null;
    }
  }
  return payload;
}

export default App;
