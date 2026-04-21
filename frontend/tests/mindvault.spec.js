import { expect, test } from '@playwright/test';

const email = `mindvault-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

test('MindVault shows overview, plan, library, queue, and insights on separate pages', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const segmented = page.locator('.segmented');
  const authForm = page.locator('.auth-form');
  const createAccountButton = segmented.getByRole('button', { name: 'Create account' });
  await expect(createAccountButton).toBeVisible();
  await createAccountButton.click();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Display name').fill('MindVault Tester');
  await page.getByLabel('Password').fill('Secret123!');
  await expect(authForm.getByRole('button', { name: 'Create account' })).toBeVisible();
  await authForm.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('link', { name: 'MindVault' })).toBeVisible();
  await page.getByRole('link', { name: 'MindVault' }).click();
  await expect(page).toHaveURL(/\/vault\/overview$/);
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
  await expect(page.locator('.stat-card').filter({ hasText: 'Due today' }).first()).toBeVisible();

  await page.goto('/vault/plan');
  await expect(page).toHaveURL(/\/vault\/plan$/);
  await page.getByRole('textbox', { name: 'Subject' }).fill('Physics');
  await page.getByLabel('Description').first().fill('Study waves, motion, and energy.');
  await page.getByLabel('Priority').first().fill('5');
  await page.getByLabel('Target mastery').fill('85');
  await page.getByLabel('Deadline').first().fill(futureDate(14));
  await page.getByLabel('Tags').first().fill('science, semester-2');
  const subjectResponse = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/mindvault/subjects') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Create subject' }).click()
  ]).then(([response]) => response);
  await expect(subjectResponse.status()).toBe(200);
  await expect(page.locator('.entity-card').filter({ hasText: 'Physics' }).first()).toBeVisible();

  await page.getByRole('combobox', { name: 'Subject' }).last().selectOption({ label: 'Physics' });
  await page.getByRole('textbox', { name: 'Sprint title' }).fill('Wave foundations');
  await page.getByLabel('Description').last().fill('Build a sprint around core wave concepts.');
  await page.getByLabel('Status').selectOption('ACTIVE');
  await page.getByLabel('Start date').fill(today());
  await page.getByLabel('Due date').fill(futureDate(7));
  await page.getByLabel('Estimated sessions').fill('4');
  await page.getByLabel('Completed sessions').fill('1');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/mindvault/sprints') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Create sprint' }).click()
  ]);
  await expect(page.locator('.entity-card').filter({ hasText: 'Wave foundations' }).first()).toBeVisible();

  await page.goto('/vault/library');
  await expect(page).toHaveURL(/\/vault\/library$/);
  await page.getByLabel('Source').selectOption('RANDOM');
  await page.getByRole('combobox', { name: 'Subject' }).first().selectOption({ label: 'Physics' });
  await page.getByRole('combobox', { name: 'Sprint' }).first().selectOption({ label: 'Wave foundations' });
  await page.getByLabel('Topic title').fill('Quantum basics');
  await page.getByLabel('Prompt').fill('What is the key idea of wave-particle duality?');
  await page.getByLabel('Answer / notes').fill('Matter and energy can behave like waves and particles depending on the experiment.');
  await page.getByLabel('Study notes').fill('Remember the photoelectric effect example.');
  await page.getByLabel('Tags').last().fill('quantum, waves');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/mindvault/items') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Create topic' }).click()
  ]);
  await expect(page.locator('.entity-card').filter({ hasText: 'Quantum basics' }).first()).toBeVisible();

  await page.goto('/vault/queue');
  await expect(page).toHaveURL(/\/vault\/queue$/);
  await expect(page.getByText('Review what matters today')).toBeVisible();
  await expect(page.locator('.queue-item').first()).toBeVisible();
  await page.locator('.queue-item').first().click();
  await page.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(page.getByText(/Matter and energy can behave like waves and particles/)).toBeVisible();
  await page.getByRole('button', { name: 'Good' }).click();

  await page.goto('/vault/insights');
  await expect(page).toHaveURL(/\/vault\/insights$/);
  await expect(page.getByText('Subject load and forecast')).toBeVisible();
  await expect(page.locator('.insight-card').filter({ hasText: 'Physics' }).first()).toBeVisible();
  await expect(page.locator('.forecast-item').first()).toBeVisible();
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function futureDate(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}
