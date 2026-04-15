import { test, expect, chromium, Browser, Page } from '@playwright/test';
import { loginAs } from '../../src/util/playwrightHelpers';

test.describe('Matchmaking', () => {

    let browsers: Browser[] = [];
    let pages: Page[] = [];
    const players = ["alice@test.com", "bob@test.com", "charlie@test.com", "diana@test.com"];

    test.beforeAll(async () => {
        browsers = await Promise.all([...Array(4)].map(() => chromium.launch()));

        for (let i = 0; i < 4; i++) {
            const ctx = await browsers[i].newContext();
            const page = await ctx.newPage();
            await loginAs(page, players[i], 'password123');
            pages.push(page);
        }
    });

    test.beforeEach(async () => {
        await Promise.all(pages.map(page => {
            page.goto('/matchmaking');
        }));
    });

    test.afterAll(async () => {
        await Promise.all(browsers.map(b => b.close().catch(() => { })));
        browsers = [];
        pages = [];
    });

    test.describe('1v1 (TWOPLAYER) matchmaking', () => {

        test('two solo players match and are redirected to the game room', async () => {
            const [p1, p2] = [pages[0], pages[1]];

            // Both select TWOPLAYER mode and EASY difficulty
            await Promise.all([
                p1.locator('[data-testid="mode-control"]').getByText('Co-Op').click(),
                p2.locator('[data-testid="mode-control"]').getByText('Co-Op').click(),
            ]);

            await p1.getByRole('button', { name: /find match/i }).click();
            await p2.getByRole('button', { name: /find match/i }).click();


            // Both should be redirected to a game room
            await Promise.all([
                p1.waitForURL(/\/game\/+/, { timeout: 10000 }),
                p2.waitForURL(/\/game\/+/, { timeout: 10000 }),
            ]);

            // Both should land on the same game room
            const p1Url = p1.url();
            const p2Url = p2.url();
            expect(p1Url).toBe(p2Url);

            // Game room should load — both should see the editor
            await Promise.all([p1, p2].map(page =>
                expect(page.locator('[data-testid="coder-pov"], [data-testid="tester-pov"]')).toBeVisible({ timeout: 25000 })
            ));
        });

        test('cancel button removes player from queue', async () => {
            const page = pages[0];
            await page.getByRole('button', { name: /find match/i }).click();

            await expect(page.getByText(/Searching for opponents.../i)).toBeVisible();

            await page.getByRole('button', { name: /cancel search/i }).click();

            // Should return to idle state
            await expect(page.getByRole('button', { name: /find match/i })).toBeVisible({ timeout: 10000 });
        });

    });

    test.describe('2v2 (FOURPLAYER) matchmaking', () => {

        test('four solo players match and land in the same game room', async () => {
            // All select FOURPLAYER
            for (const u of pages) {
                await u.locator('[data-testid="mode-control"]').getByText('2v2').click();
                await u.getByRole('button', { name: /find match/i }).click();
            }

            await Promise.all(
                pages.map(u => u.waitForURL(/\/game\/+/, { timeout: 15000 }))
            );

            // All should land on the same game room
            const gameUrls = pages.map(u => u.url());
            expect(gameUrls.every(url => url.includes('/game/'))).toBeTruthy();
            console.log("Game URLs:", gameUrls);
            expect(new Set(gameUrls).size).toBe(1);

        });

    });
    /*
        test.describe('lobby matchmaking', () => {
    
            test('lobby of 2 in TWOPLAYER creates game immediately without queueing', async () => {
                
            });
    
        });
    
        */
});