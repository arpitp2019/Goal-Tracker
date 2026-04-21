import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import {
  apiClearGoalActivity,
  apiCreateGoal,
  apiDeleteGoal,
  apiGoalsOverview,
  apiMarkGoalActivity,
  apiUpdateGoal
} from './api';

const emptyList = [];
const emptyStats = {
  totalGoals: 0,
  activeGoals: 0,
  completedGoals: 0,
  progressedToday: 0,
  overdueGoals: 0,
  todayProgress: 0,
  weeklyConsistency: 0,
  monthlyConsistency: 0,
  yearlyActiveDays: 0,
  currentStreak: 0,
  bestStreak: 0
};
const emptyAnalytics = {
  statusMix: {},
  priorityMix: {},
  overdueGoals: [],
  topStreaks: []
};
const goalDefaults = {
  title: '',
  description: '',
  status: 'PLANNED',
  priority: 3,
  dueDate: ''
};
const goalTabs = [
  { to: '/habits/checklist', label: 'Checklist' },
  { to: '/habits/calendar', label: 'Calendar' },
  { to: '/habits/analytics', label: 'Analytics' }
];
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function GoalTrackerPage() {
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedYear, setSelectedYear] = useState(new Date().getUTCFullYear());
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(goalDefaults);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiGoalsOverview(selectedDate, selectedYear)
      .then((data) => {
        if (!cancelled) {
          setOverview(data);
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
  }, [selectedDate, selectedYear, refreshKey]);

  const stats = overview?.stats || emptyStats;
  const analytics = overview?.analytics || emptyAnalytics;
  const goals = overview?.goals || emptyList;
  const checklist = overview?.checklist || emptyList;
  const calendarDays = overview?.calendarDays || emptyList;
  const calendarWeeks = useMemo(() => buildYearWeeks(selectedYear, calendarDays), [calendarDays, selectedYear]);
  const selectedDay = calendarDays.find((day) => day.date === selectedDate);
  const selectedGoals = selectedDay?.progressedGoalIds
    ?.map((id) => goals.find((goal) => goal.id === id))
    .filter(Boolean) || emptyList;

  const resetForm = () => {
    setEditingId(null);
    setForm(goalDefaults);
  };

  const editGoal = (goal) => {
    setEditingId(goal.id);
    setForm({
      title: goal.title || '',
      description: goal.description || '',
      status: goal.status || 'PLANNED',
      priority: goal.priority ?? 3,
      dueDate: goal.dueDate || ''
    });
  };

  const submitGoal = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, priority: Number(form.priority), dueDate: form.dueDate || null };
      if (editingId) {
        await apiUpdateGoal(editingId, payload);
      } else {
        await apiCreateGoal(payload);
      }
      resetForm();
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteGoal = async (goal) => {
    if (!window.confirm(`Delete "${goal.title}"?`)) {
      return;
    }
    await apiDeleteGoal(goal.id);
    setRefreshKey((current) => current + 1);
  };

  const toggleGoal = async (goal, checked) => {
    const optimisticActivity = checked;
    setOverview((current) => optimisticGoalOverview(current, goal.id, selectedDate, optimisticActivity));
    try {
      if (checked) {
        await apiMarkGoalActivity(goal.id, { activityDate: selectedDate, note: 'Progress from checklist' });
      } else {
        await apiClearGoalActivity(goal.id, selectedDate);
      }
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err.message);
      setRefreshKey((current) => current + 1);
    }
  };

  return (
    <section className="page goals-page">
      <div className="page-header goals-header">
        <div>
          <p className="eyebrow">Habits</p>
          <h2>Daily progress for habits that matter.</h2>
          <p className="lead">Check progress, scan the year, and keep habit momentum visible.</p>
        </div>
        <div className="goal-actions">
          <button className="button secondary" type="button" onClick={resetForm}>
            New habit
          </button>
          <button className="button secondary" type="button" onClick={() => setRefreshKey((current) => current + 1)}>
            Refresh
          </button>
        </div>
      </div>

      <div className="tabs goal-tabs" role="tablist" aria-label="Habit pages">
        {goalTabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            {tab.label}
          </NavLink>
        ))}
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <Routes>
        <Route index element={<Navigate to="checklist" replace />} />
        <Route
          path="checklist"
          element={
            <GoalChecklistView
              checklist={checklist}
              form={form}
              saving={saving}
              editingId={editingId}
              loading={loading}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onFormChange={setForm}
              onSubmit={submitGoal}
              onReset={resetForm}
              onToggle={toggleGoal}
              onEdit={editGoal}
              onDelete={deleteGoal}
            />
          }
        />
        <Route
          path="calendar"
          element={
            <GoalCalendarView
              selectedYear={selectedYear}
              selectedDate={selectedDate}
              calendarWeeks={calendarWeeks}
              selectedDay={selectedDay}
              selectedGoals={selectedGoals}
              onYearChange={setSelectedYear}
              onDateChange={setSelectedDate}
            />
          }
        />
        <Route path="analytics" element={<GoalAnalyticsView stats={stats} analytics={analytics} goals={goals} />} />
      </Routes>
    </section>
  );
}

