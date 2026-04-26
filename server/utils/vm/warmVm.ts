export async function warmVm(gameId: string): Promise<void> {
    const executorAddress = process.env.EXECUTOR_ADDR;
    if (!executorAddress) {
        console.error('[WARM_VM] EXECUTOR_ADDR is not configured.');
        return;
    }

    try {
        const res = await fetch(`${executorAddress}/request-warm-vm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId }),
        });

        if (!res.ok) {
            console.error(`[WARM_VM] Failed to warm VM for ${gameId}: ${res.status}`);
            return;
        }

        const text = await res.text();
        if (!text) {
            console.log(`[WARM_VM] VM warm request completed for ${gameId}`);
            return;
        }

        try {
            console.log('[WARM_VM] Response:', JSON.parse(text));
        } catch {
            console.log('[WARM_VM] Response (non-JSON):', text);
        }
    } catch (error: unknown) {
        console.error('[WARM_VM] Error:', error);
    }
}