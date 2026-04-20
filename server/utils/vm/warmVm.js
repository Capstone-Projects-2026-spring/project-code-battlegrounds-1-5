const warmVm = (gameId) => {
    fetch(`${process.env.ORCHESTRATOR_URL ?? "http://localhost:6969"}/request-warm-vm`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
    })
    .then(res => res.json())
    .then(data => console.log(data))
    .catch((error) => console.error(error));
};

module.exports = { warmVm };