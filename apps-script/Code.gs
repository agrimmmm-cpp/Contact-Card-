/**
 * Networking-page backend — Google Apps Script web app.
 * Receives a recruiter's email from the /connect page, logs it to a Sheet,
 * sends them a follow-up from YOUR Gmail (with your vCard attached),
 * and pings your phone via ntfy.sh.
 *
 * Files in this project: Code.gs (this file) + Photo.gs (embedded photo, const PHOTO_B64).
 */

/* ============================================================
   CONFIG — edit this block only.
   ============================================================ */
const CONFIG = {
  FULL_NAME: 'Agrim Joshi',
  FIRST_NAME: 'Agrim',
  LAST_NAME: 'Joshi',
  HEADLINE: 'Computing Science Student',
  SCHOOL: "Bachelor's in Computing Science, SFU",
  EMAIL: 'aja121@sfu.ca',
  PHONE: '+1-604-657-5954',                     // '' to omit
  LINKEDIN_URL: 'https://www.linkedin.com/in/agrim-joshi786/',
  PORTFOLIO_URL: 'https://agrimmmm-cpp.github.io/',
  RESUME_URL: 'https://agrimmmm-cpp.github.io/Contact-Card-/assets/Agrim_Joshi_Resume.pdf',
  EVENT_NAME: 'the Tech Fair',                  // used as "Great meeting you at <EVENT_NAME>"
  NTFY_TOPIC: 'agrim-fair-a24a522b27fcb04022fee832',
  SHEET_ID: '',                                 // '' = the Sheet this script is attached to
  SHEET_NAME: 'Connections',                    // tab is created if missing
  RATE_LIMIT_SECONDS: 600                       // ignore same email within 10 min
};

/* ============================================================
   Web app entry points
   ============================================================ */

// Frontend POSTs JSON as text/plain (no CORS preflight). We return JSON.
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json_(handle_(body));
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong.' });
  }
}

// Visiting the /exec URL in a browser is a handy "is it deployed?" check.
function doGet() {
  return json_({ ok: true, service: 'networking-backend' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   Main logic
   ============================================================ */
function handle_(body) {
  // 1. Bots: honeypot filled → pretend success, do nothing.
  if (body.website) return { ok: true };

  const email = clean_(body.email, 254).toLowerCase();
  const name = clean_(body.name, 80);
  const company = clean_(body.company, 80);
  const userAgent = clean_(body.userAgent, 300);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: 'Invalid email.' };
  }

  // Serialize concurrent requests so a double-tap can't send two emails.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // 2. Rate limit: same email within 10 min → ignore (reply ok; they already got it).
    const cache = CacheService.getScriptCache();
    const key = 'seen_' + Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, email));
    if (cache.get(key)) return { ok: true, duplicate: true };

    // 3. Log to the Sheet first so a lead is never lost even if email fails.
    sheet_().appendRow([new Date(), safeCell_(name), safeCell_(company), safeCell_(email), safeCell_(userAgent)]);

    // 4. Follow-up email from your Gmail.
    sendFollowUp_(email, name);
    cache.put(key, '1', CONFIG.RATE_LIMIT_SECONDS);

    // 5. Push notification (never blocks success).
    notify_(name, company, email);

    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: 'Could not send. Please try again.' };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   Helpers
   ============================================================ */

