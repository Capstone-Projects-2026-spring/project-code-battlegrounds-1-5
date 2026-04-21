const warmVm = (gameId) => {
    fetch(`${process.env.EXECUTOR_URL}/request-warm-vm`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
    })
    .then(res => res.json())
    .then(data => console.log(data))
    .catch((error) => console.error(error));
};

module.exports = { warmVm };