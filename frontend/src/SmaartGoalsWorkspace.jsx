import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  apiSmaartArchive,
  apiSmaartArchiveGoal,
  apiSmaartCalendar,
  apiSmaartCreateGoal,
  apiSmaartCreateSprint,
  apiSmaartCreateSprintTask,
  apiSmaartCreateTask,
  apiSmaartDashboard,
  apiSmaartDeleteGoal,
  apiSmaartDeleteTask,
  apiSmaartGoalDetail,
  apiSmaartGoals,
  apiSmaartKanban,
  apiSmaartRestoreGoal,
  apiSmaartUpdateGoal,
  apiSmaartUpdateSprint,
  apiSmaartUpdateTaskStatus
} from './api';
import SmaartPrioritiesPage from './SmaartPrioritiesPage';

const statuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'COMPLETED', 'ARCHIVED'];
const boardStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'COMPLETED'];
const priorities = [1, 2, 3, 4, 5];
const goalTabs = [
  { to: '/goals/priorities', label: 'Priorities' },
  { to: '/goals/dashboard', label: 'Dashboard' },
  { to: '/goals/list', label: 'Goals' },
  { to: '/goals/kanban', label: 'Kanban' },
  { to: '/goals/calendar', label: 'Calendar' },
  { to: '/goals/archive', label: 'Archive' }
];

const goalDefaults = {
  title: '',
  description: '',
  goalType: 'SHORT_TERM',
  category: '',
  priority: 3,
  startDate: today(),
  deadline: offsetDate(7),
  status: 'TODO',
  motivation: '',
  successCriteria: '',
  notes: '',
  specific: '',
  measurable: '',
  achievable: '',
  actionOriented: '',
  relevant: '',
  timeBound: ''
};

const taskDefaults = {
  title: '',
  description: '',
  status: 'TODO',
  priority: 3,
  dueDate: '',
  estimatedMinutes: '',
  tags: '',
  notes: '',
  checklistText: ''
};

const sprintDefaults = {
  title: '',
  objective: '',
  startDate: today(),
  endDate: offsetDate(14),
  status: 'TODO',
  notes: ''
};