function sheet_() {
  const ss = CONFIG.SHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
    sh.appendRow(['Timestamp', 'Name', 'Company', 'Email', 'User agent']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function sendFollowUp_(to, name) {
  const first = name ? name.split(/\s+/)[0] : '';
  const greeting = first ? 'Hi ' + first + ',' : 'Hi,';
  const e = esc_;
  const subject = 'Great meeting you at ' + CONFIG.EVENT_NAME + ' — ' + CONFIG.FULL_NAME;

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222">' +
    '<p>' + e(greeting) + '</p>' +
    '<p>Great meeting you at ' + e(CONFIG.EVENT_NAME) + '! Thanks for stopping by. ' +
    "I'm a " + e(CONFIG.HEADLINE.toLowerCase()) + " looking for software development and AI opportunities, " +
    'and here are my links:</p>' +
    '<ul>' +
    '<li>LinkedIn: <a href="' + e(CONFIG.LINKEDIN_URL) + '">' + e(CONFIG.LINKEDIN_URL) + '</a></li>' +
    '<li>Portfolio: <a href="' + e(CONFIG.PORTFOLIO_URL) + '">' + e(CONFIG.PORTFOLIO_URL) + '</a></li>' +
    '<li>Resume: <a href="' + e(CONFIG.RESUME_URL) + '">' + e(CONFIG.RESUME_URL) + '</a></li>' +
    '</ul>' +
    "<p>I'll reach out personally to connect on LinkedIn. You can also reach me at my SFU email, " +
    '<a href="mailto:' + e(CONFIG.EMAIL) + '">' + e(CONFIG.EMAIL) + '</a>, which I\'ll follow up from. ' +
    "My contact card is attached if you'd like to save it.</p>" +
    '<p>Best,<br>' + e(CONFIG.FULL_NAME) + '<br>' + e(CONFIG.SCHOOL) + '</p>' +
    '</div>';

  const text = greeting + '\n\nGreat meeting you at ' + CONFIG.EVENT_NAME + '! Thanks for stopping by.\n\n' +
    'LinkedIn: ' + CONFIG.LINKEDIN_URL + '\nPortfolio: ' + CONFIG.PORTFOLIO_URL +
    '\nResume: ' + CONFIG.RESUME_URL + "\n\nI'll reach out personally to connect on LinkedIn. You can also reach me at my SFU email, " +
    CONFIG.EMAIL + ", which I'll follow up from.\n\nBest,\n" + CONFIG.FULL_NAME;

  GmailApp.sendEmail(to, subject, text, {
    htmlBody: html,
    name: CONFIG.FULL_NAME,
    replyTo: CONFIG.EMAIL,
    attachments: [Utilities.newBlob(vcard_(), 'text/vcard', 'agrim.vcf')]
  });
}

// Queue the push and let a one-off trigger send it, so a slow ntfy.sh can never hold up the page's response.
function notify_(name, company, email) {
  try {
    const who = name || 'Someone';
    const msg = '🤝 New connection: ' + who + ' · ' + (company || 'no company') + ' (' + email + ')';
    const props = PropertiesService.getScriptProperties();
    const queue = JSON.parse(props.getProperty('ntfy_queue') || '[]');
    queue.push(msg);
    props.setProperty('ntfy_queue', JSON.stringify(queue));
    ScriptApp.newTrigger('flushNotifications').timeBased().after(1000).create();
  } catch (err) {
    console.error('queueing ntfy failed', err);
  }
}

// Runs from the trigger above (not from the web request).
function flushNotifications() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let queue = [];
  try {
    const props = PropertiesService.getScriptProperties();
    queue = JSON.parse(props.getProperty('ntfy_queue') || '[]');
    props.deleteProperty('ntfy_queue');
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'flushNotifications') ScriptApp.deleteTrigger(t);
    });
  } finally {
    lock.releaseLock();
  }
  queue.forEach(function (msg) {
    try {
      UrlFetchApp.fetch('https://ntfy.sh/' + encodeURIComponent(CONFIG.NTFY_TOPIC), {
        method: 'post', contentType: 'text/plain; charset=utf-8', payload: msg, muteHttpExceptions: true
      });
    } catch (err) {
      console.error('ntfy failed', err);
    }
  });
}

// vCard 3.0, same content as agrim.vcf on the website.
function vcard_() {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:' + CONFIG.LAST_NAME + ';' + CONFIG.FIRST_NAME + ';;;',
    'FN:' + CONFIG.FULL_NAME,
    'ORG:' + CONFIG.SCHOOL,
    'TITLE:' + CONFIG.HEADLINE,
    'EMAIL;TYPE=INTERNET,WORK:' + CONFIG.EMAIL
  ];
  if (CONFIG.PHONE) lines.push('TEL;TYPE=CELL:' + CONFIG.PHONE);
  lines.push(
    'URL;TYPE=LinkedIn:' + CONFIG.LINKEDIN_URL,
    'URL;TYPE=Portfolio:' + CONFIG.PORTFOLIO_URL,
    'NOTE:Met at ' + CONFIG.EVENT_NAME + '. Looking for software development and AI opportunities.',
    'PHOTO;ENCODING=b;TYPE=JPEG:' + PHOTO_B64,   // from Photo.gs
    'END:VCARD'
  );
  // Fold lines to 75 chars (vCard 3.0), CRLF endings.
  const out = [];
  lines.forEach(function (l) {
    out.push(l.substring(0, 75));
    for (let i = 75; i < l.length; i += 74) out.push(' ' + l.substring(i, i + 74));
  });
  return out.join('\r\n') + '\r\n';
}

// Trim, drop control chars/newlines (blocks header injection), cap length.
function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().substring(0, max);
}

// Stop spreadsheet formula injection (=, +, -, @ at start of a cell).
function safeCell_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Run this once from the editor to grant permissions (Gmail, Sheets, external requests). */
function authorize() {
  sheet_();
  GmailApp.getAliases();
  ScriptApp.getProjectTriggers();         // grants the trigger permission used for push notifications
  try {
    UrlFetchApp.fetch('https://ntfy.sh/' + CONFIG.NTFY_TOPIC, { method: 'post', payload: '✅ Backend authorized' });
  } catch (err) {
    console.log('ntfy not reachable right now (non-fatal): ' + err);
  }
}
