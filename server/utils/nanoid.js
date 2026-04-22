const { customAlphabet } = require("nanoid");

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 21);

module.exports = { nanoid };