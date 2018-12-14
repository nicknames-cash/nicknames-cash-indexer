function hexToString(hex) {
  const buffer = Buffer.from(hex, 'hex');
  return buffer.toString();
}

module.exports = {
  hexToString,
}