const deleteVm = async (gameId) => {
    await fetch(`${process.env.EXECUTOR_ADDR}/delete-vm`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
    })
    .then(res => res.json())
    .then(data => console.log(data))
    .catch(error => console.error(error));
};

module.exports = { deleteVm };