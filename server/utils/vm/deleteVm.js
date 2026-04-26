const deleteVm = async (gameId) => {
    await fetch(`${process.env.EXECUTOR_ADDR}/delete-vm`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
    })
    .then(async (res) => {
        if (!res.ok) {
            console.error(`[DELETE_VM] Failed to delete VM for ${gameId}: ${res.status}`);
            return;
        }
        const text = await res.text();
        if (text) {
            try {
                console.log('[DELETE_VM] Response:', JSON.parse(text));
            } catch {
                console.log('[DELETE_VM] Response (non-JSON):', text);
            }
        } else {
            console.log(`[DELETE_VM] VM deleted for ${gameId}`);
        }
    })
    .catch(error => console.error('[DELETE_VM] Error:', error));
};

module.exports = { deleteVm };