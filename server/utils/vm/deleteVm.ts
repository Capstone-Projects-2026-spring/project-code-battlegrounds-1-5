export async function deleteVm(gameId: string): Promise<void> {
    const executorAddress = process.env.EXECUTOR_ADDR;
    if (!executorAddress) {
        console.error('[DELETE_VM] EXECUTOR_ADDR is not configured.');
        return;
    }

    try {
        const res = await fetch(`${executorAddress}/delete-vm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId }),
        });

        if (!res.ok) {
            console.error(`[DELETE_VM] Failed to delete VM for ${gameId}: ${res.status}`);
            return;
        }

        const text = await res.text();
        if (!text) {
            console.log(`[DELETE_VM] VM deleted for ${gameId}`);
            return;
        }

        try {
            console.log('[DELETE_VM] Response:', JSON.parse(text));
        } catch {
            console.log('[DELETE_VM] Response (non-JSON):', text);
        }
    } catch (error: unknown) {
        console.error('[DELETE_VM] Error:', error);
    }
}