export default function SmaartGoalsWorkspace() {
  return (
    <section className="page smaart-page">
      <div className="page-header smaart-header">
        <div>
          <p className="eyebrow">SMAART Goals</p>
          <h2>Plan clearly. Execute visibly. Finish before deadlines.</h2>
          <p className="lead">A focused workspace for short-term goals, long-term sprints, Kanban execution, and deadline awareness.</p>
        </div>
        <Link className="button" to="/goals/list">
          New goal
        </Link>
      </div>

      <div className="tabs goal-tabs" role="tablist" aria-label="Goals pages">
        {goalTabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Routes>
        <Route index element={<Navigate to="priorities" replace />} />
        <Route path="priorities" element={<SmaartPrioritiesPage />} />
        <Route path="dashboard" element={<GoalsDashboard />} />
        <Route path="list" element={<GoalsList />} />
        <Route path="kanban" element={<GoalsKanban />} />
        <Route path="calendar" element={<GoalsCalendar />} />
        <Route path="archive" element={<GoalsArchive />} />
        <Route path=":goalId/sprints/:sprintId" element={<SprintDetail />} />
        <Route path=":goalId" element={<GoalDetail />} />
      </Routes>
    </section>
  );
}

function GoalsDashboard() {
  const { data, loading, error, reload } = useLoad(apiSmaartDashboard, []);
  const stats = data?.stats;

  return (
    <div className="smaart-stack">
      <StatusLine loading={loading} error={error} onRetry={reload} />
      <div className="smaart-stat-grid">
        <StatCard label="Active goals" value={stats?.activeGoals ?? 0} />
        <StatCard label="Completed" value={stats?.completedGoals ?? 0} />
        <StatCard label="Overdue goals" value={stats?.overdueGoals ?? 0} tone="danger" />
        <StatCard label="Overall progress" value={`${stats?.overallProgress ?? 0}%`} />
      </div>

      <div className="smaart-grid two">
        <Panel title="Today's focus" meta={`${data?.todayFocusTasks?.length ?? 0} tasks`}>
          <TaskList tasks={data?.todayFocusTasks || []} onStatusChange={reload} empty="No urgent focus tasks yet." />
        </Panel>
        <Panel title="At-risk goals" meta="deadline health">
          <GoalMiniList goals={data?.atRiskGoals || []} empty="Nothing is at risk right now." />
        </Panel>
      </div>

      <div className="smaart-grid three">
        <Panel title="Upcoming deadlines">
          <GoalMiniList goals={data?.upcomingDeadlines || []} empty="No deadlines this week." />
        </Panel>
        <Panel title="Sprint progress">
          <SprintMiniList sprints={data?.sprintSummary || []} empty="No active sprints yet." />
        </Panel>
        <Panel title="Recent activity">
          <ActivityList items={data?.recentActivity || []} />
        </Panel>
      </div>
    </div>
  );
}

function GoalsList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ type: '', status: '', search: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(goalDefaults);
  const { data, loading, error, reload } = useLoad(() => apiSmaartGoals(filters), [filters.type, filters.status, filters.search]);
  const goals = data?.goals || [];

  const createGoal = async (event) => {
    event.preventDefault();
    const created = await apiSmaartCreateGoal(goalPayload(form));
    setForm(goalDefaults);
    setShowForm(false);
    await reload();
    navigate(`/goals/${created.id}`);
  };

  return (
    <div className="smaart-stack">
      <StatusLine loading={loading} error={error} onRetry={reload} />
      <div className="smaart-toolbar">
        <input className="input" placeholder="Search goals" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
        <select className="input" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
          <option value="">All goal types</option>
          <option value="SHORT_TERM">Short-term</option>
          <option value="LONG_TERM">Long-term</option>
        </select>
        <select className="input" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </select>
        <button className="button" type="button" onClick={() => setShowForm((current) => !current)}>
          {showForm ? 'Close' : '+ New Goal'}
        </button>
      </div>

      {showForm ? (
        <Panel title="Create goal" meta="choose short-term or long-term first">
          <GoalForm form={form} onChange={setForm} onSubmit={createGoal} submitLabel="Create goal" />
        </Panel>
      ) : null}

      <div className="smaart-goal-grid">
        {goals.map((goal) => (
          <Link key={goal.id} to={`/goals/${goal.id}`} className="smaart-goal-card">
            <div className="panel-header">
              <div>
                <span className="chip">{goal.goalType === 'LONG_TERM' ? 'Long-term' : 'Short-term'}</span>
                <h3>{goal.title}</h3>
              </div>
              <StatusBadge status={goal.status} />
            </div>
            <p>{goal.description || goal.specific || 'No description yet.'}</p>
            <Progress value={goal.progressPercentage} />
            <div className="smaart-card-foot">
              <span>{goal.deadline ? `Due ${prettyDate(goal.deadline)}` : 'No deadline'}</span>
              <span className={`urgency ${toneForUrgency(goal.urgency)}`}>{goal.urgency}</span>
            </div>
          </Link>
        ))}
        {!goals.length && !loading ? <div className="empty-state">No SMAART goals yet. Create one to start planning.</div> : null}
      </div>
    </div>
  );
}

