import { useEffect, useState } from 'react';
import {
  apiCheckInHabit,
  apiClearHabitCheckIn,
  apiCreateHabit,
  apiDeleteHabit,
  apiHabitsOverview,
  apiUpdateHabit
} from './api';

const dayOptions = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' }
];

const habitDefaults = {
  title: '',
  description: '',
  habitType: 'BUILD',
  scheduleType: 'DAILY',
  scheduledDays: [1, 2, 3, 4, 5, 6, 7],
  targetValue: '',
  targetUnit: '',
  reminderTime: '',
  startDate: today(),
  endDate: '',
  tags: '',
  color: '#4be1c3',
  priority: 3,
  paused: false,
  archived: false,
  cue: '',
  routine: '',
  reward: '',
  friction: '',
  identityStatement: '',
  notes: ''
};

const statusLabels = {
  DONE: 'Done',
  PARTIAL: 'Partial',
  SKIPPED: 'Skipped',
  MISSED: 'Missed'
};

const emptyList = [];
const emptyStats = {};
const emptyAnalytics = {};

function HabitTrackerPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(habitDefaults);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('today');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [checkinValues, setCheckinValues] = useState({});

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiHabitsOverview(today());
      setOverview(data);
      setSelectedId((current) => current || data.habits?.[0]?.id || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    apiHabitsOverview(today())
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setSelectedId(data.habits?.[0]?.id || null);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const habits = overview?.habits || emptyList;
  const todayHabits = overview?.today || emptyList;
  const stats = overview?.stats || emptyStats;
  const analytics = overview?.analytics || emptyAnalytics;
  const selectedHabit = habits.find((habit) => habit.id === selectedId) || habits[0] || null;

  const filteredHabits = (() => {
    const term = search.trim().toLowerCase();
    return habits.filter((habit) => {
      if (term) {
        const haystack = [habit.title, habit.description, habit.notes, habit.cue, habit.identityStatement, ...(habit.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }
      switch (filter) {
        case 'today':
          return habit.dueToday;
        case 'overdue':
          return habit.overdue;
        case 'paused':
          return habit.paused;
        case 'archived':
          return habit.archived;
        case 'build':
        case 'quit':
        case 'numeric':
        case 'timer':
          return habit.habitType === filter.toUpperCase();
        default:
          return true;
      }
    });
  })();

  const resetForm = () => {
    setEditingId(null);
    setForm(habitDefaults);
  };

  const editHabit = (habit) => {
    setEditingId(habit.id);
    setSelectedId(habit.id);
    setForm({
      title: habit.title || '',
      description: habit.description || '',
      habitType: habit.habitType || 'BUILD',
      scheduleType: habit.scheduleType || 'DAILY',
      scheduledDays: habit.scheduledDays?.length ? habit.scheduledDays : [1, 2, 3, 4, 5, 6, 7],
      targetValue: habit.targetValue ?? '',
      targetUnit: habit.targetUnit || '',
      reminderTime: habit.reminderTime || '',
      startDate: habit.startDate || today(),
      endDate: habit.endDate || '',
      tags: joinTags(habit.tags),
      color: habit.color || '#4be1c3',
      priority: habit.priority ?? 3,
      paused: Boolean(habit.paused),
      archived: Boolean(habit.archived),
      cue: habit.cue || '',
      routine: habit.routine || '',
      reward: habit.reward || '',
      friction: habit.friction || '',
      identityStatement: habit.identityStatement || '',
      notes: habit.notes || ''
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = normalizeHabitPayload(form);
      if (editingId) {
        await apiUpdateHabit(editingId, payload);
      } else {
        const created = await apiCreateHabit(payload);
        setSelectedId(created.id);
      }
      await refresh();
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (habit) => {
    if (!window.confirm(`Delete "${habit.title}"?`)) {
      return;
    }
    await apiDeleteHabit(habit.id);
    await refresh();
    if (selectedId === habit.id) {
      setSelectedId(null);
    }
  };

  const checkIn = async (habit, status) => {
    const value = checkinValues[habit.id] === '' || checkinValues[habit.id] == null ? null : Number(checkinValues[habit.id]);
    await apiCheckInHabit(habit.id, {
      checkinDate: today(),
      status,
      value,
      note: status === 'DONE' ? 'Quick check-in' : '',
      mood: null,
      energy: null
    });
    await refresh();
  };

  const clearToday = async (habit) => {
    await apiClearHabitCheckIn(habit.id, today());
    await refresh();
  };

  return (
    <section className="page habit-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Habits</p>
          <h2>Daily operating system for behavior change.</h2>
          <p className="lead">Build routines, quit patterns, measure numeric goals, and keep reminders visible inside FlowDash.</p>
        </div>
        <div className="habit-actions">
          <button className="button secondary" type="button" onClick={resetForm}>
            New habit
          </button>
          <button className="button secondary" type="button" onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <div className="habit-hero">
        <StatCard label="Today" value={`${stats.completedToday ?? 0}/${stats.dueToday ?? 0}`} hint={`${stats.todayProgress ?? 0}% complete`} />
        <StatCard label="Weekly consistency" value={`${stats.weeklyConsistency ?? 0}%`} hint="Last 7 days" />
        <StatCard label="Active streaks" value={stats.activeStreaks ?? 0} hint={`Best streak ${stats.bestStreak ?? 0}`} />
        <StatCard label="Overdue" value={stats.overdue ?? 0} hint="Needs recovery" />
      </div>

      <div className="habit-layout">
        <div className="habit-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Today</h3>
                <p className="muted">One-click check-ins for the habits due now.</p>
              </div>
              <span className="pill">{loading ? 'Refreshing...' : `${todayHabits.length} due`}</span>
            </div>
            <div className="habit-list">
              {todayHabits.length === 0 ? <div className="empty-state">No habits due today. Nice quiet dashboard.</div> : null}
              {todayHabits.map((habit) => (
                <HabitTodayCard
                  key={habit.id}
                  habit={habit}
                  value={checkinValues[habit.id] ?? ''}
                  onValueChange={(value) => setCheckinValues((current) => ({ ...current, [habit.id]: value }))}
                  onCheckIn={checkIn}
                  onClear={clearToday}
                  onSelect={() => setSelectedId(habit.id)}
                />
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Habit library</h3>
              <span className="muted">{filteredHabits.length} shown</span>
            </div>
            <div className="habit-filter-bar">
              <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search habits or tags" aria-label="Search habits" />
              <select className="input" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Habit filter">
                <option value="today">Due today</option>
                <option value="all">All habits</option>
                <option value="overdue">Overdue</option>
                <option value="build">Build</option>
                <option value="quit">Quit</option>
                <option value="numeric">Numeric</option>
                <option value="timer">Timer</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="entity-list">
              {filteredHabits.map((habit) => (
                <article key={habit.id} className={`entity-card habit-card${habit.id === selectedId ? ' active' : ''}`}>
                  <button className="habit-card-main" type="button" onClick={() => setSelectedId(habit.id)}>
                    <span className="habit-color" style={{ background: habit.color }} />
                    <span>
                      <strong>{habit.title}</strong>
                      <small>{habit.description || habit.identityStatement || 'No description yet'}</small>
                    </span>
                  </button>
                  <div className="chips">
                    <span>{habit.habitType}</span>
                    <span>{habit.scheduleType}</span>
                    {habit.overdue ? <span>Overdue</span> : null}
                    {habit.paused ? <span>Paused</span> : null}
                    <span>{habit.completionRate}% rate</span>
                    <span>{habit.currentStreak} streak</span>
                  </div>
                  <div className="card-actions">
                    <button className="text-button" type="button" onClick={() => editHabit(habit)}>
                      Edit
                    </button>
                    <button className="text-button danger" type="button" onClick={() => remove(habit)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              {filteredHabits.length === 0 ? <div className="empty-state">No habits match this view yet.</div> : null}
            </div>
          </section>
        </div>

        <div className="habit-column">
          <HabitForm form={form} setForm={setForm} editingId={editingId} saving={saving} onSubmit={submit} onCancel={resetForm} />

          <section className="panel">
            <div className="panel-header">
              <h3>Habit detail</h3>
              <span className="muted">{selectedHabit ? selectedHabit.reminderLabel : 'Select a habit'}</span>
            </div>
            {selectedHabit ? <HabitDetail habit={selectedHabit} /> : <div className="empty-state">Create or select a habit to see its design notes and history.</div>}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Analytics</h3>
              <span className="muted">Weak spots and load</span>
            </div>
            <div className="insight-grid">
              <InsightList title="Needs recovery" items={analytics.weakHabits || []} empty="No weak habits yet." />
              <InsightList title="Best streaks" items={analytics.bestStreaks || []} empty="No streaks yet." />
            </div>
            <div className="forecast-grid habit-forecast">
              {(analytics.weeklyLoad || []).map((point) => (
                <div key={point.date} className="forecast-item">
                  <span>{shortDay(point.date)}</span>
                  <strong>{point.completedCount}/{point.dueCount}</strong>
                  <div className="forecast-bar">
                    <div className="forecast-fill" style={{ width: `${point.dueCount ? Math.round((point.completedCount / point.dueCount) * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function HabitForm({ form, setForm, editingId, saving, onSubmit, onCancel }) {
  const isMeasured = form.habitType === 'NUMERIC' || form.habitType === 'TIMER';
  return (
    <form className="panel habit-form" onSubmit={onSubmit}>
      <div className="panel-header">
        <h3>{editingId ? 'Edit habit' : 'Create habit'}</h3>
        <span className="muted">Stored in PostgreSQL</span>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Habit title</span>
          <input className="input" value={form.title} onChange={(event) => setFormValue(setForm, 'title', event.target.value)} required />
        </label>
        <label className="field">
          <span>Type</span>
          <select className="input" value={form.habitType} onChange={(event) => setFormValue(setForm, 'habitType', event.target.value)}>
            <option value="BUILD">Build</option>
            <option value="QUIT">Quit / avoid</option>
            <option value="NUMERIC">Numeric</option>
            <option value="TIMER">Timer</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>Description</span>
        <textarea className="input textarea" value={form.description} onChange={(event) => setFormValue(setForm, 'description', event.target.value)} rows={3} />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Schedule</span>
          <select className="input" value={form.scheduleType} onChange={(event) => updateSchedule(setForm, event.target.value)}>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="CUSTOM">Custom days</option>
          </select>
        </label>
        <label className="field">
          <span>Reminder time</span>
          <input className="input" type="time" value={form.reminderTime} onChange={(event) => setFormValue(setForm, 'reminderTime', event.target.value)} />
        </label>
      </div>

      {form.scheduleType !== 'DAILY' ? (
        <fieldset className="day-picker">
          <legend>Scheduled days</legend>
          {dayOptions.map((day) => (
            <label key={day.value}>
              <input
                type="checkbox"
                checked={form.scheduledDays.includes(day.value)}
                onChange={() => toggleDay(setForm, day.value)}
              />
              <span>{day.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {isMeasured ? (
        <div className="form-grid">
          <label className="field">
            <span>Target value</span>
            <input className="input" type="number" min="0" step="0.1" value={form.targetValue} onChange={(event) => setFormValue(setForm, 'targetValue', event.target.value)} />
          </label>
          <label className="field">
            <span>Target unit</span>
            <input className="input" value={form.targetUnit} onChange={(event) => setFormValue(setForm, 'targetUnit', event.target.value)} placeholder={form.habitType === 'TIMER' ? 'minutes' : 'pages, reps, glasses'} />
          </label>
        </div>
      ) : null}

      <div className="form-grid">
        <label className="field">
          <span>Start date</span>
          <input className="input" type="date" value={form.startDate} onChange={(event) => setFormValue(setForm, 'startDate', event.target.value)} />
        </label>
        <label className="field">
          <span>End date</span>
          <input className="input" type="date" value={form.endDate} onChange={(event) => setFormValue(setForm, 'endDate', event.target.value)} />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Priority</span>
          <input className="input" type="number" min="1" max="5" value={form.priority} onChange={(event) => setFormValue(setForm, 'priority', Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Color</span>
          <input className="input" type="color" value={form.color} onChange={(event) => setFormValue(setForm, 'color', event.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Tags</span>
        <input className="input" value={form.tags} onChange={(event) => setFormValue(setForm, 'tags', event.target.value)} placeholder="health, focus, morning" />
      </label>

      <div className="behavior-grid">
        <label className="field">
          <span>Cue</span>
          <input className="input" value={form.cue} onChange={(event) => setFormValue(setForm, 'cue', event.target.value)} />
        </label>
        <label className="field">
          <span>Routine</span>
          <input className="input" value={form.routine} onChange={(event) => setFormValue(setForm, 'routine', event.target.value)} />
        </label>
        <label className="field">
          <span>Reward</span>
          <input className="input" value={form.reward} onChange={(event) => setFormValue(setForm, 'reward', event.target.value)} />
        </label>
        <label className="field">
          <span>Friction to remove</span>
          <input className="input" value={form.friction} onChange={(event) => setFormValue(setForm, 'friction', event.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Identity statement</span>
        <input className="input" value={form.identityStatement} onChange={(event) => setFormValue(setForm, 'identityStatement', event.target.value)} placeholder="I am the kind of person who..." />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea className="input textarea" value={form.notes} onChange={(event) => setFormValue(setForm, 'notes', event.target.value)} rows={3} />
      </label>

      <div className="habit-toggle-row">
        <label className="field checkbox">
          <input type="checkbox" checked={form.paused} onChange={(event) => setFormValue(setForm, 'paused', event.target.checked)} />
          <span>Paused</span>
        </label>
        <label className="field checkbox">
          <input type="checkbox" checked={form.archived} onChange={(event) => setFormValue(setForm, 'archived', event.target.checked)} />
          <span>Archived</span>
        </label>
      </div>

      <div className="form-actions">
        <button className="button" disabled={saving}>
          {saving ? 'Saving...' : editingId ? 'Update habit' : 'Create habit'}
        </button>
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function HabitTodayCard({ habit, value, onValueChange, onCheckIn, onClear, onSelect }) {
  const measured = habit.habitType === 'NUMERIC' || habit.habitType === 'TIMER';
  return (
    <article className={`study-card habit-today-card ${habit.todayCheckin?.successful ? 'complete' : ''}`}>
      <div className="study-card-head">
        <button type="button" className="habit-card-main" onClick={onSelect}>
          <span className="habit-color" style={{ background: habit.color }} />
          <span>
            <strong>{habit.title}</strong>
            <small>{habit.todayCheckin ? statusLabels[habit.todayCheckin.status] : habit.reminderLabel}</small>
          </span>
        </button>
        <span className="pill">{habit.currentStreak} streak</span>
      </div>
      {measured ? (
        <label className="field compact-field">
          <span>{habit.targetUnit || 'Value'} today</span>
          <input className="input" type="number" step="0.1" value={value} onChange={(event) => onValueChange(event.target.value)} placeholder={`Target ${habit.targetValue ?? ''}`} />
        </label>
      ) : null}
      <div className="rating-row habit-checkins">
        <button className="rating-button rating-2" type="button" onClick={() => onCheckIn(habit, 'DONE')}>
          <strong>{habit.habitType === 'QUIT' ? 'Avoided' : 'Done'}</strong>
          <span>Success</span>
        </button>
        <button className="rating-button rating-1" type="button" onClick={() => onCheckIn(habit, 'PARTIAL')}>
          <strong>Partial</strong>
          <span>Some progress</span>
        </button>
        <button className="rating-button" type="button" onClick={() => onCheckIn(habit, 'SKIPPED')}>
          <strong>Skip</strong>
          <span>Intentional</span>
        </button>
        <button className="rating-button rating-0" type="button" onClick={() => onCheckIn(habit, 'MISSED')}>
          <strong>Missed</strong>
          <span>Recover</span>
        </button>
      </div>
      {habit.todayCheckin ? (
        <button className="text-button" type="button" onClick={() => onClear(habit)}>
          Clear today
        </button>
      ) : null}
    </article>
  );
}

function HabitDetail({ habit }) {
  const heatmap = Array.from({ length: 21 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (20 - index));
    return date.toISOString().slice(0, 10);
  });
  return (
    <div className="habit-detail">
      <div className="progress-row">
        <div className="progress-row-head">
          <span>Completion rate</span>
          <strong>{habit.completionRate}%</strong>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${habit.completionRate}%` }} />
        </div>
      </div>
      <div className="habit-design-grid">
        <DesignNote label="Cue" value={habit.cue} />
        <DesignNote label="Routine" value={habit.routine} />
        <DesignNote label="Reward" value={habit.reward} />
        <DesignNote label="Friction" value={habit.friction} />
      </div>
      {habit.identityStatement ? <p className="identity-note">{habit.identityStatement}</p> : null}
      <div className="habit-calendar" aria-label="Calendar style history">
        {heatmap.map((date, index) => (
          <span key={date} className={`calendar-dot intensity-${index % 4}`} title={date} />
        ))}
      </div>
      <div className="chips">
        {(habit.tags || []).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </div>
  );
}

function DesignNote({ label, value }) {
  return (
    <div className="insight-card">
      <span className="eyebrow">{label}</span>
      <p>{value || 'Not set yet'}</p>
    </div>
  );
}

function InsightList({ title, items, empty }) {
  return (
    <div className="insight-card">
      <h4>{title}</h4>
      {items.length === 0 ? <p className="muted">{empty}</p> : null}
      {items.map((habit) => (
        <div key={habit.id} className="muted-row">
          <strong>{habit.title}</strong>
          <span>{habit.completionRate}%</span>
          <span>{habit.bestStreak} best</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <article className="stat-card">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function setFormValue(setForm, key, value) {
  setForm((current) => ({ ...current, [key]: value }));
}

function updateSchedule(setForm, scheduleType) {
  setForm((current) => ({
    ...current,
    scheduleType,
    scheduledDays: scheduleType === 'DAILY' ? [1, 2, 3, 4, 5, 6, 7] : current.scheduledDays.filter((day) => day >= 1 && day <= 7)
  }));
}

function toggleDay(setForm, day) {
  setForm((current) => {
    const days = current.scheduledDays.includes(day)
      ? current.scheduledDays.filter((candidate) => candidate !== day)
      : [...current.scheduledDays, day].sort();
    return { ...current, scheduledDays: days.length ? days : [day] };
  });
}

function normalizeHabitPayload(form) {
  return {
    ...form,
    targetValue: form.targetValue === '' ? null : Number(form.targetValue),
    reminderTime: form.reminderTime || null,
    startDate: form.startDate || today(),
    endDate: form.endDate || null,
    tags: splitTags(form.tags)
  };
}

function splitTags(value) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function joinTags(tags) {
  return (tags || []).join(', ');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shortDay(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

export default HabitTrackerPage;
