import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const VALID_CODE = 'CSGO-RBZih-6Hynp-ieuGe-tTkVz-9PqNO';
const DOT_CODE = 'CSGO-zDZH2-jXXvr-yFaQu-OjXPS-G8sdA';

test('loads the unified studio without runtime or layout failures', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  if (testInfo.project.name === 'desktop-chromium') {
    await page.setViewportSize({ width: 1497, height: 1272 });
  }

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CS2 Crosshair Studio' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Build your match-ready crosshair in three moves' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customize' })).toBeVisible();
  if (testInfo.project.name === 'mobile-chromium') await expect(page.getByTestId('mobile-preview-disclosure')).toBeVisible();
  else await expect(page.getByRole('heading', { name: 'Live preview' })).toBeVisible();

  const controlCenter = page.getByTestId('control-center');
  await expect(controlCenter.getByTestId('import-controls')).toBeVisible();
  await expect(controlCenter.getByTestId('customize-controls')).toBeVisible();
  await expect(controlCenter.getByTestId('preview-workspace')).toBeVisible();
  await expect(controlCenter.getByTestId('export-controls')).toBeVisible();
  await expect(controlCenter.getByRole('button', { name: 'Reset' })).toBeVisible();
  await expect(controlCenter.getByRole('button', { name: 'Download CFG' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Local crosshair library' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Recent (0)' })).toBeVisible();
  await expect(page.getByText('Codes you load or export are saved only in this browser.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Report an issue' })).toHaveAttribute('href', 'https://github.com/Softhe/cs2-crosshair/issues/new/choose');

  const sliderStack = controlCenter.getByTestId('slider-stack');
  const sliderNames = ['Length', 'Thickness', 'Gap', 'Outline thickness', 'Alpha'];
  const sliderBoxes = await Promise.all(sliderNames.map((name) => sliderStack.locator(`[data-setting-slider="${name}"]`).boundingBox()));
  expect(sliderBoxes.every(Boolean)).toBe(true);
  const sliderLeftEdges = sliderBoxes.map((box) => box!.x);
  const sliderWidths = sliderBoxes.map((box) => box!.width);
  expect(Math.max(...sliderLeftEdges) - Math.min(...sliderLeftEdges)).toBeLessThan(2);
  expect(Math.max(...sliderWidths) - Math.min(...sliderWidths)).toBeLessThan(2);
  for (let index = 1; index < sliderBoxes.length; index += 1) {
    expect(sliderBoxes[index]!.y).toBeGreaterThan(sliderBoxes[index - 1]!.y);
  }

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);

  const controlCenterBox = await controlCenter.boundingBox();
  const customizeBox = await controlCenter.getByTestId('customize-controls').boundingBox();
  const previewBox = await controlCenter.getByTestId('preview-workspace').boundingBox();
  const exportBox = await controlCenter.getByTestId('export-controls').boundingBox();
  const libraryBox = await page.getByTestId('local-crosshair-library').boundingBox();
  expect(controlCenterBox).not.toBeNull();
  expect(customizeBox).not.toBeNull();
  expect(previewBox).not.toBeNull();
  expect(exportBox).not.toBeNull();
  expect(libraryBox).not.toBeNull();
  expect(previewBox!.x).toBeGreaterThanOrEqual(controlCenterBox!.x);
  expect(previewBox!.x + previewBox!.width).toBeLessThanOrEqual(controlCenterBox!.x + controlCenterBox!.width + 1);
  if (testInfo.project.name === 'mobile-chromium') {
    expect(previewBox!.y).toBeGreaterThan(customizeBox!.y);
    expect(exportBox!.y).toBeGreaterThan(previewBox!.y);
    expect(libraryBox!.y).toBeGreaterThan(exportBox!.y);
  } else {
    const leftStackBox = await controlCenter.getByTestId('editor-left-stack').boundingBox();
    const rightStackBox = await controlCenter.getByTestId('editor-right-stack').boundingBox();
    const saveHeadingBox = await controlCenter.getByRole('heading', { name: 'Save & switch' }).boundingBox();
    const copyCommandBox = await controlCenter.getByRole('button', { name: 'Copy command' }).boundingBox();
    expect(leftStackBox).not.toBeNull();
    expect(rightStackBox).not.toBeNull();
    expect(saveHeadingBox).not.toBeNull();
    expect(copyCommandBox).not.toBeNull();
    expect(previewBox!.x).toBeGreaterThan(customizeBox!.x);
    expect(Math.abs(previewBox!.x - exportBox!.x)).toBeLessThan(2);
    expect(previewBox!.height).toBeLessThan(400);
    expect(libraryBox!.x).toBeGreaterThanOrEqual(leftStackBox!.x);
    expect(libraryBox!.x + libraryBox!.width).toBeLessThanOrEqual(leftStackBox!.x + leftStackBox!.width + 1);
    expect(libraryBox!.y - (customizeBox!.y + customizeBox!.height)).toBeLessThan(32);
    expect(Math.abs(leftStackBox!.height - rightStackBox!.height)).toBeGreaterThan(40);
    expect(saveHeadingBox!.y + saveHeadingBox!.height).toBeLessThan(1272);
    expect(copyCommandBox!.y + copyCommandBox!.height).toBeLessThan(1272);
  }

  expect(errors).toEqual([]);
});

