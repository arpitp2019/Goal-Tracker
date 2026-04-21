import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import {
  apiMindVaultCreateItem,
  apiMindVaultCreateSprint,
  apiMindVaultCreateSubject,
  apiMindVaultDeleteItem,
  apiMindVaultDeleteSprint,
  apiMindVaultDeleteSubject,
  apiMindVaultOverview,
  apiMindVaultReviewItem,
  apiMindVaultUpdateItem,
  apiMindVaultUpdateSprint,
  apiMindVaultUpdateSubject
} from './api';

const subjectDefaults = {
  title: '',
  description: '',
  priority: 3,
  targetMastery: 80,
  deadline: '',
  tags: '',
  archived: false
};

const sprintDefaults = {
  subjectId: '',
  title: '',
  description: '',
  status: 'PLANNED',
  startDate: '',
  dueDate: '',
  estimatedSessions: 1,
  completedSessions: 0
};

const itemDefaults = {
  subjectId: '',
  sprintId: '',
  source: 'PLANNED',
  title: '',
  prompt: '',
  answer: '',
  notes: '',
  tags: '',
  priority: 3,
  difficulty: 3,
  dueDate: '',
  status: 'ACTIVE'
};

const reviewRatings = [
  { value: 0, label: 'Again', hint: 'Restart the interval' },
  { value: 1, label: 'Hard', hint: 'Needs another pass' },
  { value: 2, label: 'Good', hint: 'Stick with the plan' },
  { value: 3, label: 'Easy', hint: 'Push it further out' }
];

const itemFilterOptions = [
  { value: 'all', label: 'All items' },
  { value: 'due', label: 'Due' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'random', label: 'Random' }
];

const sortOptions = [
  { value: 'due', label: 'Sort: Due' },
  { value: 'mastery', label: 'Sort: Mastery' },
  { value: 'recent', label: 'Sort: Recent' },
  { value: 'priority', label: 'Sort: Priority' }
];

