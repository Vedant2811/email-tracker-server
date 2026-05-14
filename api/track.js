const { google } = require("googleapis");

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

const HEADERS = ["Email ID", "Open Count", "First Opened", "Last Opened", "Email Address"];

async function getSheet(auth, spreadsheetId) {
  const sheets = google.sheets({ version: "v4", auth });

  // Ensure "Tracking" worksheet exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.some(
    (s) => s.properties.title === "Tracking"
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Tracking" } } }],
      },
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Tracking!A1",
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }

  return sheets;
}

async function logOpen(emailId, emailAddress) {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  console.log("Credentials loaded, client_email:", creds.client_email);
  const spreadsheetId = process.env.SPREADSHEET_ID;

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();
  const sheets = await getSheet(authClient, spreadsheetId);

  // Read column A to find existing row by UUID
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Tracking!A:A",
  });

  const rows = res.data.values || [];
  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  // Row index (1-based); row 1 is headers, data starts at row 2
  const dataIndex = rows.findIndex((r) => r[0] === emailId);

  if (dataIndex !== -1) {
    const sheetRow = dataIndex + 1; // 1-based

    // Read current open count
    const countRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `Tracking!B${sheetRow}`,
    });
    const current = parseInt((countRes.data.values?.[0]?.[0]) || "0", 10);

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `Tracking!B${sheetRow}`, values: [[current + 1]] },
          { range: `Tracking!D${sheetRow}`, values: [[now]] },
          { range: `Tracking!E${sheetRow}`, values: [[emailAddress]] },
        ],
      },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Tracking!A:E",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[emailId, 1, now, now, emailAddress]] },
    });
  }
}

module.exports = async function handler(req, res) {
  const emailId = req.query.id;
  const emailAddress = req.query.email || "";

  if (emailId) {
    try {
      await logOpen(emailId, emailAddress);
    } catch (err) {
      console.error("Sheet write failed:", err.message, err.stack);
    }
  }

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Content-Length", TRANSPARENT_GIF.length);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.status(200).end(TRANSPARENT_GIF);
};
