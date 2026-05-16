# Email Tracker Server 🔍

A Vercel serverless pixel tracking server for the email-followup-tool.
Logs email opens (timestamp, count) to a Google Sheet when recipients
open tracked emails.

---

## How it works

1. `email-followup-tool` embeds a 1×1 invisible pixel in outgoing emails:
   ```
   <img src="https://email-tracker-v3.vercel.app/track/{uuid}?email=recipient@example.com">
   ```
2. When the recipient opens the email, their client loads the pixel
3. This server logs: Email ID, Open Count, First Opened, Last Opened, Email Address
4. `email-followup-tool` reads this data and syncs it to the main tracker sheet

---

## Setup

### 1. Google Service Account
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → your project
2. **IAM & Admin → Service Accounts → + Create Service Account**
3. Name it `tracker-server` → Create
4. **Keys tab → Add Key → Create new key → JSON** → download
5. Share your Google Sheet with the service account email (Editor access)

### 2. Deploy to Vercel
1. Clone this repo
2. Install Vercel CLI: `npm install -g vercel`
3. Run: `vercel --prod`
4. Add environment variables in **Vercel Dashboard → Settings → Environment Variables**:
   - `SPREADSHEET_ID` → your Google Sheet ID
   - `GOOGLE_CREDENTIALS_JSON` → full contents of service account JSON (paste as one line)

### 3. Connect GitHub for auto-deploys
**Vercel Dashboard → your project → Settings → Git → Connect Git Repository**  
After connecting, every `git push` auto-deploys.

---

## API

```
GET /track/{email_id}?email={recipient_email}
```

- Returns a 1×1 transparent GIF (invisible to recipient)
- Logs to Google Sheet **"Tracking"** tab:

  | Email ID | Open Count | First Opened | Last Opened | Email Address |
  |---|---|---|---|---|

- Increments Open Count on repeat opens
- Sheet errors are swallowed silently — pixel always responds

---

## Project structure

```
email-tracker-server/
├── api/
│   └── track.js        ← Vercel serverless function
├── vercel.json         ← routing config
├── package.json        ← googleapis dependency
└── README.md
```

---

## Related
- [email-followup-tool](https://github.com/Vedant2811/email-followup-tool) — main Python tool that sends tracked emails
