const warmVm = async (gameId) => {
    await fetch(`${process.env.EXECUTOR_ADDR}/request-warm-vm`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
    })
    .then(async (res) => {
        if (!res.ok) {
            console.error(`[WARM_VM] Failed to warm VM for ${gameId}: ${res.status}`);
            return;
        }
        const text = await res.text();
        if (text) {
            try {
                console.log('[WARM_VM] Response:', JSON.parse(text));
            } catch {
                console.log('[WARM_VM] Response (non-JSON):', text);
            }
        } else {
            console.log(`[WARM_VM] VM Response has no text for ${gameId}`);
        }
    })
    .catch(error => console.error('[WARM_VM] Error:', error));
};

module.exports = { warmVm };