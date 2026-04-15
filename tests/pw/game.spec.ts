import { test, expect, chromium, Browser, Page } from '@playwright/test';
import { loginAs, setupGame4, createGame4, setupGame2 } from '../../src/util/playwrightHelpers';

test.describe('Game flow', () => {
    let browsers: Browser[] = [];
    let pages: Page[] = [];
    const players = ["alice@test.com", "bob@test.com", "charlie@test.com", "diana@test.com"];

    test.beforeAll(async () => {
        browsers = await Promise.all([...Array(4)].map(() => chromium.launch()));
        const contexts = await Promise.all(browsers.map(b => b.newContext()));
        pages = await Promise.all(contexts.map(ctx => ctx.newPage()));

        // Switch back to sequential for stability
        for (let i = 0; i < pages.length; i++) {
            await loginAs(pages[i], players[i], 'password123');
        }
    });

    test.beforeEach(async () => {
        await Promise.all(pages.map(page => page.goto('/matchmaking')));
    });

    test.afterAll(async () => {
        await Promise.all(browsers.map(b => b.close().catch(() => { })));
        browsers = [];
        pages = [];
    });

    test('2 Player mode', async () => {
        await setupGame2(pages, 'easy');

        await Promise.all([pages[0], pages[1]].map(page =>
            expect(page.locator('[data-testid="waiting-for-second"], [data-testid="coder-pov"], [data-testid="tester-pov"]')).toBeVisible({ timeout: 25000 })
        ));
    });

    test('Need 4 players to be joined to a team for the game to start', async () => {
        await createGame4(pages[0], 'easy');

        await pages[0].locator('[data-testid="team-1-button"]').waitFor({ state: 'visible' });
        await pages[0].click('[data-testid="team-1-button"]');

        await expect(pages[0].locator('[data-testid="waiting-for-second"]')).toBeVisible({ timeout: 15000 });
    });

    test('4 players join and game starts', async () => {
        await setupGame4(pages, 'medium');

        await Promise.all(pages.map(page =>
            expect(page.locator('[data-testid="waiting-for-second"], [data-testid="coder-pov"], [data-testid="tester-pov"]')).toBeVisible({ timeout: 15000 })
        ));
    });

    test('player is restored to their team on reload', async () => {
        await setupGame4(pages, 'hard');

        // wait for game to start for player 1
        await expect(pages[0].locator('[data-testid="coder-pov"]')).toBeVisible({ timeout: 15000 });

        // player 1 reloads
        await pages[0].reload();

        // should skip TeamSelect and go straight back into the game
        await expect(pages[0].locator('text=Choose a team')).not.toBeVisible({ timeout: 10000 });
        await expect(pages[0].locator('[data-testid="coder-pov"]')).toBeVisible({ timeout: 10000 });
    });
});