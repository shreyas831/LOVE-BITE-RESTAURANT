# 🚀 Email & SMS Setup - Quick Start

## The Issue
Emails and SMS are not being sent because **environment variables need to be configured in `.env` file**.

---

## ✅ Quick Fix

### 1️⃣ Open the `.env` file in your project
Located at: `d:\Love-Bite-Restaurant-main\Love-Bite-Restaurant-main\.env`

### 2️⃣ For Email (Recommended - Easy with Gmail)

**If using Gmail:**
1. Go to: https://myaccount.google.com/apppasswords
2. Sign in with your Gmail
3. Generate an app password (16 characters)
4. Copy the password

**Update `.env`:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password-here
```

### 3️⃣ For SMS (Optional - Requires Twilio Account)

**If you want SMS receipts:**
1. Create free Twilio account: https://www.twilio.com/console
2. Verify your phone number
3. Buy a phone number ($1/month)
4. Copy your credentials from dashboard

**Update `.env`:**
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM=+1234567890
```

### 4️⃣ Restart the Server

**Stop the current server** (Ctrl+C in terminal)

**Then restart:**
```bash
npm start
```

**Look for these messages:**
- ✅ `SMTP Email configured successfully` - Email ready!
- ✅ `SMS (Twilio) configured` - SMS ready!
- ⚠️ Messages - Something needs fixing

---

## Testing Email

1. Open restaurant app in browser
2. Add items to cart
3. Enter email: `your-email@gmail.com`
4. Click "Proceed to Payment"
5. Click "Payment Complete"
6. **Check your email inbox for the receipt!**

---

## Testing SMS

1. Add items to cart
2. Enter phone: `+919876543210` (include country code)
3. Click "Proceed to Payment"
4. Click "Payment Complete"
5. **Check SMS on your phone!**

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Email not configured" message | Check `.env` has SMTP_USER and SMTP_PASSWORD |
| Gmail says "not secure" | Use App Password (not your main password) |
| Email not arriving | Check SPAM folder; verify email address is correct |
| "Twilio not configured" | This is OK if you don't want SMS; email still works |
| SMS not working | Verify phone format starts with +91 (India) or +1 (USA) |

---

## Detailed Setup Guides

- **Full Email Setup**: See `SETUP_EMAIL_SMS.md`
- **Server Documentation**: Check server console logs when you restart

---

## Current Status

When you restart the server with `.env` configured, you'll see:

```
✅ SMTP Email configured successfully
   📧 Using: your-email@gmail.com
   📤 Host: smtp.gmail.com
✅ SMS (Twilio) configured
   📱 From: +1234567890
```

If you see ⚠️ warnings instead, fix the variables in `.env` and restart.

---

## Need More Help?

Check the server console (terminal) when placing an order:
- `📬 Receipt request received` - Order received
- `📧 Attempting email receipt...` - Sending email
- `✅ Email sent successfully` - Success!
- `❌ Email sending failed` - Error details shown

All troubleshooting info appears in the server logs.