function GoalDetail() {
  const { goalId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [taskForm, setTaskForm] = useState(taskDefaults);
  const [sprintForm, setSprintForm] = useState(sprintDefaults);
  const { data, loading, error, reload } = useLoad(() => apiSmaartGoalDetail(goalId), [goalId]);
  const goal = data?.goal;
  const tasks = data?.tasks || [];
  const sprints = data?.sprints || [];

  const createTask = async (event) => {
    event.preventDefault();
    await apiSmaartCreateTask(goalId, taskPayload(taskForm));
    setTaskForm(taskDefaults);
    await reload();
  };

  const createSprint = async (event) => {
    event.preventDefault();
    await apiSmaartCreateSprint(goalId, sprintPayload(sprintForm));
    setSprintForm(sprintDefaults);
    await reload();
  };

  const completeGoal = async () => {
    await apiSmaartUpdateGoal(goalId, goalPayload({ ...goalToForm(goal), status: 'COMPLETED' }));
    await reload();
  };

  const archiveGoal = async () => {
    await apiSmaartArchiveGoal(goalId);
    await reload();
  };

  if (loading && !goal) {
    return <StatusLine loading />;
  }

  if (error) {
    return <StatusLine error={error} onRetry={reload} />;
  }

  if (!goal) {
    return <div className="empty-state">Goal not found.</div>;
  }

  const tabs = goal.goalType === 'LONG_TERM'
    ? ['overview', 'tasks', 'sprints', 'progress', 'activity']
    : ['overview', 'tasks', 'progress', 'activity'];

  return (
    <div className="smaart-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Goal detail</p>
          <h2>{goal.title}</h2>
          <p className="lead">{goal.description || goal.motivation || 'Define why this goal matters and what needs to happen next.'}</p>
        </div>
        <div className="goal-actions">
          {goal.readyToComplete ? <button className="button" type="button" onClick={completeGoal}>Complete goal</button> : null}
          <button className="button secondary" type="button" onClick={archiveGoal}>Archive</button>
        </div>
      </div>

      <div className="smaart-detail-summary">
        <StatCard label="Progress" value={`${goal.progressPercentage}%`} />
        <StatCard label="Tasks" value={`${goal.completedTaskCount}/${goal.taskCount}`} />
        <StatCard label="Deadline" value={goal.deadline ? prettyDate(goal.deadline) : 'Unset'} />
        <StatCard label="Health" value={goal.urgency} tone={toneForUrgency(goal.urgency)} />
      </div>

      <div className="tabs compact">
        {tabs.map((tab) => (
          <button key={tab} className={`tab${activeTab === tab ? ' active' : ''}`} type="button" onClick={() => setActiveTab(tab)}>
            {label(tab)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <GoalEditPanel key={`${goal.id}-${goal.updatedAt}`} goal={goal} onSaved={reload} />
      ) : null}

      {activeTab === 'tasks' ? (
        <div className="smaart-grid two">
          <Panel title="Task list" meta={`${tasks.length} tasks`}>
            <TaskList tasks={tasks} onStatusChange={reload} empty="No tasks yet." />
          </Panel>
          <Panel title="Quick add task">
            <TaskForm form={taskForm} onChange={setTaskForm} onSubmit={createTask} sprints={sprints} />
          </Panel>
        </div>
      ) : null}

      {activeTab === 'sprints' ? (
        <div className="smaart-grid two">
          <Panel title="Sprints" meta={`${sprints.length} phases`}>
            <SprintMiniList sprints={sprints} empty="No sprints yet." />
          </Panel>
          <Panel title="Add sprint">
            <SprintForm form={sprintForm} onChange={setSprintForm} onSubmit={createSprint} />
          </Panel>
        </div>
      ) : null}

      {activeTab === 'progress' ? (
        <Panel title="Progress">
          <Progress value={goal.progressPercentage} />
          <div className="smaart-grid three slim">
            <StatCard label="Goal type" value={goal.goalType === 'LONG_TERM' ? 'Long-term' : 'Short-term'} />
            <StatCard label="Status" value={label(goal.status)} />
            <StatCard label="Urgency" value={goal.urgency} tone={toneForUrgency(goal.urgency)} />
          </div>
        </Panel>
      ) : null}

      {activeTab === 'activity' ? (
        <Panel title="Activity log">
          <ActivityList items={data?.activity || []} />
        </Panel>
      ) : null}
    </div>
  );
}

function SprintDetail() {
  const { goalId, sprintId } = useParams();
  const [taskForm, setTaskForm] = useState(taskDefaults);
  const { data, loading, error, reload } = useLoad(() => apiSmaartGoalDetail(goalId), [goalId]);
  const sprint = data?.sprints?.find((item) => String(item.id) === String(sprintId));
  const tasks = (data?.tasks || []).filter((task) => String(task.sprintId) === String(sprintId));

  const createTask = async (event) => {
    event.preventDefault();
    await apiSmaartCreateSprintTask(goalId, sprintId, taskPayload(taskForm));
    setTaskForm(taskDefaults);
    await reload();
  };

  if (loading && !sprint) return <StatusLine loading />;
  if (error) return <StatusLine error={error} onRetry={reload} />;
  if (!sprint) return <div className="empty-state">Sprint not found.</div>;

  return (
    <div className="smaart-stack">
      <Link className="text-button" to={`/goals/${goalId}`}>Back to goal</Link>
      <div className="page-header">
        <div>
          <p className="eyebrow">Sprint detail</p>
          <h2>{sprint.title}</h2>
          <p className="lead">{sprint.objective || 'Sprint objective not written yet.'}</p>
        </div>
        <StatusBadge status={sprint.status} />
      </div>
      <Progress value={sprint.progressPercentage} />
      <div className="smaart-grid two">
        <Panel title="Sprint plan">
          <SprintEditPanel key={`${sprint.id}-${sprint.updatedAt}`} sprint={sprint} goalId={goalId} onSaved={reload} />
        </Panel>
        <Panel title="Sprint tasks">
          <TaskList tasks={tasks} onStatusChange={reload} empty="No tasks in this sprint." />
          <hr className="soft-line" />
          <TaskForm form={taskForm} onChange={setTaskForm} onSubmit={createTask} />
        </Panel>
      </div>
    </div>
  );
}

function GoalsKanban() {
  const [filter, setFilter] = useState('');
  const { data, loading, error, reload } = useLoad(apiSmaartKanban, []);
  const columns = data?.columns || [];

  const filteredColumns = columns.map((column) => ({
    ...column,
    tasks: column.tasks.filter((task) => {
      if (!filter) return true;
      const haystack = `${task.title} ${task.goalTitle} ${task.sprintTitle || ''}`.toLowerCase();
      return haystack.includes(filter.toLowerCase());
    })
  }));

  const onDrop = async (event, status) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain');
    if (!taskId) return;
    await apiSmaartUpdateTaskStatus(taskId, status);
    await reload();
  };

  return (
    <div className="smaart-stack">
      <StatusLine loading={loading} error={error} onRetry={reload} />
      <div className="smaart-toolbar">
        <input className="input" placeholder="Filter by task, goal, or sprint" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <button className="button secondary" type="button" onClick={reload}>Refresh board</button>
      </div>
      <div className="kanban-board">
        {filteredColumns.map((column) => (
          <div key={column.status} className="kanban-column" onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, column.status)}>
            <div className="panel-header">
              <h3>{label(column.status)}</h3>
              <span className="muted">{column.tasks.length}</span>
            </div>
            {column.tasks.map((task) => (
              <article key={task.id} className="kanban-card" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', String(task.id))}>
                <Link to={`/goals/${task.goalId}`}>{task.title}</Link>
                <p>{task.goalTitle}{task.sprintTitle ? ` / ${task.sprintTitle}` : ''}</p>
                <div className="smaart-card-foot">
                  <span>P{task.priority}</span>
                  <span>{task.dueDate ? prettyDate(task.dueDate) : 'No due date'}</span>
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalsCalendar() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [selected, setSelected] = useState(null);
  const from = `${month}-01`;
  const to = endOfMonth(month);
  const { data, loading, error, reload } = useLoad(() => apiSmaartCalendar(from, to), [from, to]);
  const events = useMemo(() => data?.events || [], [data?.events]);
  const eventsByDate = useMemo(() => events.reduce((map, event) => {
    const key = event.date || event.endDate || event.startDate;
    if (!key) return map;
    map[key] = [...(map[key] || []), event];
    return map;
  }, {}), [events]);

  return (
    <div className="smaart-stack">
      <StatusLine loading={loading} error={error} onRetry={reload} />
      <div className="smaart-toolbar">
        <input className="input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        <span className="muted">Goal deadlines, sprint ranges, and task due dates</span>
      </div>
      <div className="smaart-grid calendar-layout">
        <div className="calendar-month">
          {monthCells(month).map((cell) => (
            <button key={cell.key} type="button" className={`calendar-cell${cell.inMonth ? '' : ' muted-cell'}`} onClick={() => setSelected({ date: cell.date, events: eventsByDate[cell.date] || [] })}>
              <span>{cell.day}</span>
              <strong>{eventsByDate[cell.date]?.length || ''}</strong>
            </button>
          ))}
        </div>
        <Panel title={selected ? prettyDate(selected.date) : 'Select a day'} meta={`${selected?.events?.length || 0} items`}>
          {(selected?.events || []).map((event) => (
            <Link key={`${event.type}-${event.id}`} className="timeline-event" to={event.route}>
              <span className="chip">{event.type}</span>
              <strong>{event.title}</strong>
              <small>{event.parentGoal || label(event.status)}</small>
            </Link>
          ))}
          {selected && !selected.events.length ? <div className="empty-state">No items on this day.</div> : null}
        </Panel>
      </div>
    </div>
  );
}

function GoalsArchive() {
  const { data, loading, error, reload } = useLoad(apiSmaartArchive, []);
  const goals = data?.goals || [];

  const restore = async (goalId) => {
    await apiSmaartRestoreGoal(goalId);
    await reload();
  };

  const remove = async (goalId) => {
    if (!window.confirm('Permanently delete this goal?')) return;
    await apiSmaartDeleteGoal(goalId);
    await reload();
  };

  return (
    <div className="smaart-stack">
      <StatusLine loading={loading} error={error} onRetry={reload} />
      <Panel title="Archive" meta={`${goals.length} completed or archived`}>
        <div className="list">
          {goals.map((goal) => (
            <article key={goal.id} className="list-card">
              <div className="list-card-head">
                <div>
                  <strong>{goal.title}</strong>
                  <p>{goal.description || goal.category || 'Archived goal'}</p>
                </div>
                <div className="card-actions">
                  <button className="text-button" type="button" onClick={() => restore(goal.id)}>Restore</button>
                  <button className="text-button danger" type="button" onClick={() => remove(goal.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
          {!goals.length && !loading ? <div className="empty-state">No archived goals yet.</div> : null}
        </div>
      </Panel>
    </div>
  );
}

function GoalEditPanel({ goal, onSaved }) {
  const [form, setForm] = useState(() => goalToForm(goal));

  const saveGoal = async (event) => {
    event.preventDefault();
    await apiSmaartUpdateGoal(goal.id, goalPayload(form));
    await onSaved?.();
  };

  return (
    <Panel title="SMAART breakdown" meta="edit the thinking behind the goal">
      <GoalForm form={form} onChange={setForm} onSubmit={saveGoal} submitLabel="Save goal" />
    </Panel>
  );
}

function SprintEditPanel({ sprint, goalId, onSaved }) {
  const [form, setForm] = useState(() => sprintToForm(sprint));

  const saveSprint = async (event) => {
    event.preventDefault();
    await apiSmaartUpdateSprint(goalId, sprint.id, sprintPayload(form));
    await onSaved?.();
  };

  return <SprintForm form={form} onChange={setForm} onSubmit={saveSprint} submitLabel="Save sprint" />;
}

function GoalForm({ form, onChange, onSubmit, submitLabel }) {
  const update = (key, value) => onChange((current) => ({ ...current, [key]: value }));
  return (
    <form className="smaart-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <Field label="Title" value={form.title} onChange={(value) => update('title', value)} required />
        <label className="field">
          <span>Goal type</span>
          <select className="input" value={form.goalType} onChange={(event) => update('goalType', event.target.value)}>
            <option value="SHORT_TERM">Short-term</option>
            <option value="LONG_TERM">Long-term</option>
          </select>
        </label>
        <Field label="Category" value={form.category} onChange={(value) => update('category', value)} />
        <label className="field">
          <span>Priority</span>
          <select className="input" value={form.priority} onChange={(event) => update('priority', Number(event.target.value))}>
            {priorities.map((priority) => <option key={priority} value={priority}>P{priority}</option>)}
          </select>
        </label>
        <Field label="Start date" type="date" value={form.startDate} onChange={(value) => update('startDate', value)} />
        <Field label="Deadline" type="date" value={form.deadline} onChange={(value) => update('deadline', value)} required />
        <label className="field">
          <span>Status</span>
          <select className="input" value={form.status} onChange={(event) => update('status', event.target.value)}>
            {statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
        </label>
      </div>
      <Field label="Description" type="textarea" value={form.description} onChange={(value) => update('description', value)} />
      <details className="smaart-more">
        <summary>More SMAART fields</summary>
        <div className="form-grid">
          <Field label="Specific" type="textarea" value={form.specific} onChange={(value) => update('specific', value)} />
          <Field label="Measurable" type="textarea" value={form.measurable} onChange={(value) => update('measurable', value)} />
          <Field label="Achievable" type="textarea" value={form.achievable} onChange={(value) => update('achievable', value)} />
          <Field label="Action-oriented" type="textarea" value={form.actionOriented} onChange={(value) => update('actionOriented', value)} />
          <Field label="Relevant" type="textarea" value={form.relevant} onChange={(value) => update('relevant', value)} />
          <Field label="Time-bound" type="textarea" value={form.timeBound} onChange={(value) => update('timeBound', value)} />
          <Field label="Motivation" type="textarea" value={form.motivation} onChange={(value) => update('motivation', value)} />
          <Field label="Success criteria" type="textarea" value={form.successCriteria} onChange={(value) => update('successCriteria', value)} />
        </div>
        <Field label="Notes" type="textarea" value={form.notes} onChange={(value) => update('notes', value)} />
      </details>
      <button className="button" type="submit">{submitLabel}</button>
    </form>
  );
}

function TaskForm({ form, onChange, onSubmit, sprints = [] }) {
  const update = (key, value) => onChange((current) => ({ ...current, [key]: value }));
  return (
    <form className="smaart-form" onSubmit={onSubmit}>
      <Field label="Task title" value={form.title} onChange={(value) => update('title', value)} required />
      <div className="form-grid">
        <label className="field">
          <span>Status</span>
          <select className="input" value={form.status} onChange={(event) => update('status', event.target.value)}>
            {boardStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Priority</span>
          <select className="input" value={form.priority} onChange={(event) => update('priority', Number(event.target.value))}>
            {priorities.map((priority) => <option key={priority} value={priority}>P{priority}</option>)}
          </select>
        </label>
        <Field label="Due date" type="date" value={form.dueDate} onChange={(value) => update('dueDate', value)} />
        <Field label="Estimated minutes" type="number" value={form.estimatedMinutes} onChange={(value) => update('estimatedMinutes', value)} />
        {sprints.length ? (
          <label className="field">
            <span>Sprint</span>
            <select className="input" value={form.sprintId || ''} onChange={(event) => update('sprintId', event.target.value ? Number(event.target.value) : '')}>
              <option value="">No sprint</option>
              {sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.title}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <Field label="Description" type="textarea" value={form.description} onChange={(value) => update('description', value)} />
      <details className="smaart-more">
        <summary>More options</summary>
        <Field label="Tags" value={form.tags} onChange={(value) => update('tags', value)} />
        <Field label="Checklist items" type="textarea" value={form.checklistText} onChange={(value) => update('checklistText', value)} />
        <Field label="Notes" type="textarea" value={form.notes} onChange={(value) => update('notes', value)} />
      </details>
      <button className="button" type="submit">Add task</button>
    </form>
  );
}

function SprintForm({ form, onChange, onSubmit, submitLabel = 'Add sprint' }) {
  const update = (key, value) => onChange((current) => ({ ...current, [key]: value }));
  return (
    <form className="smaart-form" onSubmit={onSubmit}>
      <Field label="Sprint title" value={form.title} onChange={(value) => update('title', value)} required />
      <Field label="Objective" type="textarea" value={form.objective} onChange={(value) => update('objective', value)} />
      <div className="form-grid">
        <Field label="Start date" type="date" value={form.startDate} onChange={(value) => update('startDate', value)} />
        <Field label="End date" type="date" value={form.endDate} onChange={(value) => update('endDate', value)} />
        <label className="field">
          <span>Status</span>
          <select className="input" value={form.status} onChange={(event) => update('status', event.target.value)}>
            {boardStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
        </label>
      </div>
      <Field label="Notes" type="textarea" value={form.notes} onChange={(value) => update('notes', value)} />
      <button className="button" type="submit">{submitLabel}</button>
    </form>
  );
}

function TaskList({ tasks, onStatusChange, empty }) {
  const move = async (task, status) => {
    await apiSmaartUpdateTaskStatus(task.id, status);
    await onStatusChange?.();
  };

  return (
    <div className="list">
      {tasks.map((task) => (
        <article key={task.id} className={`smaart-task-row${task.completed ? ' complete' : ''}`}>
          <input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.completed} onChange={(event) => move(task, event.target.checked ? 'COMPLETED' : 'TODO')} />
          <div>
            <strong>{task.title}</strong>
            <p>{task.goalTitle}{task.sprintTitle ? ` / ${task.sprintTitle}` : ''}</p>
            <div className="chips">
              <span>P{task.priority}</span>
              <span>{task.dueDate ? prettyDate(task.dueDate) : 'No due date'}</span>
              <span>{label(task.status)}</span>
            </div>
          </div>
          <select className="input compact-input" value={task.status} onChange={(event) => move(task, event.target.value)}>
            {boardStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
          <button className="text-button danger" type="button" onClick={async () => { await apiSmaartDeleteTask(task.id); await onStatusChange?.(); }}>
            Delete
          </button>
        </article>
      ))}
      {!tasks.length ? <div className="empty-state">{empty}</div> : null}
    </div>
  );
}

function GoalMiniList({ goals, empty }) {
  return (
    <div className="list compact-list">
      {goals.map((goal) => (
        <Link key={goal.id} className="mini-card" to={`/goals/${goal.id}`}>
          <strong>{goal.title}</strong>
          <Progress value={goal.progressPercentage} />
          <span>{goal.deadline ? prettyDate(goal.deadline) : 'No deadline'} / {goal.urgency}</span>
        </Link>
      ))}
      {!goals.length ? <div className="empty-state">{empty}</div> : null}
    </div>
  );
}

function SprintMiniList({ sprints, empty }) {
  return (
    <div className="list compact-list">
      {sprints.map((sprint) => (
        <Link key={sprint.id} className="mini-card" to={`/goals/${sprint.goalId}/sprints/${sprint.id}`}>
          <strong>{sprint.title}</strong>
          <span>{sprint.goalTitle}</span>
          <Progress value={sprint.progressPercentage} />
        </Link>
      ))}
      {!sprints.length ? <div className="empty-state">{empty}</div> : null}
    </div>
  );
}

function ActivityList({ items }) {
  return (
    <div className="list compact-list">
      {items.map((item) => (
        <article key={item.id} className="mini-card">
          <strong>{item.action}</strong>
          <span>{item.description}</span>
        </article>
      ))}
      {!items.length ? <div className="empty-state">No activity yet.</div> : null}
    </div>
  );
}

function Panel({ title, meta, children }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        {meta ? <span className="muted">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label: statLabel, value, tone = '' }) {
  return (
    <article className={`smaart-stat ${tone}`}>
      <span>{statLabel}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Progress({ value = 0 }) {
  return (
    <div className="progress-track" aria-label={`Progress ${value}%`}>
      <div style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status?.toLowerCase()}`}>{label(status)}</span>;
}

function StatusLine({ loading, error, onRetry }) {
  if (loading) return <div className="notice">Loading...</div>;
  if (error) {
    return (
      <div className="notice error">
        {error}
        {onRetry ? <button className="text-button" type="button" onClick={onRetry}>Retry</button> : null}
      </div>
    );
  }
  return null;
}

function Field({ label: fieldLabel, value, onChange, type = 'text', required = false }) {
  return (
    <label className="field">
      <span>{fieldLabel}</span>
      {type === 'textarea' ? (
        <textarea className="input textarea" rows={3} value={value || ''} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className="input" type={type} required={required} value={value ?? ''} onChange={(event) => onChange(type === 'number' ? Number(event.target.value) : event.target.value)} />
      )}
    </label>
  );
}

function useLoad(loader, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((result) => {
        if (!cancelled) {
          setData(result);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshKey]);

  return { data, loading, error, reload: async () => setRefreshKey((current) => current + 1) };
}

function goalPayload(form) {
  return clean({
    ...form,
    priority: Number(form.priority || 3),
    deadline: form.deadline || offsetDate(7),
    startDate: form.startDate || today()
  });
}

function taskPayload(form) {
  return clean({
    ...form,
    estimatedMinutes: form.estimatedMinutes === '' ? null : Number(form.estimatedMinutes),
    checklistItems: splitLines(form.checklistText),
    sprintId: form.sprintId || null
  });
}

function sprintPayload(form) {
  return clean(form);
}

function clean(payload) {
  const next = { ...payload };
  for (const [key, value] of Object.entries(next)) {
    if (value === '') next[key] = null;
  }
  delete next.checklistText;
  return next;
}

function splitLines(value) {
  return (value || '').split('\n').map((line) => line.trim()).filter(Boolean);
}

function goalToForm(goal) {
  return {
    ...goalDefaults,
    ...goal,
    startDate: goal.startDate || today(),
    deadline: goal.deadline || offsetDate(7)
  };
}

function sprintToForm(sprint) {
  return {
    ...sprintDefaults,
    ...sprint,
    startDate: sprint.startDate || today(),
    endDate: sprint.endDate || offsetDate(14)
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function prettyDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function label(value) {
  return String(value || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function toneForUrgency(value) {
  if (value === 'Overdue' || value === 'Behind schedule') return 'danger';
  if (value === 'Needs attention') return 'warning';
  return '';
}

function endOfMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function monthCells(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const startOffset = first.getUTCDay();
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return {
      key: iso,
      date: iso,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthNumber - 1
    };
  });
}
