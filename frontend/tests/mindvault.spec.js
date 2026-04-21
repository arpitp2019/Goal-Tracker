import { expect, test } from '@playwright/test';

const email = `mindvault-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

test('MindVault supports subject planning, sprint capture, queue review, and spaced repetition', async ({ page }) => {
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
  await expect(page).toHaveURL(/\/vault$/);
  await expect(page.getByRole('button', { name: 'Quick add topic' })).toBeVisible();

  await page.getByRole('button', { name: 'New subject' }).click();
  await page.getByRole('textbox', { name: 'Subject' }).fill('Physics');
  await page.getByLabel('Description').fill('Study waves, motion, and energy.');
  await page.getByLabel('Priority').fill('5');
  await page.getByLabel('Target mastery').fill('85');
  await page.getByLabel('Deadline').fill(futureDate(14));
  await page.getByLabel('Tags').fill('science, semester-2');
  await page.getByRole('button', { name: 'Create subject' }).click();
  await expect(page.locator('.entity-card').filter({ hasText: 'Physics' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'New sprint' }).click();
  await page.getByRole('combobox', { name: 'Subject' }).selectOption({ label: 'Physics' });
  await page.getByLabel('Sprint title').fill('Wave foundations');
  await page.getByLabel('Description').fill('Build a sprint around core wave concepts.');
  await page.getByLabel('Status').selectOption('ACTIVE');
  await page.getByLabel('Start date').fill(today());
  await page.getByLabel('Due date').fill(futureDate(7));
  await page.getByLabel('Estimated sessions').fill('4');
  await page.getByLabel('Completed sessions').fill('1');
  await page.getByRole('button', { name: 'Create sprint' }).click();
  await expect(page.locator('.entity-card').filter({ hasText: 'Wave foundations' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Quick add topic' }).click();
  await page.getByLabel('Source').selectOption('RANDOM');
  await page.getByRole('combobox', { name: 'Subject' }).selectOption({ label: 'Physics' });
  await page.getByLabel('Sprint').selectOption({ label: 'Wave foundations' });
  await page.getByLabel('Topic title').fill('Quantum basics');
  await page.getByLabel('Prompt').fill('What is the key idea of wave-particle duality?');
  await page.getByLabel('Answer / notes').fill('Matter and energy can behave like waves and particles depending on the experiment.');
  await page.getByLabel('Study notes').fill('Remember the photoelectric effect example.');
  await page.getByLabel('Tags').fill('quantum, waves');
  await page.getByRole('button', { name: 'Create topic' }).click();

  await expect(page.getByText('1 queued')).toBeVisible();
  await expect(page.locator('.queue-item').filter({ hasText: 'Quantum basics' }).first()).toBeVisible();

  await page.locator('.queue-item').filter({ hasText: 'Quantum basics' }).first().click();
  await page.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(page.getByText(/Matter and energy can behave like waves and particles/)).toBeVisible();
  await page.getByRole('button', { name: 'Good' }).click();

  await expect(page.getByText('Everything is caught up')).toBeVisible();
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function futureDate(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}
