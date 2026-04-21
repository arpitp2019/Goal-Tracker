import { expect, test } from '@playwright/test';

const email = `habits-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
const today = new Date().toISOString().slice(0, 10);

test('Habits shows checklist, calendar consistency, and analytics', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('.segmented').getByRole('button', { name: 'Create account' }).click();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Display name').fill('Habit Tester');
  await page.getByLabel('Password').fill('Secret123!');
  await page.locator('.auth-form').getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('link', { name: 'Habits' })).toBeVisible();
  await page.getByRole('link', { name: 'Habits' }).click();
  await expect(page).toHaveURL(/\/habits\/checklist$/);
  await expect(page.getByRole('link', { name: 'Checklist' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Calendar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Daily progress for habits that matter.' })).toBeVisible();

  await page.getByRole('button', { name: 'New habit' }).click();
  await page.getByLabel('Title').fill('Morning walk');
  await page.getByLabel('Description').fill('Walk after tea before opening messages.');
  await page.getByLabel('Status').selectOption('PLANNED');
  await page.getByLabel('Priority').fill('4');
  await page.getByLabel('Due date').fill(today);
  await page.getByRole('button', { name: 'Create habit' }).click();
  await expect(page.locator('.goal-row').filter({ hasText: 'Morning walk' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'New habit' }).click();
  await page.getByLabel('Title').fill('Read pages');
  await page.getByLabel('Description').fill('Read before entertainment.');
  await page.getByLabel('Priority').fill('3');
  await page.getByRole('button', { name: 'Create habit' }).click();
  await expect(page.locator('.goal-row').filter({ hasText: 'Read pages' }).first()).toBeVisible();

  const walkCheckbox = page.getByRole('checkbox', { name: 'Progress Morning walk' });
  await markHabitComplete(page, walkCheckbox);
  await expect(walkCheckbox).toBeChecked();
  await expect(page.locator('.goal-row.complete').filter({ hasText: 'Morning walk' }).first()).toBeVisible();

  const readCheckbox = page.getByRole('checkbox', { name: 'Progress Read pages' });
  await markHabitComplete(page, readCheckbox);
  await expect(readCheckbox).toBeChecked();
  await expect(page.locator('.goal-row.complete').filter({ hasText: 'Read pages' }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Calendar' }).click();
  await expect(page).toHaveURL(/\/habits\/calendar$/);
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  await expect(page.locator(`.goal-day[data-date="${today}"]`)).not.toHaveAttribute('data-level', '0');

  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page).toHaveURL(/\/habits\/analytics$/);
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.locator('.goal-analytics-card').filter({ hasText: 'Morning walk' }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Checklist' }).click();
  await expect(page.getByRole('heading', { name: 'Checklist' })).toBeVisible();
  await expect(page.locator('.goal-row.complete').filter({ hasText: 'Morning walk' }).first()).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'Checklist' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Checklist' })).toBeVisible();
  await page.getByRole('link', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  await expect(page.locator(`.goal-day[data-date="${today}"]`)).not.toHaveAttribute('data-level', '0');
});

async function markHabitComplete(page, checkbox) {
  const checkinResponse = page.waitForResponse((response) => {
    return response.request().method() === 'POST' && response.url().includes('/api/goals/') && response.url().includes('/activity');
  });

  await checkbox.click();
  await checkinResponse;
}
