import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const email = `mindvault-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
const samplePdf = fileURLToPath(new URL('./fixtures/study-note.pdf', import.meta.url));

test('MindVault supports inbox capture, review, library, subjects, and insights pages', async ({ page }) => {
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
  await expect(page).toHaveURL(/\/vault\/review$/);
  await expect(page.getByRole('link', { name: 'Review' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Due queue' })).toBeVisible();

  await page.goto('/vault/');
  await expect(page).toHaveURL(/\/vault\/review$/);
  await expect(page.getByRole('heading', { name: 'Due queue' })).toBeVisible();

  await page.goto('/vault/subjects');
  await expect(page).toHaveURL(/\/vault\/subjects$/);
  await expect(page.getByRole('heading', { name: 'Structured learning map' })).toBeVisible();

  const subjectForm = page.locator('form.mindvault-form').nth(0);
  await subjectForm.getByLabel('Subject').fill('Physics');
  await subjectForm.getByLabel('Description').fill('Study waves, motion, and energy.');
  await subjectForm.getByLabel('Target mastery').fill('85');
  await subjectForm.getByLabel('Deadline').fill(futureDate(14));
  await subjectForm.getByLabel('Tags').fill('science, semester-2');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/mindvault/subjects') && response.request().method() === 'POST'),
    subjectForm.getByRole('button', { name: 'Create subject' }).click()
  ]);
  await expect(page.locator('.entity-card').filter({ hasText: 'Physics' }).first()).toBeVisible();

  const sprintForm = page.locator('form.mindvault-form').nth(1);
  await sprintForm.getByLabel('Subject').selectOption({ label: 'Physics' });
  await sprintForm.getByLabel('Sprint title').fill('Wave foundations');
  await sprintForm.getByLabel('Status').selectOption('ACTIVE');
  await sprintForm.getByLabel('Due date').fill(futureDate(7));
  await sprintForm.getByLabel('Description').fill('Build a sprint around core wave concepts.');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/mindvault/sprints') && response.request().method() === 'POST'),
    sprintForm.getByRole('button', { name: 'Create sprint' }).click()
  ]);
  await expect(page.locator('.entity-card').filter({ hasText: 'Wave foundations' }).first()).toBeVisible();

  await page.goto('/vault/inbox');
  await expect(page).toHaveURL(/\/vault\/inbox$/);
  await expect(page.getByRole('heading', { name: "Capture today's learning" })).toBeVisible();

  const captureForm = page.locator('form.mindvault-form').first();
  await captureForm.getByLabel('Resource type').selectOption('PDF');
  await expect(captureForm.locator('input[type="file"]')).toBeVisible();

  await captureForm.getByRole('textbox', { name: 'Title', exact: true }).fill('Quantum basics');
  await captureForm.getByLabel('Subject').selectOption({ label: 'Physics' });
  await captureForm.getByLabel('Sprint').selectOption({ label: 'Wave foundations' });
  await captureForm.getByLabel('Recall prompt').fill('What is the key idea of wave-particle duality?');
  await captureForm.getByLabel('Answer').fill('Matter and energy can behave like waves and particles depending on the experiment.');
  await captureForm.getByLabel('Quick note').fill('Remember the photoelectric effect example.');
  await captureForm.getByText('More options').click();
  await captureForm.getByRole('textbox', { name: 'Source', exact: true }).fill('Class notes');
  await captureForm.getByRole('textbox', { name: 'Tags', exact: true }).fill('quantum, waves');
  await captureForm.getByLabel('Review due date').fill(today());
  await captureForm.getByRole('textbox', { name: 'Resource title', exact: true }).fill('Wave-particle handout');
  await captureForm.getByLabel('File').setInputFiles(samplePdf);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/mindvault/items') && response.request().method() === 'POST'),
    captureForm.getByRole('button', { name: 'Save learning' }).click()
  ]);
  const quantumCard = page.locator('.learning-card').filter({ hasText: 'Quantum basics' }).first();
  await expect(quantumCard).toBeVisible();
  await quantumCard.locator('summary').click();
  const openFileLink = quantumCard.getByRole('link', { name: 'Open file' });
  await expect(openFileLink).toBeVisible();

  const fileHref = await openFileLink.getAttribute('href');
  expect(fileHref).toBeTruthy();
  const fileResponse = await page.request.get(fileHref);
  expect(fileResponse.ok()).toBeTruthy();
  expect(fileResponse.headers()['content-type']).toContain('application/pdf');

  await captureForm.getByRole('button', { name: 'Random learning' }).click();
  await captureForm.getByRole('textbox', { name: 'Title', exact: true }).fill('Chrome shortcut');
  await captureForm.getByLabel('Recall prompt').fill('What shortcut reopens a closed browser tab?');
  await captureForm.getByLabel('Answer').fill('Ctrl + Shift + T reopens the last closed tab.');
  await captureForm.getByLabel('Resource type').selectOption('LINK');
  await captureForm.getByRole('textbox', { name: 'Resource title', exact: true }).fill('Keyboard shortcuts');
  await captureForm.getByLabel('URL').fill('https://support.google.com/chrome/answer/157179');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/mindvault/items') && response.request().method() === 'POST'),
    captureForm.getByRole('button', { name: 'Save learning' }).click()
  ]);
  await expect(page.locator('.learning-card').filter({ hasText: 'Chrome shortcut' }).first()).toBeVisible();

  await page.goto('/vault/review');
  await expect(page).toHaveURL(/\/vault\/review$/);
  await expect(page.locator('.queue-item').filter({ hasText: 'Quantum basics' }).first()).toBeVisible();
  await page.locator('.queue-item').filter({ hasText: 'Quantum basics' }).first().click();
  await page.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(page.getByText(/Matter and energy can behave like waves and particles/)).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/mindvault/items') && response.url().includes('/reviews') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Good' }).click()
  ]);

  await page.goto('/vault/library');
  await expect(page).toHaveURL(/\/vault\/library$/);
  await page.getByPlaceholder('Search title, prompt, answer, notes, tags').fill('Quantum');
  await expect(page.locator('.learning-card').filter({ hasText: 'Quantum basics' }).first()).toBeVisible();
  await page.getByPlaceholder('Search title, prompt, answer, notes, tags').fill('Chrome');
  await expect(page.locator('.learning-card').filter({ hasText: 'Chrome shortcut' }).first()).toBeVisible();

  await page.goto('/vault/insights');
  await expect(page).toHaveURL(/\/vault\/insights$/);
  await expect(page.getByRole('heading', { name: 'Memory dashboard' })).toBeVisible();
  await expect(page.locator('.insight-card').filter({ hasText: 'Physics' }).first()).toBeVisible();
  await expect(page.getByText('Topics to reinforce')).toBeVisible();
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function futureDate(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}
