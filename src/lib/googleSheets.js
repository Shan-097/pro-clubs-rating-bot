async function postToGoogleSheet(payload) {
  const webhookUrl = process.env.GOOGLE_SCRIPT_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SCRIPT_SECRET;

  if (!webhookUrl || !secret) {
    throw new Error("Missing Google Apps Script webhook environment variables.");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      secret,
      ...payload,
    }),
  });

  const text = await response.text();

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Google Script returned non-JSON response: ${text.slice(0, 300)}...`);
  }

  if (!result.ok) {
    throw new Error(`Google Script error: ${result.error}`);
  }

  return result;
}

async function appendToGoogleSheet(summaryRows, rawRows) {
  return postToGoogleSheet({
    type: "ratings",
    summaryRows,
    rawRows,
  });
}

async function appendAvailabilityToGoogleSheet(availabilityRows) {
  return postToGoogleSheet({
    type: "availability",
    availabilityRows,
  });
}

module.exports = {
  appendToGoogleSheet,
  appendAvailabilityToGoogleSheet,
};