test('guides first-time users once and records optional feedback locally', async ({ page }) => {
  await page.goto('/');
  const guide = page.getByTestId('first-run-guide');
  await expect(guide).toBeVisible();
  await expect(guide.getByLabel('Getting started steps')).toContainText('Import');
  if ((page.viewportSize()?.width || 0) < 768) {
    await guide.getByRole('button', { name: 'Getting started help' }).click();
    await expect(guide.locator('#first-run-help').getByText(/paste a code or choose a preset/i)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Dismiss getting started guide' }).click();
  await expect(guide).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cs2_studio_guide_dismissed'))).toBe('true');

  await page.reload();
  await expect(guide).toHaveCount(0);
  await page.getByRole('button', { name: 'Easy', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Easy', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/Saved locally/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cs2_studio_feedback'))).toBe('easy');
  await page.getByLabel('Optional note').fill('Fast and clear');
  await page.getByRole('button', { name: 'Review GitHub issue' }).click();
  await expect(page.getByTestId('feedback-issue-preview')).toContainText('Fast and clear');
  const issueHref = await page.getByRole('link', { name: 'Open GitHub issue' }).getAttribute('href');
  expect(issueHref).toContain('github.com/Softhe/cs2-crosshair/issues/new');
  expect(decodeURIComponent(issueHref || '')).not.toContain('CSGO-');
  const metrics = await page.evaluate(() => sessionStorage.getItem('cs2_studio_session_metrics') || '');
  expect(metrics).toContain('feedback_easy');
  expect(metrics).not.toContain('CSGO-');
});

test('uses compact mobile onboarding and a dedicated ultrawide library column', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('first-run-guide').getByLabel('Getting started steps')).toBeVisible();
  const importBox = await page.getByTestId('import-controls').boundingBox();
  expect(importBox?.y).toBeLessThan(500);
  await expect(page.getByTestId('mobile-quick-actions')).toBeVisible();
  const previewBox = await page.getByTestId('preview-workspace').boundingBox();
  const exportBox = await page.getByTestId('export-controls').boundingBox();
  expect(previewBox).not.toBeNull();
  expect(exportBox).not.toBeNull();
  expect(exportBox!.y).toBeGreaterThan(previewBox!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(255, 255, 255)');

  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(page.getByTestId('editor-library-column')).toBeVisible();
  const columnsAt1600 = await page.getByTestId('editor-layout').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(columnsAt1600).toBe(3);

  await page.setViewportSize({ width: 2560, height: 1440 });
  await expect(page.getByTestId('editor-library-column')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(2560);
});

test('completes the first-session import, edit, persist, and export path', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'CS2 crosshair share code', exact: true });
  await input.fill(VALID_CODE);
  await page.getByRole('button', { name: 'Load crosshair', exact: true }).click();
  await expect(page).toHaveURL(`/?code=${VALID_CODE}`);
  await page.getByRole('slider', { name: 'Length', exact: true }).press('ArrowRight');
  const editedCode = await input.inputValue();
  expect(editedCode).not.toBe(VALID_CODE);
  await expect(page).toHaveURL(`/?code=${editedCode}`);

  await page.reload();
  await expect(input).toHaveValue(editedCode);
  await page.getByRole('button', { name: 'Copy command', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('cl_crosshair');
  const recentTab = page.locator('[role="tab"][id$="-trigger-recent"]');
  await expect(recentTab).toBeVisible();
  await expect(recentTab).toContainText('Recent (');
});

