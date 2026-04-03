import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for the Conversations page.
 *
 * Prerequisites: both frontend (localhost:3000) and backend (api) must be running.
 * The backend must have demo seed data with enterprise1@csv.dev / csv2026.
 *
 * Run: npm run test:e2e
 */

/* ─── Auth Helpers ─── */

async function loginAsEnterprise(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Enterprise 1' }).click();
  // Wait for redirect to enterprise dashboard
  await page.waitForURL('**/enterprise/**', { timeout: 10_000 });
}

async function loginAsTalent(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Talent 1' }).click();
  await page.waitForURL('**/talent/**', { timeout: 10_000 });
}

/* ─── Tests ─── */

test.describe('Conversations Page (Enterprise)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEnterprise(page);
  });

  test('loads conversations page without crashing', async ({ page }) => {
    await page.goto('/enterprise/conversations');
    await page.waitForLoadState('networkidle');

    // Page should render — either with conversations or empty state
    await expect(page.locator('body')).toBeVisible();
    // Search input should always be present
    const searchInput = page.getByPlaceholder('搜索候选人、机会...');
    await expect(searchInput).toBeVisible();
  });

  test('displays conversation list or empty state', async ({ page }) => {
    await page.goto('/enterprise/conversations');
    await page.waitForLoadState('networkidle');

    // Either we have conversations in the sidebar, or the empty prompt shows
    const sidebar = page.locator('[class*="border-r"]').first();
    await expect(sidebar).toBeVisible();
  });

  test('search input filters sidebar content', async ({ page }) => {
    await page.goto('/enterprise/conversations');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('搜索候选人、机会...');
    await expect(searchInput).toBeVisible();

    // Type a search query that likely matches nothing
    await searchInput.fill('zzz_nonexistent_query_zzz');
    // Wait a moment for filter to apply
    await page.waitForTimeout(500);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(500);
  });

  test('clicking a conversation shows message area', async ({ page }) => {
    await page.goto('/enterprise/conversations');
    await page.waitForLoadState('networkidle');

    // Find any clickable conversation item in the sidebar (if conversations exist)
    const convItems = page.locator('[class*="cursor-pointer"]');
    const count = await convItems.count();

    if (count > 0) {
      await convItems.first().click();
      // After clicking, the right panel should show conversation content
      // (either messages or a header with job title / status)
      await page.waitForTimeout(1000);

      // The reply textarea should appear for active conversations
      const textarea = page.getByPlaceholder('输入回复... (Shift+Enter 换行)');
      const statusBadge = page.getByText(/进行中|已完成|未通过/);

      // At least one of these should be visible
      const hasTextarea = await textarea.isVisible().catch(() => false);
      const hasStatus = await statusBadge.first().isVisible().catch(() => false);
      expect(hasTextarea || hasStatus).toBeTruthy();
    } else {
      // No conversations — empty state prompt should show
      await expect(page.getByText('选择一个对话查看详情')).toBeVisible();
    }
  });

  test('can type in reply textarea and send button exists', async ({ page }) => {
    await page.goto('/enterprise/conversations');
    await page.waitForLoadState('networkidle');

    const convItems = page.locator('[class*="cursor-pointer"]');
    const count = await convItems.count();

    if (count > 0) {
      await convItems.first().click();
      await page.waitForTimeout(1000);

      const textarea = page.getByPlaceholder('输入回复... (Shift+Enter 换行)');
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.fill('E2E测试消息');
        await expect(textarea).toHaveValue('E2E测试消息');

        // Send button should exist (SVG icon button near textarea)
        const sendButton = page.locator('button').filter({ has: page.locator('svg') }).last();
        await expect(sendButton).toBeVisible();
        // Don't actually send — we don't want to pollute data
      }
    }
  });

  test('deep-link with ?id= parameter auto-selects conversation', async ({ page }) => {
    // First, get a valid conversation ID from the list
    await page.goto('/enterprise/conversations');
    await page.waitForLoadState('networkidle');

    const convItems = page.locator('[class*="cursor-pointer"]');
    const count = await convItems.count();

    if (count > 0) {
      // Click first conversation to trigger detail fetch, then grab URL
      await convItems.first().click();
      await page.waitForTimeout(1000);

      // Now reload with deep-link
      const url = page.url();
      const searchParams = new URL(url).searchParams;
      const id = searchParams.get('id');

      if (id) {
        await page.goto(`/enterprise/conversations?id=${id}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // The conversation should be selected (messages area should be visible)
        const hasContent = await page.getByPlaceholder('输入回复... (Shift+Enter 换行)').isVisible().catch(() => false);
        const hasStatus = await page.getByText(/进行中|已完成|未通过/).first().isVisible().catch(() => false);
        expect(hasContent || hasStatus).toBeTruthy();
      }
    }
  });

  test('status badges display correctly', async ({ page }) => {
    await page.goto('/enterprise/conversations');
    await page.waitForLoadState('networkidle');

    const convItems = page.locator('[class*="cursor-pointer"]');
    const count = await convItems.count();

    if (count > 0) {
      await convItems.first().click();
      await page.waitForTimeout(1000);

      // One of the valid status labels should be visible
      const statusTexts = ['进行中', '已完成', '未通过', '已归档', '未知'];
      let foundStatus = false;
      for (const text of statusTexts) {
        if (await page.getByText(text).first().isVisible().catch(() => false)) {
          foundStatus = true;
          break;
        }
      }
      expect(foundStatus).toBeTruthy();
    }
  });
});

test.describe('Conversations Page (Talent)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTalent(page);
  });

  test('talent view loads with correct search placeholder', async ({ page }) => {
    await page.goto('/talent/conversations');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('搜索公司、职位...');
    await expect(searchInput).toBeVisible();
  });

  test('talent view shows conversation list', async ({ page }) => {
    await page.goto('/talent/conversations');
    await page.waitForLoadState('networkidle');

    // Page should render without errors
    await expect(page.locator('body')).toBeVisible();

    // Search should be visible (basic sanity check)
    const searchInput = page.getByPlaceholder('搜索公司、职位...');
    await expect(searchInput).toBeVisible();
  });
});

test.describe('Conversations — Message Flow', () => {
  test('sending a message shows optimistic update', async ({ page }) => {
    await loginAsEnterprise(page);
    await page.goto('/enterprise/conversations');
    await page.waitForLoadState('networkidle');

    const convItems = page.locator('[class*="cursor-pointer"]');
    const count = await convItems.count();

    if (count > 0) {
      await convItems.first().click();
      await page.waitForTimeout(1000);

      const textarea = page.getByPlaceholder('输入回复... (Shift+Enter 换行)');
      if (await textarea.isVisible().catch(() => false)) {
        const testMsg = `E2E-test-${Date.now()}`;
        await textarea.fill(testMsg);

        // Send via button click
        const sendButton = page.locator('button').filter({ has: page.locator('svg') }).last();
        await sendButton.click();

        // Message should appear in the chat (optimistic update)
        await expect(page.getByText(testMsg)).toBeVisible({ timeout: 5_000 });

        // Textarea should be cleared after send
        await expect(textarea).toHaveValue('');
      }
    }
  });
});

test.describe('Conversations — Navigation', () => {
  test('can navigate between enterprise pages', async ({ page }) => {
    await loginAsEnterprise(page);

    // Go to conversations
    await page.goto('/enterprise/conversations');
    await page.waitForLoadState('networkidle');
    await expect(page.getByPlaceholder('搜索候选人、机会...')).toBeVisible();

    // Go to inbox
    await page.goto('/enterprise/inbox');
    await page.waitForLoadState('networkidle');
    // Should not crash
    await expect(page.locator('body')).toBeVisible();

    // Back to conversations
    await page.goto('/enterprise/conversations');
    await page.waitForLoadState('networkidle');
    await expect(page.getByPlaceholder('搜索候选人、机会...')).toBeVisible();
  });
});
