import { expect, test } from '@playwright/test';

const email = `goals-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
const deadline = futureDate(10);

test('SMAART Goals supports planning, task progress, sprint setup, Kanban, calendar, and deep routes', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => window.localStorage.removeItem('flowdash_theme'));
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('.segmented').getByRole('button', { name: 'Create account' }).click();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Display name').fill('Goals Tester');
  await page.getByLabel('Password').fill('Secret123!');
  const registerResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/api/auth/register'));
  await page.locator('.auth-form').getByRole('button', { name: 'Create account' }).click();
  await registerResponse;
  await page.waitForURL(/\/$/, { timeout: 20000 });

  await expect(page.locator('.nav').getByRole('link', { name: /Goals/ })).toBeVisible();
  await page.locator('.nav').getByRole('link', { name: /Goals/ }).click();
  await expect(page).toHaveURL(/\/goals\/priorities$/);
  await expect(page.getByRole('heading', { name: /Rank the next best task/i })).toBeVisible();

  await page.goto('/goals/list', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '+ New Goal' }).click();
  await page.getByLabel('Title').fill('Publish focused portfolio');
  await page.getByLabel('Description').fill('Create a concise portfolio page and publish it.');
  await page.getByLabel('Deadline').fill(deadline);
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page).toHaveURL(/\/goals\/\d+$/);
  await expect(page.getByRole('heading', { name: 'Publish focused portfolio' })).toBeVisible();

  await page.goto('/goals/priorities', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Rank the next best task/i })).toBeVisible();
  await page.getByRole('button', { name: 'Light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Edit weights' }).click();
  await expect(page.getByRole('heading', { name: 'Scoring weights' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide weights' }).click();

  await page.getByLabel('Task title').fill('Draft portfolio copy');
  await page.getByLabel('Category').fill('Writing');
  await page.getByLabel('Due date').fill(deadline);
  await page.getByRole('button', { name: 'Add ranked task' }).click();

  const priorityRow = page.locator('.priority-table tbody tr').first();
  await expect(priorityRow).toBeVisible();
  await expect(priorityRow).toContainText('Draft portfolio copy');
  const initialScore = Number(await priorityRow.locator('.score-badge strong').textContent());
  await priorityRow.getByRole('button', { name: 'Edit' }).click();
  await priorityRow.locator('select').first().selectOption('5');
  const saveResponse = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().includes('/api/smaart-tasks/'));
  await priorityRow.getByRole('button', { name: 'Save' }).click();
  await saveResponse;
  const updatedScore = Number(await priorityRow.locator('.score-badge strong').textContent());
  expect(updatedScore).toBeGreaterThan(initialScore);

  await page.selectOption('.priorities-toolbar select:nth-of-type(2)', 'Writing');
  await expect(priorityRow).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/smaart-priorities-.*\.csv/);

  await page.goto('/goals/list', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '+ New Goal' }).click();
  await page.getByLabel('Goal type').selectOption('LONG_TERM');
  await page.getByLabel('Title').fill('Build Java revision roadmap');
  await page.getByLabel('Deadline').fill(futureDate(30));
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page).toHaveURL(/\/goals\/\d+$/);
  await page.getByRole('button', { name: 'Sprints' }).click();
  await page.getByLabel('Sprint title').fill('Sprint 1: core concepts');
  await page.getByLabel('Objective').fill('Finish the first set of core Java revision topics.');
  await page.getByRole('button', { name: 'Add sprint' }).click();
  await expect(page.getByRole('link', { name: /Sprint 1: core concepts/ })).toBeVisible();

  await page.goto('/goals/kanban', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();
  await expect(page.locator('.kanban-card').filter({ hasText: 'Draft portfolio copy' })).toBeVisible();

  await page.goto('/goals/calendar', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Goal deadlines, sprint ranges, and task due dates')).toBeVisible();

  await page.goto('/goals/archive', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();

  await page.goto('/goals/kanban', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();
});

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
