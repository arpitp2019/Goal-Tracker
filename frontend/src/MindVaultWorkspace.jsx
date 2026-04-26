import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  apiMindVaultCreateItem,
  apiMindVaultCreateResource,
  apiMindVaultCreateSprint,
  apiMindVaultCreateSubject,
  apiMindVaultDeleteItem,
  apiMindVaultDeleteResource,
  apiMindVaultDeleteSprint,
  apiMindVaultDeleteSubject,
  apiMindVaultOverview,
  apiMindVaultReviewItem,
  apiMindVaultUpdateItem,
  apiMindVaultUpdateSprint,
  apiMindVaultUpdateSubject,
  apiMindVaultUploadResource
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
  learningType: 'IMPORTANT_TOPIC',
  subjectId: '',
  sprintId: '',
  title: '',
  prompt: '',
  answer: '',
  notes: '',
  tags: '',
  importance: 3,
  difficulty: 3,
  sourceLabel: '',
  reviewEnabled: true,
  dueDate: '',
  status: 'ACTIVE'
};

const resourceDefaults = {
  resourceType: 'TEXT',
  title: '',
  description: '',
  url: '',
  file: null
};

const reviewRatings = [
  { value: 0, label: 'Again', hint: 'Review tomorrow' },
  { value: 1, label: 'Hard', hint: 'Keep it close' },
  { value: 2, label: 'Good', hint: 'Extend the interval' },
  { value: 3, label: 'Easy', hint: 'Push it further out' }
];

const libraryFilters = [
  { value: 'all', label: 'All' },
  { value: 'important', label: 'Important' },
  { value: 'random', label: 'Random' },
  { value: 'due', label: 'Due' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'archived', label: 'Archived' },
  { value: 'resources', label: 'Has resources' }
];

