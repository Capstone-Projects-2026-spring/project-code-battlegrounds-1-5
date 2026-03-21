import { Page } from "playwright/test";

export async function loginAs(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.fill('[data-testid=email-login]', email);
    await page.fill('[data-testid=password-login]', password);
    await page.click('[data-testid=login-button]');
    await page.waitForURL('**/');
}

export async function setupGame(pages: Page[], difficulty: 'easy' | 'medium' | 'hard'): Promise<string> {
    const gameUrl = await createGame(pages[0], difficulty);

    // navigate all other pages to the game room
    for (const page of pages.slice(1)) {
        await page.goto(gameUrl);
        await page.waitForLoadState('networkidle');
    }

    // join teams sequentially to avoid race conditions
    await pages[0].locator('[data-testid="team-1-button"]').waitFor({ state: 'visible' });
    await pages[0].click('[data-testid="team-1-button"]');

    await pages[1].locator('[data-testid="team-1-button"]').waitFor({ state: 'visible' });
    await pages[1].click('[data-testid="team-1-button"]');

    await pages[2].locator('[data-testid="team-2-button"]').waitFor({ state: 'visible' });
    await pages[2].click('[data-testid="team-2-button"]');

    await pages[3].locator('[data-testid="team-2-button"]').waitFor({ state: 'visible' });
    await pages[3].click('[data-testid="team-2-button"]');

    return gameUrl;
}

export async function createGame(page: Page, difficulty: 'easy' | 'medium' | 'hard'): Promise<string> {
    await page.goto('/');
    const navigationPromise = page.waitForURL(/\/game\/.+/, { timeout: 10000 });
    await page.click(`[data-testid="create-room-button-${difficulty}"]`);
    await navigationPromise;
    return page.url();
}