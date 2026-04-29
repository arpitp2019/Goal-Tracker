import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiSmaartCreateTask,
  apiSmaartDeleteTask,
  apiSmaartPriorities,
  apiSmaartUpdatePriorityProfile,
  apiSmaartUpdateTask
} from './api';

const statusOptions = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'COMPLETED', 'ARCHIVED'];
const priorityLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const deadlineOptions = ['OVERDUE', 'TODAY', 'THIS_WEEK', 'NEXT_TWO_WEEKS', 'LATER', 'NONE'];
const factorOptions = [1, 2, 3, 4, 5];
const defaultProfile = {
  urgencyWeight: 1,
  importanceWeight: 1,
  deadlineWeight: 1,
  effortWeight: 1,
  impactWeight: 1,
  highPriorityThreshold: 75
};
const defaultTaskForm = {
  goalId: '',
  title: '',
  description: '',
  category: '',
  status: 'TODO',
  priority: 3,
  dueDate: '',
  estimatedMinutes: '',
  urgency: 3,
  importance: 3,
  impact: 3,
  effort: 3,
  tags: '',
  notes: ''
};

export default function SmaartPrioritiesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [goalOptions, setGoalOptions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [profile, setProfile] = useState(defaultProfile);
  const [weightDraft, setWeightDraft] = useState(defaultProfile);
  const [quickForm, setQuickForm] = useState(defaultTaskForm);
  const [filters, setFilters] = useState({ status: '', category: '', deadline: '', priorityLevel: '', search: '' });
  const [sort, setSort] = useState({ key: 'priorityScore', direction: 'desc' });
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [savingWeights, setSavingWeights] = useState(false);
  const [creating, setCreating] = useState(false);
  const [theme, setTheme] = useState(() => getInitialTheme());
  const deferredSearch = useDeferredValue(filters.search);

  useEffect(() => {
    let cancelled = false;
    apiSmaartPriorities()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setGoalOptions(response.goalOptions || []);
        setTasks(response.tasks || []);
        setProfile(response.profile || defaultProfile);
        setWeightDraft(response.profile || defaultProfile);
        setQuickForm((current) => ({
          ...current,
          goalId: current.goalId || String(response.goalOptions?.[0]?.id || '')
        }));
        setError('');
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
  }, [refreshKey]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const scoredTasks = useMemo(
    () => tasks.map((task) => enhanceTask(task, profile)),
    [tasks, profile]
  );

  const categories = useMemo(
    () =>
      Array.from(new Set(scoredTasks.map((task) => task.categoryLabel)))
        .sort((left, right) => left.localeCompare(right)),
    [scoredTasks]
  );

  const filteredTasks = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const filtered = scoredTasks.filter((task) => {
      if (filters.status && task.status !== filters.status) {
        return false;
      }
      if (filters.category && task.categoryLabel !== filters.category) {
        return false;
      }
      if (filters.priorityLevel && task.priorityLevel !== filters.priorityLevel) {
        return false;
      }
      if (filters.deadline && task.deadlineBucket !== filters.deadline) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const haystack = [
        task.title,
        task.description,
        task.goalTitle,
        task.categoryLabel,
        task.tags,
        task.notes
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
    return [...filtered].sort(compareTasks(sort));
  }, [deferredSearch, filters.category, filters.deadline, filters.priorityLevel, filters.status, scoredTasks, sort]);

  const kpis = useMemo(() => buildKpis(scoredTasks, profile.highPriorityThreshold), [profile.highPriorityThreshold, scoredTasks]);
  const statusDistribution = useMemo(
    () => buildDistribution(scoredTasks, (task) => task.status, statusOptions),
    [scoredTasks]
  );
  const priorityDistribution = useMemo(
    () => buildDistribution(scoredTasks, (task) => task.priorityLevel, priorityLevels),
    [scoredTasks]
  );
  const categoryDistribution = useMemo(
    () => buildDistribution(scoredTasks, (task) => task.categoryLabel, categories),
    [categories, scoredTasks]
  );
  const trend = useMemo(
    () => buildTrend(scoredTasks, profile.highPriorityThreshold),
    [profile.highPriorityThreshold, scoredTasks]
  );

  const showEmptyState = !loading && scoredTasks.length === 0 && goalOptions.length === 0;

  const reload = () => {
    setLoading(true);
    setRefreshKey((current) => current + 1);
  };

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setDraft(taskToDraft(task));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async () => {
    if (!draft || !editingId) {
      return;
    }
    setSavingId(editingId);
    setError('');
    try {
      const updated = await apiSmaartUpdateTask(editingId, buildTaskPayload(draft));
      setTasks((current) => current.map((task) => (task.id === editingId ? updated : task)));
      cancelEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const removeTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) {
      return;
    }
    setError('');
    try {
      await apiSmaartDeleteTask(taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
      if (editingId === taskId) {
        cancelEdit();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const createTask = async (event) => {
    event.preventDefault();
    if (!quickForm.goalId) {
      setError('Create a goal first so this task has a home.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const created = await apiSmaartCreateTask(quickForm.goalId, buildTaskPayload(quickForm));
      setTasks((current) => [created, ...current]);
      setQuickForm((current) => ({
        ...defaultTaskForm,
        goalId: current.goalId || String(goalOptions[0]?.id || '')
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const saveWeights = async () => {
    setSavingWeights(true);
    setError('');
    try {
      const saved = await apiSmaartUpdatePriorityProfile(weightDraft);
      setProfile(saved);
      setWeightDraft(saved);
      setWeightsOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingWeights(false);
    }
  };

  const exportCsv = () => {
    const header = ['Rank', 'Task', 'Goal', 'Category', 'Status', 'Score', 'Level', 'Urgency', 'Importance', 'Impact', 'Effort', 'Due date'];
    const rows = filteredTasks.map((task, index) => [
      index + 1,
      task.title,
      task.goalTitle,
      task.categoryLabel,
      label(task.status),
      task.priorityScore,
      task.priorityLevel,
      task.urgency,
      task.importance,
      task.impact,
      task.effort,
      task.dueDate || ''
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smaart-priorities-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="smaart-stack priorities-page">
      <section className="priorities-hero">
        <div>
          <p className="eyebrow">Weighted task prioritization</p>
          <h3>Rank the next best task before the day gets noisy.</h3>
          <p className="lead">
            Live scores combine urgency, importance, deadline pressure, effort, and impact so the busiest list is not the same thing as the right list.
          </p>
        </div>
        <div className="priorities-hero-actions">
          <button className="button secondary" type="button" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button className="button secondary" type="button" onClick={() => setWeightsOpen((current) => !current)}>
            {weightsOpen ? 'Hide weights' : 'Edit weights'}
          </button>
          <button className="button" type="button" onClick={exportCsv} disabled={!filteredTasks.length}>
            Export CSV
          </button>
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}

      {weightsOpen ? (
        <section className="panel priorities-weight-panel">
          <div className="panel-header">
            <div>
              <h3>Scoring weights</h3>
              <p className="muted">Change the formula once, then let every score update together.</p>
            </div>
            <button className="button" type="button" disabled={savingWeights} onClick={saveWeights}>
              {savingWeights ? 'Saving...' : 'Save weights'}
            </button>
          </div>
          <div className="priorities-weight-grid">
            <WeightSlider label="Urgency" value={weightDraft.urgencyWeight} onChange={(value) => setWeightDraft((current) => ({ ...current, urgencyWeight: value }))} />
            <WeightSlider label="Importance" value={weightDraft.importanceWeight} onChange={(value) => setWeightDraft((current) => ({ ...current, importanceWeight: value }))} />
            <WeightSlider label="Deadline" value={weightDraft.deadlineWeight} onChange={(value) => setWeightDraft((current) => ({ ...current, deadlineWeight: value }))} />
            <WeightSlider label="Effort" value={weightDraft.effortWeight} onChange={(value) => setWeightDraft((current) => ({ ...current, effortWeight: value }))} />
            <WeightSlider label="Impact" value={weightDraft.impactWeight} onChange={(value) => setWeightDraft((current) => ({ ...current, impactWeight: value }))} />
            <WeightSlider
              label="High-priority threshold"
              min={50}
              max={95}
              step={5}
              value={weightDraft.highPriorityThreshold}
              onChange={(value) => setWeightDraft((current) => ({ ...current, highPriorityThreshold: value }))}
            />
          </div>
          <div className="formula-strip">
            <span>Score = weighted average of urgency, importance, deadline pressure, impact, and inverse effort.</span>
            <strong>High priority starts at {weightDraft.highPriorityThreshold}</strong>
          </div>
        </section>
      ) : null}

      {showEmptyState ? (
        <section className="panel priorities-empty">
          <h3>No active goals yet</h3>
          <p>Create a goal first, then this dashboard can rank tasks across that goal set.</p>
          <Link className="button" to="/goals/list">
            Create goal
          </Link>
        </section>
      ) : null}

      {!showEmptyState ? (
        <>
          <section className="priorities-toolbar">
            <input
              className="input"
              placeholder="Search task, goal, category, or tag"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
            <select className="input" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
            <select className="input" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select className="input" value={filters.deadline} onChange={(event) => setFilters((current) => ({ ...current, deadline: event.target.value }))}>
              <option value="">Any deadline</option>
              {deadlineOptions.map((option) => (
                <option key={option} value={option}>
                  {deadlineLabel(option)}
                </option>
              ))}
            </select>
            <select className="input" value={filters.priorityLevel} onChange={(event) => setFilters((current) => ({ ...current, priorityLevel: event.target.value }))}>
              <option value="">Any priority</option>
              {priorityLevels.map((level) => (
                <option key={level} value={level}>
                  {label(level)}
                </option>
              ))}
            </select>
          </section>

          <section className="priority-kpi-grid">
            <KpiCard label="Total tasks" value={kpis.totalTasks} tone="" />
            <KpiCard label="High priority" value={kpis.highPriorityTasks} tone="accent" />
            <KpiCard label="Overdue" value={kpis.overdueTasks} tone="danger" />
            <KpiCard label="Completed" value={kpis.completedTasks} tone="success" />
          </section>

          <section className="priorities-insight-grid">
            <SummaryCard title="Status mix" items={statusDistribution} />
            <SummaryCard title="Priority levels" items={priorityDistribution} />
            <SummaryCard title="Categories" items={categoryDistribution} />
            <TrendCard title="14-day priority load" points={trend} />
          </section>

          <section className="priorities-content-grid">
            <section className="panel priorities-table-panel">
              <div className="panel-header">
                <div>
                  <h3>Ranked tasks</h3>
                  <p className="muted">{filteredTasks.length} visible tasks sorted by weighted score.</p>
                </div>
                <button className="button secondary" type="button" onClick={reload}>
                  Refresh
                </button>
              </div>

              <div className="priority-table-wrapper desktop-only">
                <table className="priority-table">
                  <thead>
                    <tr>
                      <SortableHeader label="Task" sort={sort} sortKey="title" onSort={setSort} />
                      <SortableHeader label="Goal" sort={sort} sortKey="goalTitle" onSort={setSort} />
                      <SortableHeader label="Score" sort={sort} sortKey="priorityScore" onSort={setSort} />
                      <SortableHeader label="Urgency" sort={sort} sortKey="urgency" onSort={setSort} />
                      <SortableHeader label="Importance" sort={sort} sortKey="importance" onSort={setSort} />
                      <SortableHeader label="Impact" sort={sort} sortKey="impact" onSort={setSort} />
                      <SortableHeader label="Effort" sort={sort} sortKey="effort" onSort={setSort} />
                      <SortableHeader label="Deadline" sort={sort} sortKey="dueDate" onSort={setSort} />
                      <SortableHeader label="Status" sort={sort} sortKey="status" onSort={setSort} />
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task, index) => {
                      const isEditing = editingId === task.id;
                      const rowTask = isEditing ? enhanceTask({ ...task, ...draft }, profile) : task;
                      return (
                        <tr key={task.id}>
                          <td>
                            {isEditing ? (
                              <div className="inline-stack">
                                <input className="input compact-input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
                                <input className="input compact-input" value={draft.description} placeholder="Description" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                              </div>
                            ) : (
                              <div className="table-task">
                                <strong>{index + 1}. {task.title}</strong>
                                <p>{task.description || 'No description'}</p>
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="inline-stack compact">
                              <Link className="table-link" to={`/goals/${task.goalId}`}>{task.goalTitle}</Link>
                              {isEditing ? (
                                <input className="input compact-input" value={draft.category} placeholder="Category" onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
                              ) : (
                                <span className="chip subtle">{task.categoryLabel}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <ScoreBadge task={rowTask} active={isEditing && rowTask.priorityScore !== task.priorityScore} />
                          </td>
                          <td>{isEditing ? <FactorSelect value={draft.urgency} onChange={(value) => setDraft((current) => ({ ...current, urgency: value }))} /> : <FactorBadge label="U" value={task.urgency} tone="urgent" />}</td>
                          <td>{isEditing ? <FactorSelect value={draft.importance} onChange={(value) => setDraft((current) => ({ ...current, importance: value }))} /> : <FactorBadge label="I" value={task.importance} tone="important" />}</td>
                          <td>{isEditing ? <FactorSelect value={draft.impact} onChange={(value) => setDraft((current) => ({ ...current, impact: value }))} /> : <FactorBadge label="M" value={task.impact} tone="impact" />}</td>
                          <td>{isEditing ? <FactorSelect value={draft.effort} onChange={(value) => setDraft((current) => ({ ...current, effort: value }))} /> : <FactorBadge label="E" value={task.effort} tone="effort" />}</td>
                          <td>
                            {isEditing ? (
                              <input className="input compact-input" type="date" value={draft.dueDate || ''} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} />
                            ) : (
                              <div className="inline-stack compact">
                                <span>{task.dueDate ? prettyDate(task.dueDate) : 'No date'}</span>
                                <span className={`chip subtle ${task.deadlineBucket.toLowerCase()}`}>{deadlineLabel(task.deadlineBucket)}</span>
                              </div>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <select className="input compact-input" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                                {statusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {label(status)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className={`status-badge status-${task.status.toLowerCase()}`}>{label(task.status)}</span>
                            )}
                          </td>
                          <td>
                            <div className="row-actions">
                              {isEditing ? (
                                <>
                                  <button className="text-button" type="button" disabled={savingId === task.id} onClick={saveEdit}>
                                    {savingId === task.id ? 'Saving...' : 'Save'}
                                  </button>
                                  <button className="text-button" type="button" onClick={cancelEdit}>
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button className="text-button" type="button" onClick={() => startEdit(task)}>
                                  Edit
                                </button>
                              )}
                              <button className="text-button danger" type="button" onClick={() => removeTask(task.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filteredTasks.length && !loading ? <div className="empty-state">No tasks match the current filters.</div> : null}
              </div>

              <div className="mobile-only priorities-card-list">
                {filteredTasks.map((task) => {
                  const isEditing = editingId === task.id;
                  const rowTask = isEditing ? enhanceTask({ ...task, ...draft }, profile) : task;
                  return (
                    <article key={task.id} className="priority-card">
                      <div className="priority-card-head">
                        <div>
                          <strong>{rowTask.title}</strong>
                          <p>{task.goalTitle}</p>
                        </div>
                        <ScoreBadge task={rowTask} active={isEditing && rowTask.priorityScore !== task.priorityScore} />
                      </div>
                      {isEditing ? (
                        <div className="inline-stack">
                          <input className="input compact-input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
                          <input className="input compact-input" value={draft.category} placeholder="Category" onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
                          <input className="input compact-input" type="date" value={draft.dueDate || ''} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} />
                          <select className="input compact-input" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>
                                {label(status)}
                              </option>
                            ))}
                          </select>
                          <div className="chips">
                            <FactorSelect value={draft.urgency} onChange={(value) => setDraft((current) => ({ ...current, urgency: value }))} />
                            <FactorSelect value={draft.importance} onChange={(value) => setDraft((current) => ({ ...current, importance: value }))} />
                            <FactorSelect value={draft.impact} onChange={(value) => setDraft((current) => ({ ...current, impact: value }))} />
                            <FactorSelect value={draft.effort} onChange={(value) => setDraft((current) => ({ ...current, effort: value }))} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="chips">
                            <FactorBadge label="U" value={rowTask.urgency} tone="urgent" />
                            <FactorBadge label="I" value={rowTask.importance} tone="important" />
                            <FactorBadge label="M" value={rowTask.impact} tone="impact" />
                            <FactorBadge label="E" value={rowTask.effort} tone="effort" />
                            <span className={`status-badge status-${rowTask.status.toLowerCase()}`}>{label(rowTask.status)}</span>
                          </div>
                          <div className="priority-card-foot">
                            <span>{rowTask.dueDate ? prettyDate(rowTask.dueDate) : 'No date'}</span>
                            <span>{rowTask.categoryLabel}</span>
                          </div>
                        </>
                      )}
                      <div className="row-actions">
                        {isEditing ? (
                          <>
                            <button className="text-button" type="button" disabled={savingId === task.id} onClick={saveEdit}>
                              {savingId === task.id ? 'Saving...' : 'Save'}
                            </button>
                            <button className="text-button" type="button" onClick={cancelEdit}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button className="text-button" type="button" onClick={() => startEdit(task)}>
                            Edit
                          </button>
                        )}
                        <button className="text-button danger" type="button" onClick={() => removeTask(task.id)}>
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="panel priorities-side-panel">
              <div className="panel-header">
                <div>
                  <h3>Quick add</h3>
                  <p className="muted">Create a task with explicit scoring inputs from the start.</p>
                </div>
              </div>
              <form className="smaart-form" onSubmit={createTask}>
                <label className="field">
                  <span>Goal</span>
                  <select className="input" value={quickForm.goalId} onChange={(event) => setQuickForm((current) => ({ ...current, goalId: event.target.value }))}>
                    {goalOptions.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Task title" value={quickForm.title} onChange={(value) => setQuickForm((current) => ({ ...current, title: value }))} required />
                <Field label="Description" type="textarea" value={quickForm.description} onChange={(value) => setQuickForm((current) => ({ ...current, description: value }))} />
                <div className="form-grid compact-grid">
                  <Field label="Category" value={quickForm.category} onChange={(value) => setQuickForm((current) => ({ ...current, category: value }))} />
                  <label className="field">
                    <span>Status</span>
                    <select className="input" value={quickForm.status} onChange={(event) => setQuickForm((current) => ({ ...current, status: event.target.value }))}>
                      {statusOptions.filter((status) => status !== 'ARCHIVED').map((status) => (
                        <option key={status} value={status}>
                          {label(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field label="Due date" type="date" value={quickForm.dueDate} onChange={(value) => setQuickForm((current) => ({ ...current, dueDate: value }))} />
                  <Field label="Minutes" type="number" value={quickForm.estimatedMinutes} onChange={(value) => setQuickForm((current) => ({ ...current, estimatedMinutes: value }))} />
                </div>
                <div className="priority-factor-grid">
                  <FactorField label="Urgency" value={quickForm.urgency} onChange={(value) => setQuickForm((current) => ({ ...current, urgency: value }))} />
                  <FactorField label="Importance" value={quickForm.importance} onChange={(value) => setQuickForm((current) => ({ ...current, importance: value }))} />
                  <FactorField label="Impact" value={quickForm.impact} onChange={(value) => setQuickForm((current) => ({ ...current, impact: value }))} />
                  <FactorField label="Effort" value={quickForm.effort} onChange={(value) => setQuickForm((current) => ({ ...current, effort: value }))} />
                </div>
                <div className="formula-strip compact">
                  <span>Preview score</span>
                  <strong>{enhanceTask(quickForm, profile).priorityScore}</strong>
                </div>
                <button className="button" type="submit" disabled={creating}>
                  {creating ? 'Adding...' : 'Add ranked task'}
                </button>
              </form>
            </section>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Field({ label: fieldLabel, value, onChange, type = 'text', required = false }) {
  return (
    <label className="field">
      <span>{fieldLabel}</span>
      {type === 'textarea' ? (
        <textarea className="input textarea" rows={3} value={value || ''} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className="input" type={type} required={required} value={value ?? ''} onChange={(event) => onChange(type === 'number' ? event.target.value : event.target.value)} />
      )}
    </label>
  );
}

function KpiCard({ label: statLabel, value, tone }) {
  return (
    <article className={`priority-kpi ${tone}`.trim()}>
      <span>{statLabel}</span>
      <strong>{value}</strong>
    </article>
  );
}

function WeightSlider({ label: sliderLabel, value, onChange, min = 1, max = 5, step = 1 }) {
  return (
    <label className="weight-slider">
      <span>{sliderLabel}</span>
      <div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <strong>{value}</strong>
      </div>
    </label>
  );
}

function SummaryCard({ title, items }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="panel summary-panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <div className="summary-list">
        {items.map((item) => (
          <div key={item.label} className="summary-row">
            <div className="summary-label">
              <span>{label(item.label)}</span>
              <strong>{item.count}</strong>
            </div>
            <div className="summary-bar">
              <div style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendCard({ title, points }) {
  const max = Math.max(1, ...points.map((point) => point.totalScore));
  return (
    <section className="panel summary-panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <div className="trend-chart" role="img" aria-label={title}>
        {points.map((point) => (
          <div key={point.label} className="trend-column">
            <div className="trend-bar-wrap">
              <div className="trend-bar" style={{ height: point.totalScore ? `${Math.max(12, (point.totalScore / max) * 100)}%` : '0%' }} />
            </div>
            <strong>{point.label}</strong>
            <span>{point.taskCount}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SortableHeader({ label: headerLabel, sort, sortKey, onSort }) {
  const active = sort.key === sortKey;
  return (
    <th>
      <button
        className={`table-sort${active ? ' active' : ''}`}
        type="button"
        onClick={() =>
          onSort((current) => ({
            key: sortKey,
            direction: current.key === sortKey && current.direction === 'desc' ? 'asc' : 'desc'
          }))
        }
      >
        {headerLabel}
      </button>
    </th>
  );
}

function ScoreBadge({ task, active }) {
  return (
    <div className={`score-badge level-${task.priorityLevel.toLowerCase()}${active ? ' updating' : ''}`}>
      <strong>{task.priorityScore}</strong>
      <span>{label(task.priorityLevel)}</span>
    </div>
  );
}

function FactorBadge({ label: badgeLabel, value, tone }) {
  return <span className={`factor-badge ${tone}`}>{badgeLabel} {value}</span>;
}

function FactorSelect({ value, onChange }) {
  return (
    <select className="input compact-input" value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {factorOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function FactorField({ label: fieldLabel, value, onChange }) {
  return (
    <label className="field factor-field">
      <span>{fieldLabel}</span>
      <select className="input" value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {factorOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildKpis(tasks, threshold) {
  const todayIso = todayString();
  return {
    totalTasks: tasks.length,
    highPriorityTasks: tasks.filter((task) => !task.completed && task.priorityScore >= threshold).length,
    overdueTasks: tasks.filter((task) => !task.completed && task.dueDate && task.dueDate < todayIso).length,
    completedTasks: tasks.filter((task) => task.completed).length
  };
}

function buildDistribution(tasks, classifier, orderedKeys) {
  const counts = new Map();
  tasks.forEach((task) => {
    const key = classifier(task);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return orderedKeys.map((key) => ({ label: key, count: counts.get(key) || 0 }));
}

function buildTrend(tasks, threshold) {
  const start = new Date(`${todayString()}T00:00:00`);
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const dateTasks = tasks.filter((task) => task.dueDate === iso);
    return {
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      totalScore: dateTasks.reduce((sum, task) => sum + task.priorityScore, 0),
      taskCount: dateTasks.length,
      highPriorityCount: dateTasks.filter((task) => task.priorityScore >= threshold).length
    };
  });
}

function compareTasks(sort) {
  const statusRank = Object.fromEntries(statusOptions.map((status, index) => [status, index]));
  return (left, right) => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const valueLeft = sortableValue(left, sort.key, statusRank);
    const valueRight = sortableValue(right, sort.key, statusRank);
    if (valueLeft < valueRight) {
      return -1 * direction;
    }
    if (valueLeft > valueRight) {
      return 1 * direction;
    }
    return 0;
  };
}

function sortableValue(task, key, statusRank) {
  if (key === 'status') {
    return statusRank[task.status] ?? 999;
  }
  if (key === 'dueDate') {
    return task.dueDate || '9999-12-31';
  }
  if (key === 'updatedAt') {
    return task.updatedAt || '';
  }
  return typeof task[key] === 'string' ? task[key].toLowerCase() : task[key] ?? 0;
}

function taskToDraft(task) {
  return {
    id: task.id,
    title: task.title || '',
    description: task.description || '',
    sprintId: task.sprintId || null,
    status: task.status || 'TODO',
    priority: task.priority || 3,
    category: task.category || '',
    dueDate: task.dueDate || '',
    estimatedMinutes: task.estimatedMinutes ?? '',
    urgency: task.urgency || 3,
    importance: task.importance || 3,
    impact: task.impact || 3,
    effort: task.effort || 3,
    completed: task.completed || false,
    tags: task.tags || '',
    notes: task.notes || '',
    dependencyIds: task.dependencyIds || [],
    checklistItems: (task.checklistItems || []).map((item) => item.title)
  };
}

function buildTaskPayload(task) {
  return {
    title: task.title?.trim() || '',
    description: emptyToNull(task.description),
    sprintId: task.sprintId || null,
    status: task.status || 'TODO',
    priority: Number(task.priority || 3),
    category: emptyToNull(task.category),
    dueDate: task.dueDate || null,
    estimatedMinutes: task.estimatedMinutes === '' || task.estimatedMinutes == null ? null : Number(task.estimatedMinutes),
    urgency: Number(task.urgency || 3),
    importance: Number(task.importance || 3),
    impact: Number(task.impact || 3),
    effort: Number(task.effort || 3),
    completed: task.completed || false,
    tags: emptyToNull(task.tags),
    notes: emptyToNull(task.notes),
    dependencyIds: task.dependencyIds || [],
    checklistItems: task.checklistItems || []
  };
}

function enhanceTask(task, profile) {
  const urgency = clamp(task.urgency ?? 3, 1, 5);
  const importance = clamp(task.importance ?? 3, 1, 5);
  const impact = clamp(task.impact ?? 3, 1, 5);
  const effort = clamp(task.effort ?? 3, 1, 5);
  const deadlinePressure = computeDeadlinePressure(task.dueDate);
  const totalWeight = profile.urgencyWeight + profile.importanceWeight + profile.deadlineWeight + profile.effortWeight + profile.impactWeight;
  const effectiveEffort = 6 - effort;
  const weightedScore =
    urgency * profile.urgencyWeight +
    importance * profile.importanceWeight +
    deadlinePressure * profile.deadlineWeight +
    effectiveEffort * profile.effortWeight +
    impact * profile.impactWeight;
  const priorityScore = Math.round((weightedScore / (Math.max(1, totalWeight) * 5)) * 100);
  return {
    ...task,
    urgency,
    importance,
    impact,
    effort,
    deadlinePressure,
    priorityScore,
    priorityLevel: computePriorityLevel(priorityScore),
    categoryLabel: task.category?.trim() || 'Uncategorized',
    deadlineBucket: computeDeadlineBucket(task.dueDate)
  };
}

function computeDeadlinePressure(dueDate) {
  if (!dueDate) {
    return 1;
  }
  const today = new Date(`${todayString()}T00:00:00`);
  const target = new Date(`${dueDate}T00:00:00`);
  const delta = Math.round((target - today) / 86400000);
  if (delta <= 1) {
    return 5;
  }
  if (delta <= 3) {
    return 4;
  }
  if (delta <= 7) {
    return 3;
  }
  if (delta <= 14) {
    return 2;
  }
  return 1;
}

function computeDeadlineBucket(dueDate) {
  if (!dueDate) {
    return 'NONE';
  }
  const today = new Date(`${todayString()}T00:00:00`);
  const target = new Date(`${dueDate}T00:00:00`);
  const delta = Math.round((target - today) / 86400000);
  if (delta < 0) {
    return 'OVERDUE';
  }
  if (delta <= 1) {
    return 'TODAY';
  }
  if (delta <= 7) {
    return 'THIS_WEEK';
  }
  if (delta <= 14) {
    return 'NEXT_TWO_WEEKS';
  }
  return 'LATER';
}

function computePriorityLevel(score) {
  if (score >= 85) {
    return 'CRITICAL';
  }
  if (score >= 75) {
    return 'HIGH';
  }
  if (score >= 50) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function deadlineLabel(value) {
  switch (value) {
    case 'TODAY':
      return 'Due soon';
    case 'THIS_WEEK':
      return 'This week';
    case 'NEXT_TWO_WEEKS':
      return 'Next 2 weeks';
    case 'LATER':
      return 'Later';
    case 'NONE':
      return 'No deadline';
    default:
      return label(value);
  }
}

function prettyDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function label(value) {
  return String(value || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function csvCell(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function emptyToNull(value) {
  return value == null || value === '' ? null : value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || min)));
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function getInitialTheme() {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  return window.localStorage.getItem('flowdash_theme') || document.documentElement.dataset.theme || 'dark';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem('flowdash_theme', theme);
}
