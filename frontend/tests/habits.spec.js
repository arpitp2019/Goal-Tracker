import { expect, test } from '@playwright/test';

const email = `habits-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

test('Habits supports flexible creation, check-ins, analytics, and refresh', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('.segmented').getByRole('button', { name: 'Create account' }).click();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Display name').fill('Habit Tester');
  await page.getByLabel('Password').fill('Secret123!');
  await page.locator('.auth-form').getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('link', { name: 'Habits' })).toBeVisible();
  await page.getByRole('link', { name: 'Habits' }).click();
  await expect(page).toHaveURL(/\/habits$/);
  await expect(page.getByText('Daily operating system for behavior change.')).toBeVisible();

  await page.getByLabel('Habit title').fill('Morning walk');
  await page.getByLabel('Description').fill('Walk after tea before opening messages.');
  await page.getByLabel('Type').selectOption('BUILD');
  await page.getByLabel('Reminder time').fill('07:30');
  await page.getByLabel('Tags').fill('health, morning');
  await page.getByLabel('Cue').fill('Finish tea');
  await page.getByLabel('Routine').fill('Walk for ten minutes');
  await page.getByLabel('Reward').fill('Fresh playlist');
  await page.getByLabel('Identity statement').fill('I am the kind of person who starts the day with movement.');
  await page.getByRole('button', { name: 'Create habit' }).click();
  await expect(page.locator('.habit-card').filter({ hasText: 'Morning walk' }).first()).toBeVisible();

  await page.getByLabel('Habit title').fill('Read pages');
  await page.getByLabel('Description').fill('Read before entertainment.');
  await page.getByLabel('Type').selectOption('NUMERIC');
  await page.getByLabel('Target value').fill('20');
  await page.getByLabel('Target unit').fill('pages');
  await page.getByLabel('Tags').fill('learning');
  await page.getByRole('button', { name: 'Create habit' }).click();
  await expect(page.locator('.habit-card').filter({ hasText: 'Read pages' }).first()).toBeVisible();

  const walkCard = page.locator('.habit-today-card').filter({ hasText: 'Morning walk' }).first();
  await walkCard.getByRole('button', { name: /Done|Avoided/ }).click();
  await expect(walkCard.getByText('Done')).toBeVisible();

  const readCard = page.locator('.habit-today-card').filter({ hasText: 'Read pages' }).first();
  await readCard.getByLabel('pages today').fill('25');
  await readCard.getByRole('button', { name: /Done|Avoided/ }).click();

  await expect(page.locator('.habit-hero').getByText('2/2').first()).toBeVisible();
  await expect(page.getByText('Best streaks')).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Daily operating system for behavior change.')).toBeVisible();
  await expect(page.locator('.habit-card').filter({ hasText: 'Morning walk' }).first()).toBeVisible();
});
