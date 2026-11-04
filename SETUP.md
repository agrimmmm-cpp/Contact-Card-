# Tonight's setup (~20 min)

Your ntfy topic (already in `Code.gs`): `agrim-fair-a24a522b27fcb04022fee832` — treat it like a password; anyone who knows it can read your notifications.

## 0. Edit these first
- `EVENT_NAME` in `apps-script/Code.gs` and `event` in `make_vcard.py` are set to **"the Tech Fair"**. Change to the real name (e.g. "the SFU Tech Fair"), then run `python3 make_vcard.py` to rebuild `agrim.vcf` + `Photo.gs`.
- Tweak the bio text in `index.html` if you want different wording.

## 1. Backend (Google Apps Script)
1. Go to sheets.new → name it "Fair Connections".
2. **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with `apps-script/Code.gs`.
4. Click **+ → Script**, name it `Photo`, paste `apps-script/Photo.gs`.
5. Top bar: pick function **`authorize`** → **Run** → Review permissions → choose your account → *Advanced → Go to project (unsafe)* → Allow. (Your phone should buzz "✅ Backend authorized" once ntfy is set up, step 2.)
6. **Deploy → New deployment → ⚙ Web app** → Execute as: **Me**, Who has access: **Anyone** → Deploy → copy the **Web app URL** (ends in `/exec`).
   - If you edit the script later: **Deploy → Manage deployments → ✏ → Version: New version → Deploy** (the URL stays the same).
7. Open `index.html`, paste the URL into `CONFIG.APPS_SCRIPT_URL`.

> Sending from your SFU address: this runs as whichever Google account you're signed into. If `aja121@sfu.ca` is a Google Workspace account, use it. If not, the email goes out from your Gmail with Reply-To set to `aja121@sfu.ca`. Gmail's limit is ~100 recipients/day (500 on Workspace), plenty for a fair.

## 2. ntfy on your phone
Install **ntfy** (App Store / Play Store) → **+** → topic `agrim-fair-a24a522b27fcb04022fee832` → Subscribe → allow notifications. (On iPhone, keep Focus/Do Not Disturb off at the fair.)

## 3. Deploy the page (GitHub Pages)
```bash
cd ~/Contact-Card-
git add -A && git commit -m "Networking page" && git push origin main
```
Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `/ (root)`. After ~1 min the page is at:

**https://agrimmmm-cpp.github.io/Contact-Card-/**

> This publishes your resume PDF, phone number (inside `agrim.vcf`) and photo to a public URL. That's the point of the card, but remove the phone from `make_vcard.py` and `Code.gs` if you'd rather not share it.

Check the vCard MIME type after it's live (should say `text/vcard` or `text/x-vcard`):
```bash
curl -sI https://agrimmmm-cpp.github.io/Contact-Card-/agrim.vcf | grep -i content-type
```

## 4. Write the NFC tag
NFC Tools app → **Write → Add a record → URL/URI** → `https://agrimmmm-cpp.github.io/Contact-Card-/` → Write → hold phone on tag. Then **Other → Lock tag** only after testing (locking is permanent).

---

# Testing checklist
- [ ] **Offline first**: in phone airplane mode, open page → submit → red error + "Or just tell me your name — I'll find you on LinkedIn." appears; button reads "Try again".
- [ ] **iPhone tap**: tap tag with a locked iPhone → banner opens page in Safari.
- [ ] **Android tap**: NFC on, tap tag → opens in Chrome.
- [ ] Open the link inside **LinkedIn / Instagram in-app browser** (send yourself the link): page renders, form works.
- [ ] LinkedIn button opens the LinkedIn app (or site). Portfolio and Resume open.
- [ ] **Save My Contact**: iPhone shows contact preview with *Add Contact*; Android opens Contacts "Add" screen. Photo, phone, title, URLs, note present. (If it only shows raw text, re-check the `curl` header above; fallback: email attachment has the same vCard.)
- [ ] Submit with a bad email → inline validation message, nothing sent.
- [ ] Submit with a real address (use a **school/work-style inbox**, not just your Gmail) → button "Sending…" → "Sent! Check your inbox 👋".
- [ ] Email arrives in a few seconds; check **Spam/Promotions** too; Reply goes to aja121@sfu.ca; `agrim.vcf` attachment opens.
- [ ] Sheet has a new row (timestamp, name, company, email, user agent).
- [ ] Phone shows "🤝 New connection: …" push.
- [ ] Submit same email again within 10 min → success shown, but **no** second email/row.
- [ ] Double-tap Submit fast → only one email.