export default function MindVaultPage() {
  const location = useLocation();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [itemForm, setItemForm] = useState(itemDefaults);
  const [itemEditId, setItemEditId] = useState(null);
  const [resourceForm, setResourceForm] = useState(resourceDefaults);
  const [subjectForm, setSubjectForm] = useState(subjectDefaults);
  const [subjectEditId, setSubjectEditId] = useState(null);
  const [sprintForm, setSprintForm] = useState(sprintDefaults);
  const [sprintEditId, setSprintEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [selectedQueueId, setSelectedQueueId] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiMindVaultOverview();
      setOverview(data);
      setSelectedQueueId((current) => firstQueueId(data?.queue || [], current));
      setShowAnswer(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const subjects = useMemo(() => overview?.subjects ?? [], [overview]);
  const sprints = useMemo(() => overview?.sprints ?? [], [overview]);
  const items = useMemo(() => overview?.items ?? [], [overview]);
  const queue = useMemo(() => overview?.queue ?? [], [overview]);
  const stats = useMemo(() => overview?.stats ?? {}, [overview]);
  const analytics = useMemo(() => overview?.analytics ?? { subjects: [], forecast: [] }, [overview]);
  const recentReviews = useMemo(() => overview?.recentReviews ?? [], [overview]);

  const sprintOptions = useMemo(() => {
    if (!itemForm.subjectId) {
      return sprints;
    }
    return sprints.filter((sprint) => String(sprint.subjectId || '') === itemForm.subjectId);
  }, [sprints, itemForm.subjectId]);

  const selectedQueueItem = useMemo(() => {
    if (!queue.length) return null;
    return queue.find((item) => item.id === selectedQueueId) || queue[0];
  }, [queue, selectedQueueId]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (subjectFilter !== 'all' && String(item.subjectId || '') !== subjectFilter) return false;
        if (term && !itemSearchText(item).includes(term)) return false;
        if (filter === 'important') return item.learningType === 'IMPORTANT_TOPIC';
        if (filter === 'random') return item.learningType === 'RANDOM_LEARNING' || item.source === 'RANDOM';
        if (filter === 'due') return item.dueToday || item.overdue;
        if (filter === 'mastered') return item.mastered;
        if (filter === 'archived') return item.status === 'ARCHIVED';
        if (filter === 'resources') return (item.resources || []).length > 0;
        return true;
      })
      .sort((left, right) => new Date(left.nextReviewDate || left.dueDate || 0) - new Date(right.nextReviewDate || right.dueDate || 0));
  }, [items, search, filter, subjectFilter]);

  const weakItems = useMemo(() => {
    return items
      .filter((item) => item.status !== 'ARCHIVED')
      .sort((left, right) => (left.masteryScore || 0) - (right.masteryScore || 0) || (right.difficulty || 0) - (left.difficulty || 0))
      .slice(0, 5);
  }, [items]);

  const forgottenItems = useMemo(() => {
    return items
      .filter((item) => item.reviewCount > 0 || item.lapseCount > 0)
      .sort((left, right) => (right.lapseCount || 0) - (left.lapseCount || 0) || (left.masteryScore || 0) - (right.masteryScore || 0))
      .slice(0, 5);
  }, [items]);

  const submitItem = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isFileResource(resourceForm.resourceType) && resourceForm.file && overview?.stats?.fileUploadsEnabled !== true) {
        throw new Error('File uploads need Supabase Storage env vars on Render. Text and link resources can be saved now.');
      }
      const payload = itemPayload(itemForm);
      const saved = itemEditId ? await apiMindVaultUpdateItem(itemEditId, payload) : await apiMindVaultCreateItem(payload);
      await saveResourceIfPresent(saved.id, resourceForm);
      setItemEditId(null);
      setItemForm(itemDefaults);
      setResourceForm(resourceDefaults);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitSubject = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...subjectForm,
        title: subjectForm.title.trim(),
        description: emptyToNull(subjectForm.description),
        deadline: emptyToNull(subjectForm.deadline),
        tags: emptyToNull(subjectForm.tags)
      };
      if (subjectEditId) {
        await apiMindVaultUpdateSubject(subjectEditId, payload);
      } else {
        await apiMindVaultCreateSubject(payload);
      }
      setSubjectEditId(null);
      setSubjectForm(subjectDefaults);
      await refresh();
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
      if (!payload.subjectId) throw new Error('Choose a subject for the sprint');
      if (sprintEditId) {
        await apiMindVaultUpdateSprint(sprintEditId, payload);
      } else {
        await apiMindVaultCreateSprint(payload);
      }
      setSprintEditId(null);
      setSprintForm(sprintDefaults);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async (rating) => {
    if (!selectedQueueItem) return;
    setBusy(true);
    setError('');
    try {
      await apiMindVaultReviewItem(selectedQueueItem.id, { rating, note: emptyToNull(reviewNote) });
      setReviewNote('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openItemEditor = (item) => {
    setItemEditId(item.id);
    setItemForm({
      learningType: item.learningType || (item.source === 'RANDOM' ? 'RANDOM_LEARNING' : 'IMPORTANT_TOPIC'),
      subjectId: item.subjectId ? String(item.subjectId) : '',
      sprintId: item.sprintId ? String(item.sprintId) : '',
      title: item.title || '',
      prompt: item.prompt || '',
      answer: item.answer || '',
      notes: item.notes || '',
      tags: joinTags(item.tags),
      importance: item.importance ?? item.priority ?? 3,
      difficulty: item.difficulty ?? 3,
      sourceLabel: item.sourceLabel || '',
      reviewEnabled: item.reviewEnabled !== false,
      dueDate: item.dueDate || '',
      status: item.status || 'ACTIVE'
    });
    setResourceForm(resourceDefaults);
  };

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

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setBusy(true);
    try {
      await apiMindVaultDeleteItem(item.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteResource = async (resource) => {
    setBusy(true);
    try {
      await apiMindVaultDeleteResource(resource.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteSubject = async (subject) => {
    if (!window.confirm(`Delete "${subject.title}"? Linked topics will stay in the library.`)) return;
    setBusy(true);
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
    if (!window.confirm(`Delete "${sprint.title}"? Linked topics will stay in the library.`)) return;
    setBusy(true);
    try {
      await apiMindVaultDeleteSprint(sprint.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const section = location.pathname.split('/').filter(Boolean).at(-1);
  const activeSection = ['inbox', 'review', 'library', 'subjects', 'insights'].includes(section) ? section : '';

  const context = {
    subjects,
    sprints,
    items,
    queue,
    stats,
    analytics,
    recentReviews,
    weakItems,
    forgottenItems,
    filteredItems,
    sprintOptions,
    selectedQueueItem,
    selectedQueueId,
    setSelectedQueueId,
    showAnswer,
    setShowAnswer,
    reviewNote,
    setReviewNote,
    itemForm,
    setItemForm,
    itemEditId,
    resourceForm,
    setResourceForm,
    subjectForm,
    setSubjectForm,
    subjectEditId,
    sprintForm,
    setSprintForm,
    sprintEditId,
    search,
    setSearch,
    filter,
    setFilter,
    subjectFilter,
    setSubjectFilter,
    busy,
    submitItem,
    submitReview,
    submitSubject,
    submitSprint,
    openItemEditor,
    openSubjectEditor,
    openSprintEditor,
    deleteItem,
    deleteResource,
    deleteSubject,
    deleteSprint,
    resetCapture: () => {
      setItemEditId(null);
      setItemForm(itemDefaults);
      setResourceForm(resourceDefaults);
    }
  };

  return (
    <section className="page mindvault-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">MindVault</p>
          <h2>Capture learning, then let the review queue bring it back.</h2>
          <p className="lead">A lightweight LMS for important topics, random learning, resources, and spaced repetition.</p>
        </div>
      </div>

      <nav className="mindvault-subnav" aria-label="MindVault sections">
        <NavLink to="/vault/inbox" className={({ isActive }) => `mindvault-subnav-link${isActive ? ' active' : ''}`}>Inbox</NavLink>
        <NavLink to="/vault/review" className={({ isActive }) => `mindvault-subnav-link${isActive ? ' active' : ''}`}>Review</NavLink>
        <NavLink to="/vault/library" className={({ isActive }) => `mindvault-subnav-link${isActive ? ' active' : ''}`}>Library</NavLink>
        <NavLink to="/vault/subjects" className={({ isActive }) => `mindvault-subnav-link${isActive ? ' active' : ''}`}>Subjects</NavLink>
        <NavLink to="/vault/insights" className={({ isActive }) => `mindvault-subnav-link${isActive ? ' active' : ''}`}>Insights</NavLink>
      </nav>

      {error ? <div className="notice error">{error}</div> : null}
      {loading ? <div className="notice">Loading MindVault...</div> : null}

      {activeSection === '' ? <Navigate to="/vault/review" replace /> : null}
      {activeSection === 'inbox' ? <InboxPage mindVault={context} /> : null}
      {activeSection === 'review' ? <ReviewPage mindVault={context} /> : null}
      {activeSection === 'library' ? <LibraryPage mindVault={context} /> : null}
      {activeSection === 'subjects' ? <SubjectsPage mindVault={context} /> : null}
      {activeSection === 'insights' ? <InsightsPage mindVault={context} /> : null}
    </section>
  );
}

function InboxPage({ mindVault }) {
  return (
    <div className="mindvault-layout lms-layout">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Inbox</p>
            <h3>Capture today&apos;s learning</h3>
          </div>
          <button className="button secondary" type="button" onClick={mindVault.resetCapture}>Clear</button>
        </div>
        <CaptureForm mindVault={mindVault} submitLabel={mindVault.itemEditId ? 'Update learning' : 'Save learning'} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Today</p>
            <h3>What this system is tracking</h3>
          </div>
        </div>
        <div className="mindvault-hero compact">
          <StatCard label="Learned this week" value={mindVault.stats.learnedThisWeek ?? 0} caption="New entries" />
          <StatCard label="Resources" value={mindVault.stats.resourceCount ?? 0} caption="Files, links, notes" />
          <StatCard label="Due today" value={mindVault.stats.dueToday ?? 0} caption="Review load" />
          <StatCard label="Overdue" value={mindVault.stats.overdue ?? 0} caption="Needs attention" />
        </div>
        <div className="entity-list">
          {mindVault.items.slice(0, 5).map((item) => (
            <LearningCard key={item.id} item={item} compact onEdit={() => mindVault.openItemEditor(item)} />
          ))}
          {mindVault.items.length === 0 ? <div className="empty-state">Start with one thing you learned today.</div> : null}
        </div>
      </section>
    </div>
  );
}

function ReviewPage({ mindVault }) {
  const item = mindVault.selectedQueueItem;
  return (
    <div className="mindvault-layout lms-layout">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Review</p>
            <h3>Due queue</h3>
          </div>
          <span className="muted">{mindVault.queue.length} queued</span>
        </div>
        <div className="queue-list">
          {mindVault.queue.map((queueItem) => (
            <button
              key={queueItem.id}
              className={`queue-item${queueItem.id === mindVault.selectedQueueId ? ' active' : ''}`}
              onClick={() => {
                mindVault.setSelectedQueueId(queueItem.id);
                mindVault.setShowAnswer(false);
              }}
            >
              <strong>{queueItem.title}</strong>
              <span>{queueItem.queueReason || 'review'} - mastery {queueItem.masteryScore}%</span>
            </button>
          ))}
          {mindVault.queue.length === 0 ? <div className="empty-state">No reviews due. Capture something new or enjoy the quiet.</div> : null}
        </div>
      </section>

      <section className="panel study-panel">
        {item ? (
          <>
            <div className="panel-header">
              <div>
                <p className="eyebrow">{learningTypeLabel(item)}</p>
                <h3>{item.title}</h3>
              </div>
              <button className="button secondary" type="button" onClick={() => mindVault.setShowAnswer((current) => !current)}>
                {mindVault.showAnswer ? 'Hide answer' : 'Reveal answer'}
              </button>
            </div>
            <div className="flashcard">
              <div className="flashcard-side prompt">
                <p>{item.prompt || 'Recall the main idea before revealing the answer.'}</p>
              </div>
              <div className={`flashcard-side answer${mindVault.showAnswer ? ' revealed' : ''}`}>
                <p>{mindVault.showAnswer ? item.answer || item.notes || 'No answer saved yet.' : 'Answer hidden until you try to recall it.'}</p>
              </div>
            </div>
            <ResourceList resources={item.resources || []} onDelete={mindVault.deleteResource} readonly />
            <label className="field">
              <span>Review note</span>
              <textarea className="input textarea" rows="3" value={mindVault.reviewNote} onChange={(event) => mindVault.setReviewNote(event.target.value)} placeholder="What did I forget or remember?" />
            </label>
            <div className="review-actions">
              {reviewRatings.map((rating) => (
                <button key={rating.value} className={`rating-button rating-${rating.value}`} type="button" onClick={() => mindVault.submitReview(rating.value)} disabled={mindVault.busy}>
                  <strong>{rating.label}</strong>
                  <span>{rating.hint}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">No due cards selected.</div>
        )}
      </section>
    </div>
  );
}

function LibraryPage({ mindVault }) {
  return (
    <div className="mindvault-column">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Library</p>
            <h3>Search all learning records</h3>
          </div>
          <span className="muted">{mindVault.filteredItems.length} shown</span>
        </div>
        <div className="filter-bar">
          <input className="input" placeholder="Search title, prompt, answer, notes, tags" value={mindVault.search} onChange={(event) => mindVault.setSearch(event.target.value)} />
          <select className="input" value={mindVault.filter} onChange={(event) => mindVault.setFilter(event.target.value)}>
            {libraryFilters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="input" value={mindVault.subjectFilter} onChange={(event) => mindVault.setSubjectFilter(event.target.value)}>
            <option value="all">All subjects</option>
            {mindVault.subjects.map((subject) => <option key={subject.id} value={String(subject.id)}>{subject.title}</option>)}
          </select>
        </div>
      </section>
      <section className="entity-list">
        {mindVault.filteredItems.map((item) => (
          <LearningCard
            key={item.id}
            item={item}
            onEdit={() => mindVault.openItemEditor(item)}
            onDelete={() => mindVault.deleteItem(item)}
            onStudy={() => mindVault.setSelectedQueueId(item.id)}
            onResourceDelete={mindVault.deleteResource}
          />
        ))}
        {mindVault.filteredItems.length === 0 ? <div className="panel empty-state">No learning records match this view.</div> : null}
      </section>
    </div>
  );
}

function SubjectsPage({ mindVault }) {
  return (
    <div className="mindvault-layout lms-layout">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Subjects</p>
            <h3>Structured learning map</h3>
          </div>
        </div>
        <form className="mindvault-form" onSubmit={mindVault.submitSubject}>
          <div className="form-grid">
            <label className="field">
              <span>Subject</span>
              <input className="input" value={mindVault.subjectForm.title} onChange={(event) => mindVault.setSubjectForm((current) => ({ ...current, title: event.target.value }))} placeholder="Java backend" />
            </label>
            <label className="field">
              <span>Target mastery</span>
              <input className="input" type="number" min="1" max="100" value={mindVault.subjectForm.targetMastery} onChange={(event) => mindVault.setSubjectForm((current) => ({ ...current, targetMastery: Number(event.target.value) }))} />
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea className="input textarea" rows="3" value={mindVault.subjectForm.description} onChange={(event) => mindVault.setSubjectForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Deadline</span>
              <input className="input" type="date" value={mindVault.subjectForm.deadline} onChange={(event) => mindVault.setSubjectForm((current) => ({ ...current, deadline: event.target.value }))} />
            </label>
            <label className="field">
              <span>Tags</span>
              <input className="input" value={mindVault.subjectForm.tags} onChange={(event) => mindVault.setSubjectForm((current) => ({ ...current, tags: event.target.value }))} />
            </label>
          </div>
          <div className="form-actions">
            <button className="button" disabled={mindVault.busy} type="submit">{mindVault.subjectEditId ? 'Update subject' : 'Create subject'}</button>
          </div>
        </form>

        <form className="mindvault-form" onSubmit={mindVault.submitSprint}>
          <div className="form-grid">
            <label className="field">
              <span>Subject</span>
              <select className="input" value={mindVault.sprintForm.subjectId} onChange={(event) => mindVault.setSprintForm((current) => ({ ...current, subjectId: event.target.value }))}>
                <option value="">Choose subject</option>
                {mindVault.subjects.map((subject) => <option key={subject.id} value={String(subject.id)}>{subject.title}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Sprint title</span>
              <input className="input" value={mindVault.sprintForm.title} onChange={(event) => mindVault.setSprintForm((current) => ({ ...current, title: event.target.value }))} placeholder="Week 1 concepts" />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Status</span>
              <select className="input" value={mindVault.sprintForm.status} onChange={(event) => mindVault.setSprintForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="PLANNED">PLANNED</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </label>
            <label className="field">
              <span>Due date</span>
              <input className="input" type="date" value={mindVault.sprintForm.dueDate} onChange={(event) => mindVault.setSprintForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea className="input textarea" rows="2" value={mindVault.sprintForm.description} onChange={(event) => mindVault.setSprintForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="form-actions">
            <button className="button secondary" disabled={mindVault.busy} type="submit">{mindVault.sprintEditId ? 'Update sprint' : 'Create sprint'}</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Map</p>
            <h3>Subjects and sprints</h3>
          </div>
        </div>
        <div className="entity-list">
          {mindVault.subjects.map((subject) => (
            <article key={subject.id} className="entity-card">
              <div className="entity-head">
                <div>
                  <strong>{subject.title}</strong>
                  <p>{subject.description || 'No description yet.'}</p>
                </div>
                <div className="card-actions">
                  <button className="text-button" type="button" onClick={() => mindVault.openSubjectEditor(subject)}>Edit</button>
                  <button className="text-button danger" type="button" onClick={() => mindVault.deleteSubject(subject)}>Delete</button>
                </div>
              </div>
              <ProgressRow label="Mastery" value={subject.averageMastery} target={subject.targetMastery || 100} />
              <div className="chips">
                <Badge>{subject.itemCount} topics</Badge>
                <Badge>{subject.dueCount} due</Badge>
                {subject.deadline ? <Badge>Due {formatDate(subject.deadline)}</Badge> : null}
              </div>
            </article>
          ))}
          {mindVault.sprints.map((sprint) => (
            <article key={`sprint-${sprint.id}`} className="entity-card">
              <div className="entity-head">
                <div>
                  <strong>{sprint.title}</strong>
                  <p>{sprint.subjectTitle || 'No subject'} - {sprint.description || 'Sprint'}</p>
                </div>
                <div className="card-actions">
                  <button className="text-button" type="button" onClick={() => mindVault.openSprintEditor(sprint)}>Edit</button>
                  <button className="text-button danger" type="button" onClick={() => mindVault.deleteSprint(sprint)}>Delete</button>
                </div>
              </div>
              <ProgressRow label="Sprint progress" value={sprint.progress} target={100} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function InsightsPage({ mindVault }) {
  return (
    <div className="mindvault-layout lms-layout">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Insights</p>
            <h3>Memory dashboard</h3>
          </div>
          <span className="muted">{mindVault.stats.reviewsThisWeek || 0} reviews this week</span>
        </div>
        <div className="mindvault-hero compact">
          <StatCard label="Important" value={mindVault.stats.importantItems ?? 0} caption="Structured topics" />
          <StatCard label="Random" value={mindVault.stats.randomItems ?? 0} caption="Daily learning" />
          <StatCard label="Streak" value={mindVault.stats.studyStreak ?? 0} caption="Review days" />
          <StatCard label="Mastery" value={`${mindVault.stats.averageMastery ?? 0}%`} caption="Average recall" />
        </div>
        <div className="insight-grid">
          {mindVault.analytics.subjects.map((subject) => (
            <article key={subject.subjectId} className="insight-card">
              <div className="entity-head">
                <strong>{subject.title}</strong>
                <span className="muted">{subject.itemCount} topics</span>
              </div>
              <ProgressRow label="Average mastery" value={subject.averageMastery} target={subject.targetMastery || 100} />
              <div className="chips">
                <Badge>{subject.dueCount} due</Badge>
                <Badge>{subject.masteredCount} mastered</Badge>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Weak spots</p>
            <h3>Topics to reinforce</h3>
          </div>
        </div>
        <MiniItemList items={mindVault.weakItems} empty="No weak topics yet." />
        <div className="panel-header spaced">
          <div>
            <p className="eyebrow">Most forgotten</p>
            <h3>Lapse history</h3>
          </div>
        </div>
        <MiniItemList items={mindVault.forgottenItems} empty="No review lapses yet." />
        <div className="forecast-grid">
          {mindVault.analytics.forecast.map((point) => (
            <div key={point.date} className="forecast-item">
              <span>{formatShortDate(point.date)}</span>
              <div className="forecast-bar"><div className="forecast-fill" style={{ width: `${Math.min(100, point.count * 12)}%` }} /></div>
              <strong>{point.count}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CaptureForm({ mindVault, submitLabel }) {
  const form = mindVault.itemForm;
  const setForm = mindVault.setItemForm;
  const resource = mindVault.resourceForm;
  const setResource = mindVault.setResourceForm;
  const fileUploadsEnabled = mindVault.stats.fileUploadsEnabled === true;
  return (
    <form className="mindvault-form" onSubmit={mindVault.submitItem}>
      <div className="segmented compact-segmented">
        <button type="button" className={form.learningType === 'IMPORTANT_TOPIC' ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, learningType: 'IMPORTANT_TOPIC' }))}>Important topic</button>
        <button type="button" className={form.learningType === 'RANDOM_LEARNING' ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, learningType: 'RANDOM_LEARNING', subjectId: '', sprintId: '' }))}>Random learning</button>
      </div>
      <label className="field">
        <span>Title</span>
        <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="What did you learn?" />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Subject</span>
          <select className="input" value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value, sprintId: '' }))} disabled={form.learningType === 'RANDOM_LEARNING'}>
            <option value="">No subject</option>
            {mindVault.subjects.map((subject) => <option key={subject.id} value={String(subject.id)}>{subject.title}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Sprint</span>
          <select className="input" value={form.sprintId} onChange={(event) => setForm((current) => ({ ...current, sprintId: event.target.value }))} disabled={form.learningType === 'RANDOM_LEARNING'}>
            <option value="">No sprint</option>
            {mindVault.sprintOptions.map((sprint) => <option key={sprint.id} value={String(sprint.id)}>{sprint.title}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Recall prompt</span>
        <textarea className="input textarea" rows="3" value={form.prompt} onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))} placeholder="Question your future self should answer" />
      </label>
      <label className="field">
        <span>Answer</span>
        <textarea className="input textarea" rows="4" value={form.answer} onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))} placeholder="The explanation, formula, concept, or takeaway" />
      </label>
      <label className="field">
        <span>Quick note</span>
        <textarea className="input textarea" rows="2" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Context, examples, or where you learned it" />
      </label>
      <details className="more-options">
        <summary>More options</summary>
        <div className="form-grid">
          <label className="field">
            <span>Importance</span>
            <input className="input" type="number" min="1" max="5" value={form.importance} onChange={(event) => setForm((current) => ({ ...current, importance: Number(event.target.value) }))} />
          </label>
          <label className="field">
            <span>Difficulty</span>
            <input className="input" type="number" min="1" max="5" value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: Number(event.target.value) }))} />
          </label>
          <label className="field">
            <span>Source</span>
            <input className="input" value={form.sourceLabel} onChange={(event) => setForm((current) => ({ ...current, sourceLabel: event.target.value }))} placeholder="Book, class, YouTube, article" />
          </label>
          <label className="field">
            <span>Tags</span>
            <input className="input" value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} />
          </label>
          <label className="field">
            <span>Review due date</span>
            <input className="input" type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
          </label>
        </div>
        <label className="field checkbox">
          <input type="checkbox" checked={form.reviewEnabled} onChange={(event) => setForm((current) => ({ ...current, reviewEnabled: event.target.checked }))} />
          <span>Add to review queue</span>
        </label>
      </details>
      <section className="resource-box">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Resource</p>
            <h3>Attach text, link, or file</h3>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Resource type</span>
            <select className="input" value={resource.resourceType} onChange={(event) => setResource((current) => ({ ...current, resourceType: event.target.value }))}>
              <option value="TEXT">Text</option>
              <option value="LINK">Link</option>
              <option value="PDF">PDF</option>
              <option value="DOCX">Word file</option>
              <option value="IMAGE">Image</option>
              <option value="NOTEBOOK_FILE">Notebook file</option>
              <option value="OTHER_FILE">Other file</option>
            </select>
          </label>
          <label className="field">
            <span>Resource title</span>
            <input className="input" value={resource.title} onChange={(event) => setResource((current) => ({ ...current, title: event.target.value }))} />
          </label>
        </div>
        {resource.resourceType === 'LINK' ? (
          <label className="field">
            <span>URL</span>
            <input className="input" value={resource.url} onChange={(event) => setResource((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." />
          </label>
        ) : null}
        {!fileUploadsEnabled && isFileResource(resource.resourceType) ? (
          <p className="muted">File upload UI is ready, but saving files needs Supabase Storage env vars on Render. Text and links still save without Supabase.</p>
        ) : null}
        {isFileResource(resource.resourceType) ? (
          <label className="field">
            <span>File</span>
            <input className="input" type="file" onChange={(event) => setResource((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
          </label>
        ) : (
          <label className="field">
            <span>Text / description</span>
            <textarea className="input textarea" rows="3" value={resource.description} onChange={(event) => setResource((current) => ({ ...current, description: event.target.value }))} />
          </label>
        )}
      </section>
      <div className="form-actions">
        <button className="button" disabled={mindVault.busy} type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}

function LearningCard({ item, compact = false, onEdit, onDelete, onStudy, onResourceDelete }) {
  return (
    <article className="entity-card learning-card">
      <div className="entity-head">
        <div>
          <strong>{item.title}</strong>
          <p>{learningTypeLabel(item)} - {item.subjectTitle || item.sourceLabel || 'Unassigned'}</p>
        </div>
        <div className="card-actions">
          {onStudy ? <button className="text-button" type="button" onClick={onStudy}>Study</button> : null}
          {onEdit ? <button className="text-button" type="button" onClick={onEdit}>Edit</button> : null}
          {onDelete ? <button className="text-button danger" type="button" onClick={onDelete}>Delete</button> : null}
        </div>
      </div>
      {!compact ? <p className="entity-copy">{item.prompt || item.answer || item.notes || 'No prompt yet.'}</p> : null}
      <div className="chips">
        <Badge>{item.status}</Badge>
        <Badge>Mastery {item.masteryScore}%</Badge>
        <Badge>Importance {item.importance ?? item.priority}/5</Badge>
        {item.reviewEnabled ? <Badge>{item.queueReason || `Next ${formatDate(item.nextReviewDate)}`}</Badge> : <Badge>No review</Badge>}
        {(item.resources || []).length ? <Badge>{item.resources.length} resources</Badge> : null}
      </div>
      {!compact ? <ResourceList resources={item.resources || []} onDelete={onResourceDelete} /> : null}
    </article>
  );
}

function ResourceList({ resources, onDelete, readonly = false }) {
  if (!resources.length) return null;
  return (
    <details className="resource-list">
      <summary>Resources ({resources.length})</summary>
      <div className="entity-list compact-list">
        {resources.map((resource) => (
          <article key={resource.id} className="resource-row">
            <div>
              <strong>{resource.title}</strong>
              <p>{resource.resourceType} {resource.originalFileName ? `- ${resource.originalFileName}` : ''}</p>
              {resource.url ? <a className="text-button" href={resource.url} target="_blank" rel="noreferrer">Open link</a> : null}
              {resource.description ? <p>{resource.description}</p> : null}
            </div>
            {!readonly && onDelete ? <button className="text-button danger" type="button" onClick={() => onDelete(resource)}>Delete</button> : null}
          </article>
        ))}
      </div>
    </details>
  );
}

function MiniItemList({ items, empty }) {
  if (!items.length) return <div className="empty-state">{empty}</div>;
  return (
    <div className="entity-list compact-list">
      {items.map((item) => (
        <article key={item.id} className="resource-row">
          <div>
            <strong>{item.title}</strong>
            <p>Mastery {item.masteryScore}% - lapses {item.lapseCount || 0}</p>
          </div>
        </article>
      ))}
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
        <strong>{value}/{target}</strong>
      </div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function Badge({ children }) {
  return <span className="pill">{children}</span>;
}

async function saveResourceIfPresent(itemId, resource) {
  if (isFileResource(resource.resourceType)) {
    if (!resource.file) return;
    const formData = new FormData();
    formData.append('file', resource.file);
    if (resource.title.trim()) formData.append('title', resource.title.trim());
    if (resource.description.trim()) formData.append('description', resource.description.trim());
    await apiMindVaultUploadResource(itemId, formData);
    return;
  }
  const hasText = resource.description.trim() || resource.url.trim() || resource.title.trim();
  if (!hasText) return;
  await apiMindVaultCreateResource(itemId, {
    resourceType: resource.resourceType,
    title: resource.title.trim() || (resource.resourceType === 'LINK' ? 'Linked resource' : 'Text note'),
    description: emptyToNull(resource.description),
    url: emptyToNull(resource.url)
  });
}

function itemPayload(form) {
  return {
    learningType: form.learningType,
    source: form.learningType === 'RANDOM_LEARNING' ? 'RANDOM' : 'PLANNED',
    subjectId: form.learningType === 'RANDOM_LEARNING' ? null : parseNullableId(form.subjectId),
    sprintId: form.learningType === 'RANDOM_LEARNING' ? null : parseNullableId(form.sprintId),
    title: form.title.trim(),
    prompt: emptyToNull(form.prompt),
    answer: emptyToNull(form.answer),
    notes: emptyToNull(form.notes),
    tags: emptyToNull(form.tags),
    priority: Number(form.importance) || 3,
    importance: Number(form.importance) || 3,
    difficulty: Number(form.difficulty) || 3,
    reviewEnabled: Boolean(form.reviewEnabled),
    sourceLabel: emptyToNull(form.sourceLabel),
    dueDate: emptyToNull(form.dueDate),
    status: form.status || 'ACTIVE'
  };
}

function firstQueueId(queue, current) {
  if (!queue.length) return null;
  return queue.some((item) => item.id === current) ? current : queue[0].id;
}

function itemSearchText(item) {
  return [item.title, item.prompt, item.answer, item.notes, item.subjectTitle, item.sprintTitle, item.sourceLabel, ...(item.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function learningTypeLabel(item) {
  return item.learningType === 'RANDOM_LEARNING' || item.source === 'RANDOM' ? 'Random learning' : 'Important topic';
}

function isFileResource(resourceType) {
  return ['PDF', 'DOCX', 'IMAGE', 'NOTEBOOK_FILE', 'OTHER_FILE'].includes(resourceType);
}

function formatDate(value) {
  if (!value) return 'not scheduled';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function joinTags(tags) {
  return tags?.length ? tags.join(', ') : '';
}

function emptyToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function parseNullableId(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
