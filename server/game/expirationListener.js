function startExpirationListener(io, pubClient) {
  const sub = pubClient.duplicate();

  sub.subscribe('__keyevent@0__:expired', (err) => {
    if (err) {
      console.error('Failed to subscribe to expiration events', err);
    }
  });

  sub.on('message', async (channel, expiredKey) => {
    if (!expiredKey.startsWith('game:') || !expiredKey.endsWith(':expires')) {
      return;
    }

    const gameId = expiredKey.split(':')[1];

    console.log(`Game ${gameId} expired`);

    // distributed lock to ensure only ONE instance emits
    const lockKey = `lock:game:${gameId}:end`;

    // hold lock for 5 seconds
    const acquired = await pubClient.set(
      lockKey,
      '1',
      'NX',
      'PX',
      5000
    );

    if (!acquired) return; // another instance already handling

    io.to(gameId).emit('gameEnded');
  });
}

module.exports = { startExpirationListener };