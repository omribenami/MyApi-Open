# Email Service Setup Guide

MyApi supports three email providers:

1. **Resend** (Recommended — modern, SaaS-friendly) ⭐
2. **SendGrid** (Industry standard, free tier available)
3. **SMTP** (Any SMTP server, including Mailgun, Mailtrap, localhost)

---

## Quick Start: Resend (Recommended)

**Why Resend?**
- ✅ Built for SaaS teams (simple, modern API)
- ✅ Free tier: 100 emails/day
- ✅ Fastest setup (~2 minutes)
- ✅ Developer-friendly dashboard

### Step 1: Sign Up
1. Go to https://resend.com
2. Click **"Get Started"** (free)
3. Verify your email
4. Create your account

### Step 2: Get API Key
1. In Resend dashboard, go to **API Keys**
2. Click **"Create API Key"**
3. Copy the API key (starts with `re_...`)

### Step 3: Configure MyApi
Add to your `.env` file:
```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx  # Paste your API key here
EMAIL_FROM=noreply@myapiai.com
EMAIL_FROM_NAME=MyApi
```

### Step 4: Test
1. Go to **Dashboard → Email Settings**
2. Click **"Test Email Configuration"**
3. Enter your email
4. Check your inbox for test email

✅ Done! Emails now send automatically every 5 minutes.

---

## Alternative: SendGrid

### Step 1: Sign Up
1. Go to https://sendgrid.com
2. Click **"Sign Up Free"** (free tier: 100 emails/day)
3. Verify email + create account

### Step 2: Get API Key
1. In SendGrid dashboard, go to **Settings → API Keys**
2. Click **"Create API Key"**
3. Give it a name (e.g., "MyApi")
4. Select "Full Access"
5. Copy the key

### Step 3: Configure MyApi
Add to your `.env` file:
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxx  # Paste your API key here
EMAIL_FROM=noreply@myapiai.com
EMAIL_FROM_NAME=MyApi
```

### Step 4: Test
Same as Resend Step 4

---

## Alternative: SMTP (Any Provider)

You can use any SMTP server: Mailgun, Mailtrap, Gmail (with app password), or local Postfix.

### Example: Mailgun

#### Step 1: Sign Up
1. Go to https://mailgun.com
2. Free tier: 100 emails/month (for 3 months)

#### Step 2: Get SMTP Credentials
1. In Mailgun dashboard, go to **Sending → Domain Settings**
2. Click your domain
3. Under **SMTP Credentials**, you'll see:
   - SMTP Server: `smtp.mailgun.org`
   - Port: `587`
   - Username: `postmaster@your-domain.mailgun.org`
   - Password: (generated)

#### Step 3: Configure MyApi
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false  # true for port 465, false for 587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASSWORD=xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@myapiai.com
EMAIL_FROM_NAME=MyApi
```

#### Step 4: Test
Same as above

---

## Environment Variables Reference

### Common (All Providers)
```bash
EMAIL_FROM=noreply@myapiai.com              # ✅ Required
EMAIL_FROM_NAME=MyApi                       # Optional (default: MyApi)
EMAIL_PROVIDER=resend|sendgrid|smtp         # Optional (default: smtp)
INTERNAL_PROCESS_KEY=your-secret-key        # Optional (for admin endpoints)
```

### Resend Only
```bash
RESEND_API_KEY=re_xxxxx                    # ✅ Required if EMAIL_PROVIDER=resend
```

### SendGrid Only
```bash
SENDGRID_API_KEY=SG.xxxxx                  # ✅ Required if EMAIL_PROVIDER=sendgrid
```

### SMTP Only
```bash
SMTP_HOST=smtp.mailgun.org                 # ✅ Required if EMAIL_PROVIDER=smtp
SMTP_PORT=587                              # ✅ Required (typically 587 or 465)
SMTP_SECURE=false                          # true for 465, false for 587
SMTP_USER=postmaster@domain.com            # Required if SMTP auth needed
SMTP_PASSWORD=xxxxxx                       # Required if SMTP auth needed
```

---

## Testing & Monitoring

### Test Email Configuration
```bash
curl -X GET http://localhost:4500/api/v1/email/status \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Send Test Email
```bash
curl -X POST http://localhost:4500/api/v1/email/send-test \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

### View Email Queue
```bash
curl -X GET http://localhost:4500/api/v1/email/jobs \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## How It Works

1. **Notification Created** → User takes action (approves device, connects service, etc.)
2. **Email Queued** → NotificationService checks preferences and queues if enabled
3. **Auto-Processing** → Every 5 minutes, emailService sends 50 pending emails
4. **Status Tracked** → Emails marked as "sent" or "failed" in database
5. **User Preferences** → Users can enable/disable notifications in **Dashboard → Settings → Notifications**

---

## Troubleshooting

### Emails Not Sending
1. Check provider is configured: `GET /api/v1/email/status`
2. Check email queue: `GET /api/v1/email/jobs`
3. Look for failures in logs: `docker logs myapi-backend` (or `grep "Email" /tmp/myapi.log`)

### "EMAIL_FROM not configured"
- Set `EMAIL_FROM=noreply@myapiai.com` in `.env`
- Restart server

### API Key Rejected
- Verify key is correct (copy/paste carefully, no spaces)
- Check key hasn't expired in provider dashboard
- Ensure key has "Send" permissions

### SMTP Connection Failed
- Test connection: `telnet SMTP_HOST SMTP_PORT`
- Check credentials: `SMTP_USER` and `SMTP_PASSWORD` must match provider
- Verify firewall allows outbound port (usually 587 or 465)

### Test Email Never Arrives
- Check spam/junk folder
- Verify `EMAIL_FROM` domain is whitelisted with provider
- Check provider's email logs for bounce/reject reasons

---

## Production Deployment

### Recommended Setup
1. **Resend** for most SaaS (simplest, modern)
2. Add `EMAIL_FROM=noreply@myapiai.com` to your `.env`
3. Set `RESEND_API_KEY` from your Resend dashboard
4. Test with `POST /api/v1/email/send-test`
5. Enable notifications in Settings → Notifications

### Monitoring
- Dashboard shows recent email jobs: **Dashboard → Settings → Email Status**
- Check error logs regularly for delivery failures
- Monitor API quota usage in provider dashboard

---

## FAQ

**Q: How often are pending emails sent?**  
A: Every 5 minutes, in batches of 50.

**Q: Can I change the sending frequency?**  
A: Yes, edit `src/index.js` line ~548, change `5 * 60 * 1000` to your preferred interval (in milliseconds).

**Q: What if I want to use a different provider later?**  
A: Just change `EMAIL_PROVIDER` and credentials in `.env`, restart the server.

**Q: Are emails sent immediately?**  
A: No, they're queued and sent in batches every 5 minutes. This prevents rate-limit issues and allows bulk processing.

**Q: Can users disable email notifications?**  
A: Yes! Go to **Settings → Notifications → Email** and toggle off.

---

## Support

If emails aren't working:
1. Check provider status page (Resend/SendGrid is down?)
2. Verify credentials in `.env`
3. Review logs: `grep Email /tmp/myapi.log`
4. Test with `/api/v1/email/send-test` endpoint
5. Check spam folder (provider may have flagged your domain)
