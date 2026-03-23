const { google } = require('googleapis');

const SHEET_TITLES = ['الإعدادات', 'الأعضاء', 'الأعمال', 'الفصول', 'الرواتب', 'اللوج'];

let cachedClient = null;

function hasGoogleCredentials() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
  );
}

function getAuth() {
  if (!hasGoogleCredentials()) return null;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
    const creds = JSON.parse(raw);
    const privateKey = String(creds.private_key || '').replace(/\\n/g, '\n');
    return new google.auth.JWT({
      email: creds.client_email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheetsClient() {
  if (cachedClient) return cachedClient;
  const auth = getAuth();
  if (!auth) return null;
  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

function kvRows(obj, descriptions = {}) {
  return Object.entries(obj).map(([key, value]) => [key, String(value ?? ''), descriptions[key] || '']);
}

function clearableRange(title, rows, cols) {
  const maxRow = Math.max(rows + 10, 200);
  const maxCol = Math.max(cols, 10);
  const endCol = String.fromCharCode(64 + maxCol);
  return `'${title}'!A1:${endCol}${maxRow}`;
}

async function ensureSheets(spreadsheetId) {
  const sheets = await getSheetsClient();
  if (!sheets) return false;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((meta.data.sheets || []).map(s => s.properties.title));

  const missing = SHEET_TITLES.filter(title => !existing.has(title));
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map(title => ({
          addSheet: {
            properties: { title },
          },
        })),
      },
    });
  }
  return true;
}

async function writeRange(sheets, spreadsheetId, range, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

async function clearRange(sheets, spreadsheetId, range) {
  await sheets.spreadsheets.values.clear({ spreadsheetId, range });
}

async function syncSnapshot(spreadsheetId, snapshot) {
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) return { ok: false, reason: 'no_google_auth' };

  await ensureSheets(spreadsheetId);

  const tasks = [
    ['الإعدادات', snapshot.settingsRows || [], 3],
    ['الأعضاء', snapshot.membersRows || [], 13],
    ['الأعمال', snapshot.worksRows || [], 9],
    ['الفصول', snapshot.chaptersRows || [], 15],
    ['الرواتب', snapshot.payrollRows || [], 10],
    ['اللوج', snapshot.logsRows || [], 4],
  ];

  for (const [title, rows, cols] of tasks) {
    await clearRange(sheets, spreadsheetId, `'${title}'!A1:${String.fromCharCode(64 + Math.max(10, cols))}500`).catch(() => {});
    if (rows.length) {
      await writeRange(sheets, spreadsheetId, `'${title}'!A1`, rows);
    }
  }

  return { ok: true };
}

module.exports = {
  hasGoogleCredentials,
  getSheetsClient,
  ensureSheets,
  syncSnapshot,
  SHEET_TITLES,
  kvRows,
};
