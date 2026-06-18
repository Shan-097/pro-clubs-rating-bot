async function x(url) {
  const response = await fetch(url);
  return response.text();
}
module.exports = { x };