test('updates the preview, share code, URL, and draft from a preset', async ({ page }, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'mobile-chromium') await page.getByTestId('mobile-preview-disclosure').locator('summary').click();
  await page.getByRole('button', { name: 'High visibility' }).click();

  const codeInput = page.getByRole('textbox', { name: 'CS2 crosshair share code', exact: true });
  await expect(codeInput).toHaveValue(/^CSGO-/);
  const code = await codeInput.inputValue();
  await expect(page).toHaveURL(`/?code=${code}`);
  await expect(page.getByRole('button', { name: 'Yellow' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: 'Selected color rgb(255, 255, 0)', exact: true }).filter({ visible: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cs2_custom_crosshair_draft'))).toBe(code);
});

test('offers persistent CS2 and calm Crimson redesigns with a deep-teal Tactical default', async ({ page }) => {
  await page.goto('/');
  const root = page.locator('html');

  const tacticalTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return { primary: styles.getPropertyValue('--primary').trim(), accent: styles.getPropertyValue('--accent').trim(), background: styles.getPropertyValue('--gradient-background').trim() };
  });
  expect(tacticalTokens.primary).toBe('174 72% 42%');
  expect(tacticalTokens.accent).toBe('191 78% 52%');
	expect(tacticalTokens.background).toContain('linear-gradient');
	expect(tacticalTokens.background).toContain('#050607');

  await page.getByRole('button', { name: 'CS2', exact: true }).click();
  await expect(root).toHaveAttribute('data-palette', 'cs2');
  const cs2Tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return { primary: styles.getPropertyValue('--primary').trim(), background: styles.getPropertyValue('--gradient-background').trim() };
  });
  expect(cs2Tokens.primary).toBe('28 80% 55%');
  expect(cs2Tokens.background).toContain('linear-gradient');
  expect(cs2Tokens.background).toContain('#050607');
  await page.waitForTimeout(300);
  const cs2A11y = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(cs2A11y.violations).toEqual([]);

  await page.getByRole('button', { name: 'Crimson' }).click();
  await expect(root).toHaveAttribute('data-palette', 'crimson');
  const crimsonTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return { primary: styles.getPropertyValue('--primary').trim(), background: styles.getPropertyValue('--gradient-background').trim() };
  });
  expect(crimsonTokens.primary).toBe('345 52% 38%');
  expect(crimsonTokens.background).toContain('linear-gradient');
  expect(crimsonTokens.background).toContain('#050607');
  expect(crimsonTokens.primary).not.toEqual(cs2Tokens.primary);
  await page.waitForTimeout(300);
  const crimsonA11y = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(crimsonA11y.violations).toEqual([]);

  await page.reload();
  await expect(root).toHaveAttribute('data-palette', 'crimson');
  await expect(page.getByRole('button', { name: 'Crimson' })).toHaveAttribute('aria-pressed', 'true');

  await page.evaluate(() => localStorage.setItem('cs2_studio_palette', 'cobalt'));
  await page.reload();
  await expect(root).toHaveAttribute('data-palette', 'tactical');
  await expect(page.getByRole('button', { name: 'Tactical' })).toHaveAttribute('aria-pressed', 'true');
});

