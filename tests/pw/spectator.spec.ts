import { test, expect, chromium, Browser, Page } from '@playwright/test';
import { loginAs, setupGame4, createGame4 } from './helpers'

test.describe('Spectator flow', () => {
    let browsers: Browser[] = [];
    let pages: Page[] = [];
    const players = ["alice@test.com", "bob@test.com", "charlie@test.com", "diana@test.com", "erik@test.com"];

    test.beforeAll(async () => {
        browsers = await Promise.all([...Array(5)].map(() => chromium.launch()));

        for (let i = 0; i < 5; i++) {
            const ctx = await browsers[i].newContext();
            const page = await ctx.newPage();
            await loginAs(page, players[i], 'password123');
            pages.push(page);
        }
    });

    test.afterAll(async () => {
        await Promise.all(browsers.map(b => b.close().catch(() => {})));
        browsers = [];
        pages = [];
    });

    test('5th player is shown spectator mode', async () => {
        await setupGame4(pages, 'easy'); // navigates all 5 pages, joins 4 players

        // player 5 should see both teams full
        await expect(pages[4].locator('[data-testid="team-1-full"]')).toBeVisible({ timeout: 10000 });
        await expect(pages[4].locator('[data-testid="team-2-full"]')).toBeVisible({ timeout: 10000 });

        // player 5 clicks spectate
        await pages[4].click('[data-testid="spectator-button"]');

        // spectator should see spectator UI
        await expect(pages[4].locator('[data-testid="spectating-box"]')).toBeVisible();
        await expect(pages[4].locator('[data-testid="team-1-coder"]')).toBeVisible();
        await expect(pages[4].locator('[data-testid="team-2-coder"]')).toBeVisible();
    });

    test('spectator can switch between team views', async () => {
        await setupGame4(pages, 'medium');

        // player 5 should see both teams full
        await expect(pages[4].locator('[data-testid="team-1-full"]')).toBeVisible({ timeout: 10000 });
        await expect(pages[4].locator('[data-testid="team-2-full"]')).toBeVisible({ timeout: 10000 });

        // player 5 clicks spectate
        await pages[4].click('[data-testid="spectator-button"]');

        // spectator views team 1 coder
        await pages[4].locator('[data-testid="team-1-coder"]').waitFor({ state: 'visible' });
        await pages[4].click('[data-testid="team-1-coder"]');
        await expect(pages[4].locator('[data-testid="coder-pov"]')).toBeVisible();

        // spectator switches to team 2 tester
        await pages[4].locator('[data-testid="team-2-tester"]').waitFor({ state: 'visible' });
        await pages[4].click('[data-testid="team-2-tester"]');
        await expect(pages[4].locator('[data-testid="tester-pov"]')).toBeVisible();

        // spectator exits view
        await pages[4].locator('[data-testid="exit-spectator"]').waitFor({ state: 'visible' });
        await pages[4].click('[data-testid="exit-spectator"]');
        await expect(pages[4].locator('[data-testid="spectating-words"]')).toBeVisible();
    });

    test('spectator sees real time player count updates', async () => {
        // this test needs its own game so we can control when players join
        const gameUrl = await createGame4(pages[0], 'hard');

        // all players navigate to the room but don't join yet
        for (const page of pages.slice(1)) {
            await page.goto(gameUrl);
            await page.waitForLoadState('networkidle');
        }

        // player 3 (index 2) is watching before anyone joins
        await expect(pages[2].locator('[data-testid="team-1-count"]')).toHaveText('0 / 2', { timeout: 10000 });

        // player 1 joins team 1
        await pages[0].locator('[data-testid="team-1-button"]').waitFor({ state: 'visible' });
        await pages[0].click('[data-testid="team-1-button"]');

        // player 3 should see team 1 update to 1 player in real time
        await expect(pages[2].locator('[data-testid="team-1-count"]')).toHaveText('1 / 2', { timeout: 10000 });

        // player 2 joins team 1 filling it
        await pages[1].locator('[data-testid="team-1-button"]').waitFor({ state: 'visible' });
        await pages[1].click('[data-testid="team-1-button"]');

        // player 3 should see team 1 is now full
        await expect(pages[2].locator('[data-testid="team-1-full"]')).toBeVisible({ timeout: 10000 });
    });
});