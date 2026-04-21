import { useEffect, useMemo, useRef, useState } from 'react';
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
const emptyStats = {
  dueToday: 0,
  completedToday: 0,
  todayProgress: 0,
  weeklyConsistency: 0,
  monthlyConsistency: 0,
  activeStreaks: 0,
  bestStreak: 0,
  overdue: 0
};
const emptyAnalytics = {
  weakHabits: [],
  bestStreaks: [],
  weeklyLoad: [],
  monthlyTrend: []
};

function HabitTrackerPage() {
  const [selectedDate, setSelectedDate] = useState(today());
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(habitDefaults);
  const [checkinValues, setCheckinValues] = useState({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiHabitsOverview(selectedDate);
        if (cancelled) {
          return;
        }
        setOverview(data);
        setCheckinValues(seedCheckinValues(data.today || emptyList));
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, refreshKey]);

  const habits = overview?.habits || emptyList;
  const todayHabits = overview?.today || emptyList;
  const stats = overview?.stats || emptyStats;
  const analytics = overview?.analytics || emptyAnalytics;
  const calendarDays = overview?.calendarDays || emptyList;
  const editableToday = selectedDate === today();

  const calendarCells = useMemo(() => buildCalendarCells(selectedDate, calendarDays), [calendarDays, selectedDate]);
  const analyticsHabits = useMemo(
    () =>
      [...habits].sort((left, right) => {
        const activeRank = Number(Boolean(left.archived)) - Number(Boolean(right.archived));
        if (activeRank !== 0) {
          return activeRank;
        }
        return left.title.localeCompare(right.title);
      }),
    [habits]
  );

  const selectedLabel = editableToday ? 'Today' : formatDateLabel(selectedDate);
  const monthLabel = formatMonthLabel(selectedDate);

  const openNewHabit = () => {
    setEditingId(null);
    setForm({ ...habitDefaults, startDate: today() });
    setEditorOpen(true);
  };

  const openEditHabit = (habit) => {
    setEditingId(habit.id);
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
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
  };

  const submitHabit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = normalizeHabitPayload(form);
      if (editingId) {
        await apiUpdateHabit(editingId, payload);
      } else {
        await apiCreateHabit(payload);
      }
      setEditorOpen(false);
      setEditingId(null);
      setForm({ ...habitDefaults, startDate: today() });
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeHabit = async (habit) => {
    if (!window.confirm(`Delete "${habit.title}"?`)) {
      return;
    }
    await apiDeleteHabit(habit.id);
    setRefreshKey((current) => current + 1);
  };

  const toggleCheckin = async (habit, checked, valueOverride = null) => {
    if (!editableToday) {
      return;
    }
    if (!checked) {
      setOverview((current) => optimisticOverview(current, habit.id, null));
      try {
        await apiClearHabitCheckIn(habit.id, selectedDate);
        setRefreshKey((current) => current + 1);
      } catch (err) {
        setError(err.message);
        setRefreshKey((current) => current + 1);
      }
      return;
    }

    const rawValue = valueOverride ?? checkinValues[habit.id];
    const numericValue = rawValue === '' || rawValue == null ? null : Number(rawValue);
    const status = inferCheckinStatus(habit, numericValue);
    const optimisticCheckin = {
      status,
      value: numericValue,
      note: status === 'DONE' ? 'Marked from checklist' : '',
      successful: status === 'DONE'
    };
    setOverview((current) => optimisticOverview(current, habit.id, optimisticCheckin));

    try {
      await apiCheckInHabit(habit.id, {
        checkinDate: selectedDate,
        status,
        value: numericValue,
        note: status === 'DONE' ? 'Marked from checklist' : '',
        mood: null,
        energy: null
      });
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err.message);
      setRefreshKey((current) => current + 1);
    }
  };

  const changeMonth = (offset) => {
    setSelectedDate((current) => shiftMonth(current, offset));
  };

  return (
    <section className="page habit-page">
      <div className="page-header habit-header">
        <div>
          <p className="eyebrow">Habits</p>
          <h2>Simple habit tracking that stays out of the way.</h2>
          <p className="lead">Checklist first, calendar second, analytics last. Keep the page light and let the data stay connected.</p>
        </div>
        <div className="habit-actions">
          <button className="button secondary" type="button" onClick={openNewHabit}>
            New habit
          </button>
          <button className="button secondary" type="button" onClick={() => setRefreshKey((current) => current + 1)}>
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <section className="panel habit-section">
        <div className="panel-header">
          <div>
            <h3>Daily Habit Checklist</h3>
            <p className="muted">Toggle today’s habits directly. Past days are read-only history.</p>
          </div>
          <span className="pill">{selectedLabel}</span>
        </div>
        <div className="habit-summary-strip">
          <SummaryChip label="Done today" value={`${stats.completedToday ?? 0}/${stats.dueToday ?? 0}`} />
          <SummaryChip label="Week" value={`${stats.weeklyConsistency ?? 0}%`} />
          <SummaryChip label="Month" value={`${stats.monthlyConsistency ?? 0}%`} />
          <SummaryChip label="Active streaks" value={`${stats.activeStreaks ?? 0}`} />
        </div>
        <div className="habit-checklist">
          {!loading && todayHabits.length === 0 ? <div className="empty-state">No habits are due for this date.</div> : null}
          {todayHabits.map((habit) => (
            <HabitChecklistRow
              key={habit.id}
              habit={habit}
              editable={editableToday}
              value={checkinValues[habit.id] ?? ''}
              onValueChange={(value) => setCheckinValues((current) => ({ ...current, [habit.id]: value }))}
              onToggle={toggleCheckin}
              onEdit={openEditHabit}
            />
          ))}
          {loading ? <div className="empty-state">Loading habits…</div> : null}
        </div>
      </section>

      <section className="panel habit-section">
        <div className="panel-header">
          <div>
            <h3>Calendar Consistency View</h3>
            <p className="muted">Each day shows how many due habits were completed. Tap a day to review that date.</p>
          </div>
          <div className="habit-calendar-actions">
            <button className="text-button" type="button" onClick={() => changeMonth(-1)}>
              Prev
            </button>
            <button className="text-button" type="button" onClick={() => setSelectedDate(today())}>
              Today
            </button>
            <button className="text-button" type="button" onClick={() => changeMonth(1)}>
              Next
            </button>
          </div>
        </div>
        <div className="calendar-head">
          <strong>{monthLabel}</strong>
          <div className="calendar-legend">
            <span><i className="legend-swatch legend-full" /> Full</span>
            <span><i className="legend-swatch legend-partial" /> Partial</span>
            <span><i className="legend-swatch legend-empty" /> Empty</span>
          </div>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {weekdayLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="habit-calendar-grid" aria-label="Calendar consistency grid">
          {calendarCells.map((cell, index) => {
            if (!cell) {
              return <span key={`pad-${index}`} className="calendar-pad" />;
            }

            const status = calendarStatus(cell);
            const selected = cell.date === selectedDate;
            const dayNumber = parseIsoDate(cell.date).getUTCDate();
            const ratioText = cell.dueCount === 0 ? '—' : `${cell.completedCount}/${cell.dueCount}`;

            return (
              <button
                key={cell.date}
                type="button"
                data-date={cell.date}
                data-status={status}
                aria-pressed={selected}
                aria-label={`${formatDateLabel(cell.date)} ${ratioText}`}
                className={`calendar-day ${status}${selected ? ' selected' : ''}${cell.date === today() ? ' today' : ''}`}
                onClick={() => setSelectedDate(cell.date)}
              >
                <strong>{dayNumber}</strong>
                <span>{ratioText}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel habit-section">
        <div className="panel-header">
          <div>
            <h3>Habit Analytics Dashboard</h3>
            <p className="muted">Completion rate, streaks, and simple trend bars for every habit.</p>
          </div>
          <span className="pill">{analyticsHabits.length} habits</span>
        </div>
        <div className="habit-summary-strip">
          <SummaryChip label="At risk" value={`${analytics.weakHabits?.length ?? 0}`} />
          <SummaryChip label="Top streak" value={`${analytics.bestStreaks?.[0]?.bestStreak ?? 0}`} />
          <SummaryChip label="This week" value={`${stats.weeklyConsistency ?? 0}%`} />
          <SummaryChip label="This month" value={`${stats.monthlyConsistency ?? 0}%`} />
        </div>
        <div className="habit-analytics-grid">
          {analyticsHabits.map((habit) => (
            <HabitAnalyticsCard
              key={habit.id}
              habit={habit}
              onEdit={() => openEditHabit(habit)}
              onDelete={() => removeHabit(habit)}
            />
          ))}
          {!loading && analyticsHabits.length === 0 ? <div className="empty-state">Create a habit to see analytics here.</div> : null}
        </div>
      </section>

      {editorOpen ? (
        <HabitEditorModal
          editingId={editingId}
          form={form}
          saving={saving}
          onClose={closeEditor}
          onSubmit={submitHabit}
          setForm={setForm}
        />
      ) : null}
    </section>
  );
}

function HabitChecklistRow({ habit, editable, value, onValueChange, onToggle, onEdit }) {
  const measuredValueRef = useRef(null);
  const completed = Boolean(habit.todayCheckin?.successful);
  const partial = habit.todayCheckin != null && !habit.todayCheckin.successful && habit.todayCheckin.status === 'PARTIAL';
  const measured = habit.habitType === 'NUMERIC' || habit.habitType === 'TIMER';
  const status = habit.todayCheckin ? statusLabels[habit.todayCheckin.status] || 'Checked' : habit.reminderLabel;

  return (
    <article
      className={`habit-row${completed ? ' complete' : ''}${partial ? ' partial' : ''}${habit.paused ? ' paused' : ''}${habit.archived ? ' archived' : ''}`}
      data-complete={completed ? 'true' : 'false'}
    >
      <input
        className="habit-row-check"
        type="checkbox"
        checked={completed}
        disabled={!editable}
        aria-label={`Complete ${habit.title}`}
        onChange={(event) => onToggle(habit, event.target.checked, measured ? measuredValueRef.current?.value ?? value : value)}
      />
      <div className="habit-row-color" aria-hidden="true" style={{ background: habit.color }} />
      <div className="habit-row-copy">
        <div className="habit-row-head">
          <strong>{habit.title}</strong>
          <span className="pill">{status}</span>
        </div>
        <p>{habit.description || habit.identityStatement || 'No description yet.'}</p>
        <div className="habit-row-meta">
          <span>{habit.currentStreak} streak</span>
          <span>{habit.completionRate}%</span>
          {habit.targetValue != null ? <span>{habit.targetValue} {habit.targetUnit || ''}</span> : null}
        </div>
      </div>
      {measured ? (
        <input
          className="input habit-mini-input"
          ref={measuredValueRef}
          type="number"
          step="0.1"
          aria-label={`${habit.title} value`}
          value={value}
          disabled={!editable}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={habit.targetValue != null ? `Target ${habit.targetValue}` : 'Value'}
        />
      ) : null}
      <button className="text-button" type="button" onClick={() => onEdit(habit)}>
        Edit
      </button>
    </article>
  );
}

function HabitAnalyticsCard({ habit, onEdit, onDelete }) {
  return (
    <article className={`habit-analytics-card${habit.archived ? ' archived' : ''}${habit.paused ? ' paused' : ''}`} style={{ '--habit-accent': habit.color }}>
      <div className="habit-analytics-head">
        <div>
          <div className="habit-card-title">
            <strong>{habit.title}</strong>
            <span className="pill">{habit.habitType}</span>
          </div>
          <p>{habit.description || habit.identityStatement || 'No description yet.'}</p>
        </div>
        <div className="habit-card-actions">
          <button className="text-button" type="button" onClick={onEdit}>
            Edit
          </button>
          <button className="text-button danger" type="button" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="habit-score-row">
        <div>
          <span className="eyebrow">Consistency score</span>
          <strong>{habit.consistencyScore}%</strong>
        </div>
        <div className="habit-score-pill">{habit.currentStreak} current / {habit.bestStreak} longest</div>
      </div>

      <ProgressMeter label="Completion" value={habit.completionRate} />
      <ProgressMeter label="Weekly trend" value={habit.weeklyConsistency} accent />
      <ProgressMeter label="Monthly trend" value={habit.monthlyConsistency} accent />

      <div className="habit-analytics-meta">
        <span>{habit.totalCheckins} logs</span>
        <span>{habit.successfulCheckins} successful</span>
        {habit.overdue ? <span>Overdue</span> : null}
        {habit.paused ? <span>Paused</span> : null}
        {habit.archived ? <span>Archived</span> : null}
      </div>
    </article>
  );
}

function HabitEditorModal({ editingId, form, saving, onClose, onSubmit, setForm }) {
  const measured = form.habitType === 'NUMERIC' || form.habitType === 'TIMER';

  return (
    <div className="habit-editor-backdrop" role="presentation" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="panel habit-editor" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit habit' : 'Create habit'}>
        <div className="panel-header">
          <div>
            <h3>{editingId ? 'Edit habit' : 'Create habit'}</h3>
            <p className="muted">The main form stays light. More details live under the fold.</p>
          </div>
          <button className="text-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="habit-editor-form" onSubmit={onSubmit}>
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
            <fieldset className="day-picker compact">
              <legend>Scheduled days</legend>
              {dayOptions.map((day) => (
                <label key={day.value}>
                  <input type="checkbox" checked={form.scheduledDays.includes(day.value)} onChange={() => toggleDay(setForm, day.value)} />
                  <span>{day.label}</span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {measured ? (
            <div className="form-grid">
              <label className="field">
                <span>Target value</span>
                <input className="input" type="number" min="0" step="0.1" value={form.targetValue} onChange={(event) => setFormValue(setForm, 'targetValue', event.target.value)} />
              </label>
              <label className="field">
                <span>Target unit</span>
                <input
                  className="input"
                  value={form.targetUnit}
                  onChange={(event) => setFormValue(setForm, 'targetUnit', event.target.value)}
                  placeholder={form.habitType === 'TIMER' ? 'minutes' : 'pages, reps, glasses'}
                />
              </label>
            </div>
          ) : null}

          <details className="habit-more-options">
            <summary>More options</summary>
            <div className="habit-more-grid">
              <label className="field">
                <span>Start date</span>
                <input className="input" type="date" value={form.startDate} onChange={(event) => setFormValue(setForm, 'startDate', event.target.value)} />
              </label>
              <label className="field">
                <span>End date</span>
                <input className="input" type="date" value={form.endDate} onChange={(event) => setFormValue(setForm, 'endDate', event.target.value)} />
              </label>
              <label className="field">
                <span>Priority</span>
                <input className="input" type="number" min="1" max="5" value={form.priority} onChange={(event) => setFormValue(setForm, 'priority', Number(event.target.value))} />
              </label>
              <label className="field">
                <span>Color</span>
                <input className="input" type="color" value={form.color} onChange={(event) => setFormValue(setForm, 'color', event.target.value)} />
              </label>
              <label className="field full-span">
                <span>Tags</span>
                <input className="input" value={form.tags} onChange={(event) => setFormValue(setForm, 'tags', event.target.value)} placeholder="health, focus, morning" />
              </label>
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
              <label className="field full-span">
                <span>Identity statement</span>
                <input className="input" value={form.identityStatement} onChange={(event) => setFormValue(setForm, 'identityStatement', event.target.value)} placeholder="I am the kind of person who..." />
              </label>
              <label className="field full-span">
                <span>Notes</span>
                <textarea className="input textarea" value={form.notes} onChange={(event) => setFormValue(setForm, 'notes', event.target.value)} rows={3} />
              </label>
              <label className="field checkbox-inline">
                <input type="checkbox" checked={form.paused} onChange={(event) => setFormValue(setForm, 'paused', event.target.checked)} />
                <span>Paused</span>
              </label>
              <label className="field checkbox-inline">
                <input type="checkbox" checked={form.archived} onChange={(event) => setFormValue(setForm, 'archived', event.target.checked)} />
                <span>Archived</span>
              </label>
            </div>
          </details>

          <div className="form-actions">
            <button className="button" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update habit' : 'Create habit'}
            </button>
            <button className="button secondary" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProgressMeter({ label, value, accent = false }) {
  const numeric = Number.isFinite(value) ? value : 0;
  return (
    <div className="habit-progress">
      <div className="progress-row-head">
        <span>{label}</span>
        <strong>{numeric}%</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${numeric}%`, background: accent ? 'var(--habit-accent, linear-gradient(90deg, #7a8dff, #4be1c3))' : undefined }} />
      </div>
    </div>
  );
}

function SummaryChip({ label, value }) {
  return (
    <div className="habit-summary-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildCalendarCells(selectedDate, calendarDays) {
  const reference = parseIsoDate(selectedDate);
  const monthStart = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const offset = (monthStart.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: offset }, () => null);
  calendarDays.forEach((day) => {
    cells.push(day);
  });
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function calendarStatus(day) {
  if (!day || day.dueCount === 0 || day.completedCount === 0) {
    return 'empty';
  }
  return day.completedCount >= day.dueCount ? 'full' : 'partial';
}

function inferCheckinStatus(habit, value) {
  if (habit.habitType === 'NUMERIC' || habit.habitType === 'TIMER') {
    if (habit.targetValue == null) {
      return value == null ? 'PARTIAL' : 'DONE';
    }
    if (value == null) {
      return 'PARTIAL';
    }
    return value >= habit.targetValue ? 'DONE' : 'PARTIAL';
  }
  return habit.habitType === 'QUIT' ? 'DONE' : 'DONE';
}

function seedCheckinValues(habits) {
  const next = {};
  habits.forEach((habit) => {
    if (habit.todayCheckin?.value != null) {
      next[habit.id] = String(habit.todayCheckin.value);
    }
  });
  return next;
}

function optimisticOverview(current, habitId, todayCheckin) {
  if (!current) {
    return current;
  }

  const updateHabit = (habit) => (habit.id === habitId ? { ...habit, todayCheckin } : habit);
  return {
    ...current,
    habits: (current.habits || emptyList).map(updateHabit),
    today: (current.today || emptyList).map(updateHabit),
    overdue: (current.overdue || emptyList).map(updateHabit),
    upcomingReminders: (current.upcomingReminders || emptyList).map(updateHabit)
  };
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
      : [...current.scheduledDays, day].sort((left, right) => left - right);
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

function parseIsoDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function shiftMonth(value, offset) {
  const date = parseIsoDate(value);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return toIsoDate(date);
}

function formatDateLabel(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(parseIsoDate(value));
}

function formatMonthLabel(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parseIsoDate(value));
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default HabitTrackerPage;
