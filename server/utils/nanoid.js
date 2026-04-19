const { customAlphabet } = require("nanoid");

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 21);

module.exports = { nanoid };