test('keeps the full creator visible and loads the exact Dot preset', async ({ page }) => {
  await page.goto('/');
  const dotPreset = page.getByRole('button', { name: 'Dot' });
  await expect(dotPreset).toHaveAttribute('type', 'button');
  await dotPreset.click();

  await expect(page.getByRole('textbox', { name: 'CS2 crosshair share code', exact: true })).toHaveValue(DOT_CODE);
  await expect(page.getByRole('slider', { name: 'Length' })).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByRole('slider', { name: 'Thickness', exact: true })).toHaveAttribute('aria-valuenow', '1');
  await expect(page.getByRole('slider', { name: 'Gap' })).toHaveAttribute('aria-valuenow', '-5');
  await expect(page.getByRole('slider', { name: 'Outline thickness' })).toHaveAttribute('aria-valuenow', '1');
  await expect(page.getByRole('slider', { name: 'Alpha' })).toHaveAttribute('aria-valuenow', '255');
  await expect(page.getByRole('checkbox', { name: 'Center dot' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Outline' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Use alpha' })).toBeChecked();
});

test('provides generous pointer targets for sliders without changing keyboard behavior', async ({ page }) => {
  await page.goto('/');
  const sliderNames = ['Length', 'Thickness', 'Gap', 'Outline thickness', 'Alpha'];

  for (const name of sliderNames) {
    const setting = page.locator(`[data-setting-slider="${name}"]`);
    const rootBox = await setting.locator('[data-slider-root]').boundingBox();
    const thumbBox = await page.getByRole('slider', { name, exact: true }).boundingBox();
    expect(rootBox).not.toBeNull();
    expect(thumbBox).not.toBeNull();
    expect(rootBox!.height).toBeGreaterThanOrEqual(28);
    expect(thumbBox!.width).toBeGreaterThanOrEqual(24);
    expect(thumbBox!.height).toBeGreaterThanOrEqual(24);
  }

  const length = page.getByRole('slider', { name: 'Length', exact: true });
  const lengthRoot = page.locator('[data-setting-slider="Length"] [data-slider-root]');
  const beforePointer = Number(await length.getAttribute('aria-valuenow'));
  const lengthRootBox = await lengthRoot.boundingBox();
  await lengthRoot.click({ position: { x: lengthRootBox!.width * 0.8, y: lengthRootBox!.height / 2 } });
  const afterPointer = Number(await length.getAttribute('aria-valuenow'));
  expect(afterPointer).toBeGreaterThan(beforePointer);

  await length.press('ArrowLeft');
  await expect(length).toHaveAttribute('aria-valuenow', String(afterPointer - 0.5));
});