function GoalChecklistView({ checklist, form, saving, editingId, loading, selectedDate, onDateChange, onFormChange, onSubmit, onReset, onToggle, onEdit, onDelete }) {
  return (
    <div className="goals-checklist-layout">
      <section className="panel goal-section">
        <div className="panel-header">
          <div>
            <h3>Checklist</h3>
            <p className="muted">Progress for {formatDateLabel(selectedDate)}</p>
          </div>
          <input className="input compact-date" type="date" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} />
        </div>
        <div className="goal-list">
          {loading ? <div className="empty-state">Loading habits...</div> : null}
          {!loading && checklist.length === 0 ? <div className="empty-state">No active habits yet.</div> : null}
          {checklist.map((goal) => (
            <article key={goal.id} className={`goal-row${goal.progressedToday ? ' complete' : ''}${goal.overdue ? ' overdue' : ''}`}>
              <input
                className="goal-row-check"
                type="checkbox"
                checked={goal.progressedToday}
                aria-label={`Progress ${goal.title}`}
                onChange={(event) => onToggle(goal, event.target.checked)}
              />
              <div className="goal-row-copy">
                <div className="goal-row-head">
                  <strong>{goal.title}</strong>
                  <span className="pill">{goal.status}</span>
                </div>
                <p>{goal.description || 'No description yet.'}</p>
                <div className="goal-row-meta">
                  <span>Priority {goal.priority}</span>
                  {goal.dueDate ? <span>Due {goal.dueDate}</span> : null}
                  <span>{goal.currentStreak} day streak</span>
                  <span>{goal.weeklyConsistency}% week</span>
                </div>
              </div>
              <div className="goal-row-actions">
                <button className="text-button" type="button" onClick={() => onEdit(goal)}>
                  Edit
                </button>
                <button className="text-button danger" type="button" onClick={() => onDelete(goal)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <form className="panel goal-form" onSubmit={onSubmit}>
        <div className="panel-header">
          <h3>{editingId ? 'Edit habit' : 'Create habit'}</h3>
          <span className="muted">Daily progress stays separate from DONE</span>
        </div>
        <label className="field">
          <span>Title</span>
          <input className="input" value={form.title} onChange={(event) => setGoalFormValue(onFormChange, 'title', event.target.value)} required />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="input textarea" rows={3} value={form.description} onChange={(event) => setGoalFormValue(onFormChange, 'description', event.target.value)} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Status</span>
            <select className="input" value={form.status} onChange={(event) => setGoalFormValue(onFormChange, 'status', event.target.value)}>
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <input className="input" type="number" min="1" max="5" value={form.priority} onChange={(event) => setGoalFormValue(onFormChange, 'priority', event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Due date</span>
          <input className="input" type="date" value={form.dueDate} onChange={(event) => setGoalFormValue(onFormChange, 'dueDate', event.target.value)} />
        </label>
        <div className="form-actions">
          <button className="button" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update habit' : 'Create habit'}
          </button>
          <button className="button secondary" type="button" onClick={onReset}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function GoalCalendarView({ selectedYear, selectedDate, calendarWeeks, selectedDay, selectedGoals, onYearChange, onDateChange }) {
  return (
    <section className="panel goal-section">
      <div className="panel-header">
        <div>
          <h3>Calendar</h3>
          <p className="muted">Yearly activity frame</p>
        </div>
        <div className="goal-calendar-actions">
          <button className="text-button" type="button" onClick={() => onYearChange(selectedYear - 1)}>
            Prev
          </button>
          <strong>{selectedYear}</strong>
          <button className="text-button" type="button" onClick={() => onYearChange(selectedYear + 1)}>
            Next
          </button>
        </div>
      </div>
      <div className="goal-year-shell">
        <div className="goal-month-labels">
          {monthNames.map((month) => (
            <span key={month}>{month}</span>
          ))}
        </div>
        <div className="goal-year-body">
          <div className="goal-weekday-labels">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="goal-year-grid" aria-label="Habit yearly activity calendar">
            {calendarWeeks.map((week, weekIndex) => (
              <div className="goal-year-week" key={`week-${weekIndex}`}>
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <span className="goal-day-pad" key={`pad-${weekIndex}-${dayIndex}`} />;
                  }
                  const level = dayLevel(day);
                  return (
                    <button
                      key={day.date}
                      type="button"
                      className={`goal-day level-${level}${day.date === selectedDate ? ' selected' : ''}`}
                      data-date={day.date}
                      data-level={level}
                      aria-label={`${formatDateLabel(day.date)} ${day.progressedGoalCount}/${day.activeGoalCount} habits`}
                      onClick={() => onDateChange(day.date)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="goal-calendar-detail">
        <div>
          <span className="eyebrow">{formatDateLabel(selectedDate)}</span>
          <h4>{selectedDay?.progressedGoalCount || 0}/{selectedDay?.activeGoalCount || 0} habits progressed</h4>
        </div>
        <div className="goal-mini-list">
          {selectedGoals.length === 0 ? <span className="muted">No progress logged for this day.</span> : null}
          {selectedGoals.map((goal) => (
            <span key={goal.id} className="pill">{goal.title}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function GoalAnalyticsView({ stats, analytics, goals }) {
  return (
    <section className="panel goal-section">
      <div className="panel-header">
        <div>
          <h3>Analytics</h3>
          <p className="muted">Progress health across habits</p>
        </div>
        <span className="pill">{stats.totalGoals} habits</span>
      </div>
      <div className="goal-stats-grid">
        <StatChip label="Today" value={`${stats.todayProgress}%`} />
        <StatChip label="Week" value={`${stats.weeklyConsistency}%`} />
        <StatChip label="Month" value={`${stats.monthlyConsistency}%`} />
        <StatChip label="Year active days" value={stats.yearlyActiveDays} />
        <StatChip label="Current streak" value={stats.currentStreak} />
        <StatChip label="Best streak" value={stats.bestStreak} />
      </div>
      <div className="goal-analytics-grid">
        {goals.map((goal) => (
          <article key={goal.id} className="goal-analytics-card">
            <div className="goal-row-head">
              <strong>{goal.title}</strong>
              <span className="pill">{goal.status}</span>
            </div>
            <ProgressMeter label="Weekly" value={goal.weeklyConsistency} />
            <ProgressMeter label="Monthly" value={goal.monthlyConsistency} />
            <div className="goal-row-meta">
              <span>{goal.currentStreak} current</span>
              <span>{goal.bestStreak} longest</span>
              <span>{goal.yearlyProgressDays} days this year</span>
            </div>
          </article>
        ))}
      </div>
      <div className="goal-mix-row">
        <MixBlock title="Status mix" values={analytics.statusMix} />
        <MixBlock title="Priority mix" values={analytics.priorityMix} />
      </div>
    </section>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="habit-summary-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressMeter({ label, value }) {
  const numeric = Number.isFinite(value) ? value : 0;
  return (
    <div className="habit-progress">
      <div className="progress-row-head">
        <span>{label}</span>
        <strong>{numeric}%</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${numeric}%` }} />
      </div>
    </div>
  );
}

function MixBlock({ title, values }) {
  return (
    <div className="goal-mix-block">
      <h4>{title}</h4>
      <div className="goal-mini-list">
        {Object.entries(values || {}).map(([key, value]) => (
          <span key={key} className="pill">{key}: {value}</span>
        ))}
      </div>
    </div>
  );
}

function setGoalFormValue(setForm, key, value) {
  setForm((current) => ({ ...current, [key]: value }));
}

function optimisticGoalOverview(current, goalId, selectedDate, progressedToday) {
  if (!current) {
    return current;
  }
  const updateGoal = (goal) => {
    if (goal.id !== goalId) {
      return goal;
    }
    return {
      ...goal,
      status: progressedToday && goal.status === 'PLANNED' ? 'IN_PROGRESS' : goal.status,
      progressedToday
    };
  };
  const updateDay = (day) => {
    if (day.date !== selectedDate) {
      return day;
    }
    const ids = new Set(day.progressedGoalIds || []);
    if (progressedToday) {
      ids.add(goalId);
    } else {
      ids.delete(goalId);
    }
    return {
      ...day,
      progressedGoalCount: ids.size,
      progressedGoalIds: [...ids]
    };
  };
  return {
    ...current,
    goals: (current.goals || emptyList).map(updateGoal),
    checklist: (current.checklist || emptyList).map(updateGoal),
    calendarDays: (current.calendarDays || emptyList).map(updateDay)
  };
}

function buildYearWeeks(year, days) {
  const dayMap = new Map((days || []).map((day) => [day.date, day]));
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const cursor = new Date(start);
  const firstOffset = (cursor.getUTCDay() + 6) % 7;
  cursor.setUTCDate(cursor.getUTCDate() - firstOffset);
  const weeks = [];
  while (cursor <= end || weeks.length < 53) {
    const week = [];
    for (let day = 0; day < 7; day += 1) {
      const iso = cursor.toISOString().slice(0, 10);
      week.push(cursor.getUTCFullYear() === year ? dayMap.get(iso) || { date: iso, activeGoalCount: 0, progressedGoalCount: 0, progressedGoalIds: [] } : null);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
    if (weeks.length >= 53 && cursor > end) {
      break;
    }
  }
  return weeks;
}

function dayLevel(day) {
  if (!day || day.activeGoalCount === 0 || day.progressedGoalCount === 0) {
    return 0;
  }
  const ratio = day.progressedGoalCount / day.activeGoalCount;
  if (ratio >= 1) return 4;
  if (ratio >= 0.66) return 3;
  if (ratio >= 0.33) return 2;
  return 1;
}

function formatDateLabel(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
