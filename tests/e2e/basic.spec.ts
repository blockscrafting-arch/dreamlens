import { test, expect } from '@playwright/test';

test.describe('DreamLens AI Basic Flow', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check if the main heading is visible
    await expect(page.locator('h1')).toContainText('DreamLens');
  });

  test('should show API key selector on first visit', async ({ page }) => {
    await page.goto('/');
    
    // Check if API key input is visible
    // This test assumes the API key selector is shown initially
    // Adjust selectors based on actual implementation
    const apiKeyInput = page.locator('input[type="text"]').first();
    await expect(apiKeyInput).toBeVisible();
  });

  // Add more E2E tests for:
  // - Image upload flow
  // - Style selection
  // - Generation process
  // - Payment flow
  // - Authentication
});