test('edits every restored control and carries the values into generated convars', async ({ page }) => {
  await page.goto(`/?code=${DOT_CODE}`);

  await page.getByRole('slider', { name: 'Thickness', exact: true }).press('ArrowRight');
  await page.getByRole('slider', { name: 'Gap' }).press('ArrowRight');
  await page.getByRole('slider', { name: 'Outline thickness' }).press('ArrowRight');
  await page.getByRole('slider', { name: 'Alpha' }).press('ArrowLeft');
  await page.getByRole('checkbox', { name: 'Center dot' }).click();

  await expect(page.getByRole('slider', { name: 'Thickness', exact: true })).toHaveAttribute('aria-valuenow', '1.5');
  await expect(page.getByRole('slider', { name: 'Gap' })).toHaveAttribute('aria-valuenow', '-4.5');
  await expect(page.getByRole('slider', { name: 'Outline thickness' })).toHaveAttribute('aria-valuenow', '1.5');
  await expect(page.getByRole('slider', { name: 'Alpha' })).toHaveAttribute('aria-valuenow', '254');
  await expect(page.getByRole('checkbox', { name: 'Center dot' })).not.toBeChecked();

  await page.getByText('Show generated convars', { exact: true }).click();
  const convars = page.locator('pre');
  await expect(convars).toContainText('cl_crosshairdot "0"');
  await expect(convars).toContainText('cl_crosshairgap "-4.5"');
  await expect(convars).toContainText('cl_crosshairthickness "1.5"');
  await expect(convars).toContainText('cl_crosshair_outlinethickness "1.5"');
  await expect(convars).toContainText('cl_crosshairalpha "254"');

  await page.getByRole('checkbox', { name: 'Outline' }).click();
  await expect(page.getByRole('slider', { name: 'Outline thickness' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('checkbox', { name: 'Use alpha' }).click();
  await expect(page.getByRole('slider', { name: 'Alpha' })).toHaveAttribute('aria-disabled', 'true');
});

test('copies active outputs, downloads the displayed file, and manages favorites', async ({ page }, testInfo) => {
  await page.goto('/');
  const code = await page.getByRole('textbox', { name: 'CS2 crosshair share code', exact: true }).inputValue();

  await page.getByRole('button', { name: 'Copy code' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await expect(page.getByRole('tab', { name: 'Recent (1)' })).toBeVisible();
  await expect(page.getByTestId('history-item')).toHaveAttribute('data-activity', 'exported');
  await expect(page.getByTestId('history-item').getByText('Exported')).toBeVisible();
  if (testInfo.project.name === 'mobile-chromium') {
    const libraryBox = await page.getByTestId('local-crosshair-library').boundingBox();
    expect(libraryBox).not.toBeNull();
    expect(libraryBox!.height).toBeLessThan(520);
  }

  await page.getByRole('button', { name: 'Share link', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(`http://127.0.0.1:4175/?code=${code}`);

  await page.getByText('CFG & autoexec shortcut', { exact: true }).click();
  await page.getByLabel('Alias name', { exact: false }).fill('team green');
  await expect(page.getByText('crosshair_team_green.cfg', { exact: true })).toBeVisible();
  await expect(page.getByText('alias "team_green" "exec crosshair_team_green.cfg"', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CFG', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('crosshair_team_green.cfg');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const config = await readFile(downloadPath!, 'utf8');
  expect(config).toContain(`Generated from ${code}`);
  expect(config).toContain('alias "team_green" "exec crosshair_team_green.cfg"');

  await expect(page.getByRole('tab', { name: 'Recent (1)' })).toBeVisible();
  await page.getByRole('button', { name: 'Add team green to favorites' }).click();
  await expect(page.getByRole('tab', { name: 'Favorites (1)' })).toBeVisible();
});

test('loads a saved crosshair by left-clicking its history card', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dot', exact: true }).click();
  const codeInput = page.getByRole('textbox', { name: 'CS2 crosshair share code', exact: true });
  const savedCode = await codeInput.inputValue();

  await page.getByRole('button', { name: 'Copy code' }).click();
  await expect(page.getByTestId('history-item')).toBeVisible();
  await page.getByRole('button', { name: 'Classic green', exact: true }).click();
  await expect(codeInput).not.toHaveValue(savedCode);

  const changedCode = await codeInput.inputValue();
  const historyItem = page.getByTestId('history-item');
  await expect(historyItem.locator('[data-history-actions]')).toHaveCount(1);

  await historyItem.getByRole('button', { name: 'Copy share code for crosshair' }).click();
  await expect(codeInput).toHaveValue(changedCode);
  await historyItem.getByRole('button', { name: 'Add crosshair to favorites' }).click();
  await expect(codeInput).toHaveValue(changedCode);
  await historyItem.getByRole('button', { name: 'Copy share link for crosshair' }).click();
  await expect(codeInput).toHaveValue(changedCode);

  await historyItem.getByRole('button', { name: 'Load crosshair' }).click();
  await expect(codeInput).toHaveValue(savedCode);
  await page.getByRole('button', { name: 'Classic green', exact: true }).click();
  await expect(codeInput).toHaveValue(changedCode);

  await historyItem.locator('code').click();
  await expect(codeInput).toHaveValue(savedCode);

  await page.getByRole('button', { name: 'Classic green', exact: true }).click();
  await historyItem.getByRole('button', { name: 'Remove crosshair from history' }).click();
  await expect(codeInput).toHaveValue(changedCode);
  await expect(historyItem).toHaveCount(0);
});

test('searches, renames, and backs up the local library', async ({ page }) => {
  await page.goto('/');
  const code = await page.getByRole('textbox', { name: 'CS2 crosshair share code', exact: true }).inputValue();
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  const historyItem = page.getByTestId('history-item');
  await expect(historyItem).toBeVisible();

  const nameInput = historyItem.locator('input');
  await expect(nameInput).toHaveCount(1);
  await nameInput.fill('ranked setup');
  await nameInput.press('Tab');
  await expect(nameInput).toHaveValue('ranked setup');

  const search = page.getByRole('textbox', { name: 'Search saved crosshairs', exact: true });
  await search.fill('ranked');
  await expect(historyItem).toHaveCount(1);
  await search.fill('missing');
  await expect(historyItem).toHaveCount(0);
  await search.fill('');

  const backupDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const backupDownload = await backupDownloadPromise;
  expect(backupDownload.suggestedFilename()).toMatch(/^cs2-crosshair-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = await backupDownload.path();
  expect(backupPath).not.toBeNull();
  const backup = await readFile(backupPath!, 'utf8');
  expect(backup).toContain(code);
  expect(backup).toContain('ranked setup');

  await page.getByRole('button', { name: 'Remove ranked setup from history' }).click();
  await expect(historyItem).toHaveCount(0);
  await page.getByLabel('Import crosshair backup').setInputFiles({
    name: 'crosshair-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await expect(page.getByTestId('history-item')).toBeVisible();
  await expect(page.getByTestId('history-item').locator('input')).toHaveValue('ranked setup');
});

test('pastes valid codes and exposes invalid clipboard values accessibly', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((code) => navigator.clipboard.writeText(code), VALID_CODE);
  await page.getByRole('button', { name: 'Paste', exact: true }).click();
  const codeInput = page.getByRole('textbox', { name: 'CS2 crosshair share code', exact: true });
  await expect(codeInput).toHaveValue(VALID_CODE);
  await expect(page).toHaveURL(`/?code=${VALID_CODE}`);
  await expect(page.getByRole('tab', { name: 'Recent (1)' })).toBeVisible();
  await expect(page.getByTestId('history-item')).toHaveAttribute('data-activity', 'imported');
  await expect(page.getByTestId('history-item').getByText('Loaded')).toBeVisible();

  await page.evaluate(() => navigator.clipboard.writeText('invalid clipboard value'));
  await page.getByRole('button', { name: 'Paste', exact: true }).click();
  await expect(codeInput).toHaveValue('invalid clipboard value');
  await expect(page.getByRole('alert')).toContainText('Share code must start with');
});

test('supports compatibility routes and rejects invalid slugs', async ({ page }) => {
  await page.goto(`/custom?code=${VALID_CODE}#help`);
  await expect(page).toHaveURL(`/?code=${VALID_CODE}#help`);
  await expect(page.getByRole('textbox', { name: 'CS2 crosshair share code', exact: true })).toHaveValue(VALID_CODE);
  await expect(page.getByRole('tab', { name: 'Recent (1)' })).toBeVisible();
  await expect(page.getByTestId('history-item')).toHaveAttribute('data-activity', 'imported');

  await page.goto(`/${VALID_CODE}`);
  await expect(page.getByRole('heading', { name: 'CS2 Crosshair Studio' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'CS2 crosshair share code', exact: true })).toHaveValue(VALID_CODE);

  await page.goto('/anything');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to the studio' })).toBeVisible();
});

test('has no automatically detectable WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CS2 Crosshair Studio' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