export default function MindVaultPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [subjectForm, setSubjectForm] = useState(subjectDefaults);
  const [subjectEditId, setSubjectEditId] = useState(null);
  const [sprintForm, setSprintForm] = useState(sprintDefaults);
  const [sprintEditId, setSprintEditId] = useState(null);
  const [itemForm, setItemForm] = useState(itemDefaults);
  const [itemEditId, setItemEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [itemFilter, setItemFilter] = useState('all');
  const [sort, setSort] = useState('due');
  const [selectedQueueId, setSelectedQueueId] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiMindVaultOverview();
      setOverview(data);
      setSelectedQueueId((current) => {
        const queue = data?.queue || [];
        if (!queue.length) {
          return null;
        }
        return queue.some((item) => item.id === current) ? current : queue[0].id;
      });
      setShowAnswer(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiMindVaultOverview();
        if (cancelled) return;
        setOverview(data);
        setSelectedQueueId((current) => {
          const queue = data?.queue || [];
          if (!queue.length) {
            return null;
          }
          return queue.some((item) => item.id === current) ? current : queue[0].id;
        });
        setShowAnswer(false);
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
      }
      if (cancelled) return;
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const subjects = useMemo(() => overview?.subjects ?? [], [overview]);
  const sprints = useMemo(() => overview?.sprints ?? [], [overview]);
  const items = useMemo(() => overview?.items ?? [], [overview]);
  const queue = useMemo(() => overview?.queue ?? [], [overview]);
  const stats = useMemo(() => overview?.stats ?? {}, [overview]);
  const analytics = useMemo(() => overview?.analytics ?? { subjects: [], forecast: [] }, [overview]);
  const recentReviews = useMemo(() => overview?.recentReviews ?? [], [overview]);

  const selectedQueueItem = useMemo(() => {
    if (!queue.length) {
      return null;
    }
    return queue.find((item) => item.id === selectedQueueId) || queue[0];
  }, [queue, selectedQueueId]);

  const subjectOptions = useMemo(() => subjects.map((subject) => ({ value: String(subject.id), label: subject.title })), [subjects]);

  const sprintOptions = useMemo(() => {
    if (itemForm.subjectId === '') {
      return sprints;
    }
    return sprints.filter((sprint) => String(sprint.subjectId || '') === itemForm.subjectId);
  }, [sprints, itemForm.subjectId]);

  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (subjectFilter !== 'all' && String(item.subjectId || '') !== subjectFilter) {
          return false;
        }
        if (searchTerm) {
          const haystack = [
            item.title,
            item.prompt,
            item.answer,
            item.notes,
            item.subjectTitle,
            item.sprintTitle,
            ...(item.tags || [])
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(searchTerm)) {
            return false;
          }
        }
        switch (itemFilter) {
          case 'due':
            return item.dueToday || item.overdue;
          case 'overdue':
            return item.overdue;
          case 'mastered':
            return item.mastered;
          case 'random':
            return item.source === 'RANDOM';
          default:
            return true;
        }
      })
      .sort((left, right) => sortItems(left, right, sort));
  }, [items, search, subjectFilter, itemFilter, sort]);

  const openSubjectEditor = (subject) => {
    setSubjectEditId(subject.id);
    setSubjectForm({
      title: subject.title || '',
      description: subject.description || '',
      priority: subject.priority ?? 3,
      targetMastery: subject.targetMastery ?? 80,
      deadline: subject.deadline || '',
      tags: joinTags(subject.tags),
      archived: Boolean(subject.archived)
    });
  };

  const openSprintEditor = (sprint) => {
    setSprintEditId(sprint.id);
    setSprintForm({
      subjectId: sprint.subjectId ? String(sprint.subjectId) : '',
      title: sprint.title || '',
      description: sprint.description || '',
      status: sprint.status || 'PLANNED',
      startDate: sprint.startDate || '',
      dueDate: sprint.dueDate || '',
      estimatedSessions: sprint.estimatedSessions ?? 1,
      completedSessions: sprint.completedSessions ?? 0
    });
  };

  const openItemEditor = (item) => {
    setItemEditId(item.id);
    setItemForm({
      subjectId: item.subjectId ? String(item.subjectId) : '',
      sprintId: item.sprintId ? String(item.sprintId) : '',
      source: item.source || 'PLANNED',
      title: item.title || '',
      prompt: item.prompt || '',
      answer: item.answer || '',
      notes: item.notes || '',
      tags: joinTags(item.tags),
      priority: item.priority ?? 3,
      difficulty: item.difficulty ?? 3,
      dueDate: item.dueDate || '',
      status: item.status || 'ACTIVE'
    });
  };

  const quickAddItem = () => {
    setItemEditId(null);
    setItemForm({
      ...itemDefaults,
      subjectId: subjectFilter !== 'all' ? subjectFilter : '',
      sprintId: '',
      source: 'RANDOM'
    });
  };

  const resetForms = () => {
    setSubjectEditId(null);
    setSubjectForm(subjectDefaults);
    setSprintEditId(null);
    setSprintForm({
      ...sprintDefaults,
      subjectId: subjectFilter !== 'all' ? subjectFilter : ''
    });
    setItemEditId(null);
    setItemForm({
      ...itemDefaults,
      subjectId: subjectFilter !== 'all' ? subjectFilter : ''
    });
  };

  const submitSubject = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...subjectForm,
        tags: emptyToNull(subjectForm.tags),
        deadline: emptyToNull(subjectForm.deadline),
        title: subjectForm.title.trim(),
        description: emptyToNull(subjectForm.description)
      };
      if (subjectEditId) {
        await apiMindVaultUpdateSubject(subjectEditId, payload);
      } else {
        await apiMindVaultCreateSubject(payload);
      }
      await refresh();
      setSubjectEditId(null);
      setSubjectForm(subjectDefaults);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitSprint = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...sprintForm,
        subjectId: parseNullableId(sprintForm.subjectId),
        title: sprintForm.title.trim(),
        description: emptyToNull(sprintForm.description),
        startDate: emptyToNull(sprintForm.startDate),
        dueDate: emptyToNull(sprintForm.dueDate),
        estimatedSessions: Number(sprintForm.estimatedSessions) || 1,
        completedSessions: Number(sprintForm.completedSessions) || 0
      };
      if (!payload.subjectId) {
        throw new Error('Choose a subject for the sprint');
      }
      if (sprintEditId) {
        await apiMindVaultUpdateSprint(sprintEditId, payload);
      } else {
        await apiMindVaultCreateSprint(payload);
      }
      await refresh();
      setSprintEditId(null);
      setSprintForm({
        ...sprintDefaults,
        subjectId: subjectFilter !== 'all' ? subjectFilter : ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitItem = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...itemForm,
        subjectId: parseNullableId(itemForm.subjectId),
        sprintId: parseNullableId(itemForm.sprintId),
        title: itemForm.title.trim(),
        prompt: emptyToNull(itemForm.prompt),
        answer: emptyToNull(itemForm.answer),
        notes: emptyToNull(itemForm.notes),
        tags: emptyToNull(itemForm.tags),
        dueDate: emptyToNull(itemForm.dueDate),
        priority: Number(itemForm.priority) || 3,
        difficulty: Number(itemForm.difficulty) || 3,
        source: itemForm.source === 'RANDOM' ? 'RANDOM' : 'PLANNED',
        status: itemForm.status || 'ACTIVE'
      };
      if (itemEditId) {
        await apiMindVaultUpdateItem(itemEditId, payload);
      } else {
        await apiMindVaultCreateItem(payload);
      }
      await refresh();
      setItemEditId(null);
      setItemForm({
        ...itemDefaults,
        subjectId: subjectFilter !== 'all' ? subjectFilter : '',
        source: itemForm.source === 'RANDOM' ? 'RANDOM' : 'PLANNED'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteSubject = async (subject) => {
    if (!window.confirm(`Delete "${subject.title}"? This will detach linked sprints and topics.`)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiMindVaultDeleteSubject(subject.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteSprint = async (sprint) => {
    if (!window.confirm(`Delete sprint "${sprint.title}"? Linked topics will be detached.`)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiMindVaultDeleteSprint(sprint.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete topic "${item.title}"?`)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiMindVaultDeleteItem(item.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async (rating) => {
    if (!selectedQueueItem) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiMindVaultReviewItem(selectedQueueItem.id, {
        rating,
        note: emptyToNull(reviewNote)
      });
      setReviewNote('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const queueGoal = stats.dueToday || 0;
  const mindVault = {
    subjects,
    sprints,
    items,
    queue,
    stats,
    analytics,
    recentReviews,
    selectedQueueItem,
    selectedQueueId,
    setSelectedQueueId,
    showAnswer,
    setShowAnswer,
    reviewNote,
    setReviewNote,
    subjectForm,
    setSubjectForm,
    subjectEditId,
    sprintForm,
    setSprintForm,
    sprintEditId,
    itemForm,
    setItemForm,
    itemEditId,
    search,
    setSearch,
    subjectFilter,
    setSubjectFilter,
    itemFilter,
    setItemFilter,
    sort,
    setSort,
    subjectOptions,
    sprintOptions,
    filteredItems,
    queueGoal,
    busy,
    quickAddItem,
    resetForms,
    openSubjectEditor,
    openSprintEditor,
    openItemEditor,
    submitSubject,
    submitSprint,
    submitItem,
    deleteSubject,
    deleteSprint,
    deleteItem,
    submitReview
  };

  return (
    <section className="page mindvault-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">MindVault</p>
          <h2>Learning management with subjects, sprints, and spaced review.</h2>
          <p className="lead">
            Use separate pages for planning, library, review, and insights so each screen has one job.
          </p>
        </div>
      </div>

      <nav className="mindvault-subnav" aria-label="MindVault sections">
        <NavLink to="overview" className={({ isActive }) => `mindvault-subnav-link${isActive ? ' active' : ''}`}>
          Overview
        </NavLink>
        <NavLink to="plan" className={({ isActive }) => `mindvault-subnav-link${isActive ? ' active' : ''}`}>
          Plan
        </NavLink>
        <NavLink to="library" className={({ isActive }) => `mindvault-subnav-link${isActive ? ' active' : ''}`}>
          Library
        </NavLink>
        <NavLink to="queue" className={({ isActive }) => `mindvault-subnav-link${isActive ? ' active' : ''}`}>
          Review Queue
        </NavLink>
        <NavLink to="insights" className={({ isActive }) => `mindvault-subnav-link${isActive ? ' active' : ''}`}>
          Insights
        </NavLink>
      </nav>

      {error ? <div className="notice error">{error}</div> : null}
      {loading ? <div className="notice">Loading your learning plan...</div> : null}

      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<MindVaultOverviewPage mindVault={mindVault} />} />
        <Route path="plan" element={<MindVaultPlanPage mindVault={mindVault} />} />
        <Route path="library" element={<MindVaultLibraryPage mindVault={mindVault} />} />
        <Route path="queue" element={<MindVaultQueuePage mindVault={mindVault} />} />
        <Route path="insights" element={<MindVaultInsightsPage mindVault={mindVault} />} />
      </Routes>
    </section>
  );
}

function MindVaultOverviewPage({ mindVault }) {
  const { stats, queueGoal, recentReviews } = mindVault;

  return (
    <div className="mindvault-column">
      <div className="mindvault-hero">
        <StatCard label="Due today" value={stats.dueToday ?? 0} caption={`${queueGoal} items to review`} />
        <StatCard label="Overdue" value={stats.overdue ?? 0} caption="Needs immediate attention" />
        <StatCard label="Mastered" value={stats.mastered ?? 0} caption="Topics behind you now" />
        <StatCard label="Study streak" value={stats.studyStreak ?? 0} caption="Days with reviews in a row" />
      </div>

      <div className="card-grid">
        <article className="feature-card">
          <p className="eyebrow">Plan</p>
          <h3>Subjects and sprints</h3>
          <p>Map what to learn, attach a deadline, and keep the learning path small enough to finish.</p>
          <NavLink className="button" to="/vault/plan">
            Open plan
          </NavLink>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Library</p>
          <h3>Topics and random learning</h3>
          <p>Capture prompts, notes, and review cards in one searchable library.</p>
          <NavLink className="button" to="/vault/library">
            Open library
          </NavLink>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Queue</p>
          <h3>Daily review flow</h3>
          <p>Work through the items due today with a simple recall session.</p>
          <NavLink className="button" to="/vault/queue">
            Open queue
          </NavLink>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Insights</p>
          <h3>Forecast and mastery</h3>
          <p>See which subjects need attention and how the next few days are shaping up.</p>
          <NavLink className="button" to="/vault/insights">
            Open insights
          </NavLink>
        </article>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Recent reviews</p>
            <h3>Latest spaced-repetition activity</h3>
          </div>
          <span className="muted">{recentReviews.length} shown</span>
        </div>
        <div className="entity-list">
          {recentReviews.length === 0 ? <div className="empty-state">No recent reviews yet.</div> : null}
          {recentReviews.map((review) => (
            <article key={review.id} className="entity-card">
              <div className="entity-head">
                <div>
                  <strong>{review.itemTitle}</strong>
                  <p>{review.subjectTitle || 'Unassigned topic'}</p>
                </div>
                <Badge>Rating {review.rating}</Badge>
              </div>
              {review.note ? <p className="entity-copy">{review.note}</p> : null}
              <div className="chips">
                <Badge>Prev {review.previousIntervalDays}d</Badge>
                <Badge>Next {review.nextIntervalDays}d</Badge>
                <Badge>Mastery {review.masteryAfter}%</Badge>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MindVaultPlanPage({ mindVault }) {
  const {
    subjects,
    sprints,
    subjectForm,
    setSubjectForm,
    subjectEditId,
    sprintForm,
    setSprintForm,
    sprintEditId,
    subjectOptions,
    busy,
    resetForms,
    openSubjectEditor,
    openSprintEditor,
    deleteSubject,
    deleteSprint,
    submitSubject,
    submitSprint
  } = mindVault;

  return (
    <div className="mindvault-layout">
      <div className="mindvault-column">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Subjects</p>
              <h3>Plan the learning map</h3>
            </div>
            <button className="button secondary" type="button" onClick={resetForms}>
              Reset
            </button>
          </div>

          <form className="mindvault-form" onSubmit={submitSubject}>
            <div className="form-grid">
              <label className="field">
                <span>Subject</span>
                <input className="input" value={subjectForm.title} onChange={(event) => setSubjectForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Linear Algebra" />
              </label>
              <label className="field">
                <span>Priority</span>
                <input className="input" type="number" min="1" max="5" value={subjectForm.priority} onChange={(event) => setSubjectForm((current) => ({ ...current, priority: Number(event.target.value) }))} />
              </label>
            </div>
            <label className="field">
              <span>Description</span>
              <textarea className="input textarea" rows="3" value={subjectForm.description} onChange={(event) => setSubjectForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Target mastery</span>
                <input className="input" type="number" min="1" max="100" value={subjectForm.targetMastery} onChange={(event) => setSubjectForm((current) => ({ ...current, targetMastery: Number(event.target.value) }))} />
              </label>
              <label className="field">
                <span>Deadline</span>
                <input className="input" type="date" value={subjectForm.deadline} onChange={(event) => setSubjectForm((current) => ({ ...current, deadline: event.target.value }))} />
              </label>
            </div>
            <label className="field">
              <span>Tags</span>
              <input className="input" value={subjectForm.tags} onChange={(event) => setSubjectForm((current) => ({ ...current, tags: event.target.value }))} placeholder="math, semester-2" />
            </label>
            <label className="field checkbox">
              <input type="checkbox" checked={subjectForm.archived} onChange={(event) => setSubjectForm((current) => ({ ...current, archived: event.target.checked }))} />
              <span>Archive subject</span>
            </label>
            <div className="form-actions">
              <button className="button" disabled={busy} type="submit">
                {subjectEditId ? 'Update subject' : 'Create subject'}
              </button>
              <button className="button secondary" type="button" onClick={() => setSubjectForm(subjectDefaults)}>
                Clear
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Subject list</p>
              <h3>Track mastery and deadlines</h3>
            </div>
            <span className="muted">{subjects.length} subjects</span>
          </div>
          <div className="entity-list">
            {subjects.length === 0 ? <div className="empty-state">Create a subject to anchor the first sprint.</div> : null}
            {subjects.map((subject) => (
              <article key={subject.id} className="entity-card">
                <div className="entity-head">
                  <div>
                    <strong>{subject.title}</strong>
                    <p>{subject.description || 'No description yet.'}</p>
                  </div>
                  <div className="card-actions">
                    <button className="text-button" onClick={() => openSubjectEditor(subject)}>
                      Edit
                    </button>
                    <button className="text-button danger" onClick={() => deleteSubject(subject)}>
                      Delete
                    </button>
                  </div>
                </div>
                <div className="chips">
                  <Badge>{subject.archived ? 'Archived' : 'Active'}</Badge>
                  <Badge>{subject.itemCount} topics</Badge>
                  <Badge>{subject.masteredCount} mastered</Badge>
                  <Badge>{subject.dueCount} due</Badge>
                  <Badge>Target {subject.targetMastery}%</Badge>
                </div>
                <ProgressRow label="Mastery" value={subject.averageMastery} target={subject.targetMastery || 100} />
                {subject.deadline ? <p className="muted">Deadline {formatDate(subject.deadline)}</p> : null}
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="mindvault-column">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Sprints</p>
              <h3>Work in learning sprints</h3>
            </div>
            <span className="muted">{sprints.length} sprints</span>
          </div>

          <form className="mindvault-form" onSubmit={submitSprint}>
            <div className="form-grid">
              <label className="field">
                <span>Subject</span>
                <select className="input" value={sprintForm.subjectId} onChange={(event) => setSprintForm((current) => ({ ...current, subjectId: event.target.value }))}>
                  <option value="">Choose a subject</option>
                  {subjectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select className="input" value={sprintForm.status} onChange={(event) => setSprintForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="PLANNED">PLANNED</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Sprint title</span>
              <input className="input" value={sprintForm.title} onChange={(event) => setSprintForm((current) => ({ ...current, title: event.target.value }))} placeholder="Sprint 1 - Core concepts" />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea className="input textarea" rows="3" value={sprintForm.description} onChange={(event) => setSprintForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Start date</span>
                <input className="input" type="date" value={sprintForm.startDate} onChange={(event) => setSprintForm((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label className="field">
                <span>Due date</span>
                <input className="input" type="date" value={sprintForm.dueDate} onChange={(event) => setSprintForm((current) => ({ ...current, dueDate: event.target.value }))} />
              </label>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Estimated sessions</span>
                <input className="input" type="number" min="1" value={sprintForm.estimatedSessions} onChange={(event) => setSprintForm((current) => ({ ...current, estimatedSessions: Number(event.target.value) }))} />
              </label>
              <label className="field">
                <span>Completed sessions</span>
                <input className="input" type="number" min="0" value={sprintForm.completedSessions} onChange={(event) => setSprintForm((current) => ({ ...current, completedSessions: Number(event.target.value) }))} />
              </label>
            </div>
            <div className="form-actions">
              <button className="button" disabled={busy} type="submit">
                {sprintEditId ? 'Update sprint' : 'Create sprint'}
              </button>
              <button className="button secondary" type="button" onClick={() => setSprintForm({ ...sprintDefaults, subjectId: '' })}>
                Clear
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Sprint list</p>
              <h3>Keep deadlines visible</h3>
            </div>
            <span className="muted">{sprints.length} sprints</span>
          </div>
          <div className="entity-list">
            {sprints.length === 0 ? <div className="empty-state">Break a subject into a sprint to add deadlines.</div> : null}
            {sprints.map((sprint) => (
              <article key={sprint.id} className="entity-card">
                <div className="entity-head">
                  <div>
                    <strong>{sprint.title}</strong>
                    <p>
                      {sprint.subjectTitle || 'No subject'} {sprint.description ? `• ${sprint.description}` : ''}
                    </p>
                  </div>
                  <div className="card-actions">
                    <button className="text-button" onClick={() => openSprintEditor(sprint)}>
                      Edit
                    </button>
                    <button className="text-button danger" onClick={() => deleteSprint(sprint)}>
                      Delete
                    </button>
                  </div>
                </div>
                <div className="chips">
                  <Badge>{sprint.status}</Badge>
                  <Badge>{sprint.itemCount} topics</Badge>
                  <Badge>{sprint.masteredCount} mastered</Badge>
                  <Badge>{sprint.dueCount} due</Badge>
                </div>
                <ProgressRow label="Sprint progress" value={sprint.progress} target={100} />
                <p className="muted">
                  {sprint.startDate ? `Starts ${formatDate(sprint.startDate)} • ` : ''}
                  {sprint.dueDate ? `Due ${formatDate(sprint.dueDate)}` : 'No deadline'}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MindVaultLibraryPage({ mindVault }) {
  const {
    subjects,
    sprintOptions,
    itemForm,
    setItemForm,
    itemEditId,
    search,
    setSearch,
    subjectFilter,
    setSubjectFilter,
    itemFilter,
    setItemFilter,
    sort,
    setSort,
    filteredItems,
    busy,
    quickAddItem,
    resetForms,
    openItemEditor,
    deleteItem,
    submitItem,
    setSelectedQueueId
  } = mindVault;

  return (
    <div className="mindvault-layout">
      <div className="mindvault-column">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Library</p>
              <h3>Capture topics and random learning</h3>
            </div>
            <div className="mindvault-actions">
              <button className="button secondary" type="button" onClick={quickAddItem}>
                Quick add topic
              </button>
              <button className="button secondary" type="button" onClick={resetForms}>
                Reset
              </button>
            </div>
          </div>

          <form className="mindvault-form" onSubmit={submitItem}>
            <div className="form-grid">
              <label className="field">
                <span>Source</span>
                <select className="input" value={itemForm.source} onChange={(event) => setItemForm((current) => ({ ...current, source: event.target.value }))}>
                  <option value="PLANNED">PLANNED</option>
                  <option value="RANDOM">RANDOM</option>
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select className="input" value={itemForm.status} onChange={(event) => setItemForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MASTERED">MASTERED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Subject</span>
                <select className="input" value={itemForm.subjectId} onChange={(event) => setItemForm((current) => ({ ...current, subjectId: event.target.value }))}>
                  <option value="">No subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={String(subject.id)}>
                      {subject.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Sprint</span>
                <select className="input" value={itemForm.sprintId} onChange={(event) => setItemForm((current) => ({ ...current, sprintId: event.target.value }))}>
                  <option value="">No sprint</option>
                  {sprintOptions.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Topic title</span>
              <input className="input" value={itemForm.title} onChange={(event) => setItemForm((current) => ({ ...current, title: event.target.value }))} placeholder="Merges in red-black trees" />
            </label>
            <label className="field">
              <span>Prompt</span>
              <textarea className="input textarea" rows="3" value={itemForm.prompt} onChange={(event) => setItemForm((current) => ({ ...current, prompt: event.target.value }))} placeholder="What should I recall before reading the answer?" />
            </label>
            <label className="field">
              <span>Answer / notes</span>
              <textarea className="input textarea" rows="4" value={itemForm.answer} onChange={(event) => setItemForm((current) => ({ ...current, answer: event.target.value }))} placeholder="Write the actual explanation, formula, steps, or summary." />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Priority</span>
                <input className="input" type="number" min="1" max="5" value={itemForm.priority} onChange={(event) => setItemForm((current) => ({ ...current, priority: Number(event.target.value) }))} />
              </label>
              <label className="field">
                <span>Difficulty</span>
                <input className="input" type="number" min="1" max="5" value={itemForm.difficulty} onChange={(event) => setItemForm((current) => ({ ...current, difficulty: Number(event.target.value) }))} />
              </label>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Deadline</span>
                <input className="input" type="date" value={itemForm.dueDate} onChange={(event) => setItemForm((current) => ({ ...current, dueDate: event.target.value }))} />
              </label>
              <label className="field">
                <span>Tags</span>
                <input className="input" value={itemForm.tags} onChange={(event) => setItemForm((current) => ({ ...current, tags: event.target.value }))} placeholder="arrays, exam-3" />
              </label>
            </div>
            <label className="field">
              <span>Study notes</span>
              <textarea className="input textarea" rows="3" value={itemForm.notes} onChange={(event) => setItemForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Short context, mnemonics, or mistakes to avoid." />
            </label>
            <div className="form-actions">
              <button className="button" disabled={busy} type="submit">
                {itemEditId ? 'Update topic' : 'Create topic'}
              </button>
              <button className="button secondary" type="button" onClick={() => setItemForm({ ...itemDefaults, subjectId: subjectFilter !== 'all' ? subjectFilter : '' })}>
                Clear
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className="mindvault-column">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Library list</p>
              <h3>Search and study topics</h3>
            </div>
            <span className="muted">{filteredItems.length} shown</span>
          </div>

          <div className="filter-bar">
            <input className="input" placeholder="Search topics, prompts, notes, or tags" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="input" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="all">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={String(subject.id)}>
                  {subject.title}
                </option>
              ))}
            </select>
            <select className="input" value={itemFilter} onChange={(event) => setItemFilter(event.target.value)}>
              {itemFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="entity-list">
            {filteredItems.length === 0 ? <div className="empty-state">No topics match the current filters.</div> : null}
            {filteredItems.map((item) => (
              <article key={item.id} className="entity-card">
                <div className="entity-head">
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.subjectTitle || 'Random learning'} {item.sprintTitle ? `• ${item.sprintTitle}` : ''}
                    </p>
                  </div>
                  <div className="card-actions">
                    <button className="text-button" onClick={() => openItemEditor(item)}>
                      Edit
                    </button>
                    <button className="text-button" onClick={() => setSelectedQueueId(item.id)}>
                      Study
                    </button>
                    <button className="text-button danger" onClick={() => deleteItem(item)}>
                      Delete
                    </button>
                  </div>
                </div>
                <p className="entity-copy">{item.prompt || item.notes || 'No prompt yet.'}</p>
                <div className="chips">
                  <Badge>{item.source}</Badge>
                  <Badge>{item.status}</Badge>
                  {item.mastered ? <Badge>Mastered</Badge> : null}
                  {item.overdue ? <Badge>Overdue</Badge> : null}
                  {item.dueToday ? <Badge>Due today</Badge> : null}
                  <Badge>Mastery {item.masteryScore}%</Badge>
                  <Badge>Difficulty {item.difficulty}/5</Badge>
                  <Badge>Interval {item.reviewIntervalDays}d</Badge>
                  {item.queueReason ? <Badge>{item.queueReason}</Badge> : null}
                </div>
                <ProgressRow label="Mastery" value={item.masteryScore} target={100} />
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MindVaultQueuePage({ mindVault }) {
  const {
    queue,
    selectedQueueItem,
    selectedQueueId,
    setSelectedQueueId,
    showAnswer,
    setShowAnswer,
    reviewNote,
    setReviewNote,
    submitReview,
    busy
  } = mindVault;

  return (
    <div className="mindvault-layout">
      <div className="mindvault-column">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Daily queue</p>
              <h3>Review what matters today</h3>
            </div>
            <span className="muted">{queue.length} queued</span>
          </div>

          <div className="queue-list">
            {queue.length === 0 ? <div className="empty-state">Everything is caught up. Add new topics or a random learning item.</div> : null}
            {queue.map((item) => (
              <button
                key={item.id}
                className={`queue-item${item.id === selectedQueueId ? ' active' : ''}`}
                onClick={() => {
                  setSelectedQueueId(item.id);
                  setShowAnswer(false);
                }}
              >
                <strong>{item.title}</strong>
                <span>{item.queueReason || 'due now'}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="mindvault-column">
        {selectedQueueItem ? (
          <section className="panel study-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Study session</p>
                <h3>{selectedQueueItem.title}</h3>
              </div>
              <button className="button secondary" type="button" onClick={() => setShowAnswer((current) => !current)}>
                {showAnswer ? 'Hide answer' : 'Reveal answer'}
              </button>
            </div>
            <div className="chips">
              <Badge>{selectedQueueItem.subjectTitle || 'Random'}</Badge>
              {selectedQueueItem.sprintTitle ? <Badge>{selectedQueueItem.sprintTitle}</Badge> : null}
              {selectedQueueItem.queueReason ? <Badge>{selectedQueueItem.queueReason}</Badge> : null}
            </div>
            <div className="flashcard">
              <div className="flashcard-side prompt">
                <p>{selectedQueueItem.prompt || 'No prompt yet. Use the answer as your recall cue.'}</p>
              </div>
              <div className={`flashcard-side answer${showAnswer ? ' revealed' : ''}`}>
                <p>{showAnswer ? selectedQueueItem.answer || 'No answer saved yet.' : 'Reveal the answer after you try recalling it.'}</p>
              </div>
            </div>
            <label className="field">
              <span>Review note</span>
              <textarea className="input textarea" rows="3" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="What was easy, what was hard, what to fix next time?" />
            </label>
            <div className="review-actions">
              {reviewRatings.map((rating) => (
                <button key={rating.value} className={`rating-button rating-${rating.value}`} type="button" onClick={() => submitReview(rating.value)} disabled={busy}>
                  <strong>{rating.label}</strong>
                  <span>{rating.hint}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="empty-state">Pick an item from the queue to start a study session.</div>
          </section>
        )}
      </div>
    </div>
  );
}

function MindVaultInsightsPage({ mindVault }) {
  const { analytics, stats } = mindVault;

  return (
    <div className="mindvault-layout">
      <div className="mindvault-column">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Insights</p>
              <h3>Subject load and forecast</h3>
            </div>
            <span className="muted">{stats.reviewsThisWeek || 0} reviews this week</span>
          </div>
          <div className="insight-grid">
            {analytics.subjects.map((subject) => (
              <article key={subject.subjectId} className="insight-card">
                <div className="entity-head">
                  <strong>{subject.title}</strong>
                  <span className="muted">{subject.itemCount} topics</span>
                </div>
                <ProgressRow label="Average mastery" value={subject.averageMastery} target={subject.targetMastery || 100} />
                <div className="chips">
                  <Badge>{subject.masteredCount} mastered</Badge>
                  <Badge>{subject.dueCount} due</Badge>
                  {subject.deadline ? <Badge>Due {formatDate(subject.deadline)}</Badge> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="mindvault-column">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Forecast</p>
              <h3>Next review load</h3>
            </div>
          </div>
          <div className="forecast-grid">
            {analytics.forecast.map((point) => (
              <div key={point.date} className="forecast-item">
                <span>{formatShortDate(point.date)}</span>
                <div className="forecast-bar">
                  <div className="forecast-fill" style={{ width: `${Math.min(100, point.count * 12)}%` }} />
                </div>
                <strong>{point.count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, caption }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{caption}</p>
    </article>
  );
}

function ProgressRow({ label, value, target }) {
  const percent = Math.max(0, Math.min(100, Math.round((Number(value) / Math.max(1, Number(target))) * 100)));
  return (
    <div>
      <div className="progress-row-head">
        <span>{label}</span>
        <strong>
          {value}/{target}
        </strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Badge({ children }) {
  return <span className="pill">{children}</span>;
}

function sortItems(left, right, sort) {
  switch (sort) {
    case 'mastery':
      return (right.masteryScore || 0) - (left.masteryScore || 0);
    case 'recent':
      return new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
    case 'priority':
      return (right.priority || 0) - (left.priority || 0);
    case 'due':
    default:
      return new Date(left.nextReviewDate || left.dueDate || 0) - new Date(right.nextReviewDate || right.dueDate || 0);
  }
}

function formatDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function joinTags(tags) {
  if (!tags?.length) {
    return '';
  }
  return tags.join(', ');
}

function emptyToNull(value) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function parseNullableId(value) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
