# Email & SMS Setup Guide

## Quick Start

1. **Configure Environment Variables**
   - Copy `.env` file and fill in your credentials
   - See sections below for setup instructions

---

## 🔧 Email Setup (Gmail)

### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification

### Step 2: Create App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Windows Computer" (or your device)
3. Google will generate a 16-character password
4. Copy this password

### Step 3: Add to `.env`
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
```

### Test Email
After setting up, orders will automatically send receipt emails when customers provide their email address.

**Expected Format:**
- To: customer@example.com
- Subject: `Order Confirmation - Love-Bite Restaurant #ORD-123456`
- Includes: Order ID, items, subtotal, tax (2%), service charge, total

---

## 📱 SMS Setup (Twilio - Optional)

### Step 1: Create Twilio Account
1. Go to [Twilio Console](https://www.twilio.com/console)
2. Sign up and verify phone number
3. Get your credentials from dashboard

### Step 2: Buy a Phone Number
1. In Twilio console, go to "Phone Numbers" → "Buy a Number"
2. Choose country and area code
3. Purchase the number (usually $1/month)

### Step 3: Add to `.env`
```
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1-234-567-8900
```

### Test SMS
After setup, orders will send SMS receipts when customers provide their phone number.

**Expected Format:**
- From: Your Twilio number
- Message: `Love-Bite: Order #ORD-123456 | Table: 5 | Items: Biryani x1, Coke x2 | Total: ₹580.00`

---

## ✅ Verification Checklist

After setup, verify by:

1. **Start server:**
   ```bash
   npm start
   ```
   Look for:
   - ✅ SMTP transporter verified
   - ✅ Twilio client initialized (or warning if disabled)

2. **Place test order with email:**
   - Add items to cart
   - Enter email: `test@example.com`
   - Click "Proceed to Payment"
   - Complete payment
   - Check email inbox for receipt

3. **Place test order with SMS:**
   - Add items to cart
   - Enter phone: `+919876543210` (India) or `+1234567890` (USA)
   - Click "Proceed to Payment"
   - Complete payment
   - Check SMS on phone

---

## 🐛 Troubleshooting

### "SMTP transporter not configured" message
- Make sure `SMTP_USER` and `SMTP_PASSWORD` are in `.env`
- Restart the server after adding credentials
- Check credentials are correct (copy-paste carefully)

### "Twilio not configured" message
- This is normal if you don't want SMS
- SMS is optional - email receipts will still work
- If you want SMS, fill in the Twilio variables in `.env`

### Email still not sending
Check server console for errors:
```
❌ Email sending error: [specific error message]
```

Common issues:
- **Gmail**: Verify app password (not your main password)
- **SMTP_PORT**: Should usually be 587 (not 465)
- **Firewall**: Some networks block SMTP - try using a different network

### SMS not sending
Check server console:
```
❌ SMS send error: [specific error message]
```

Common issues:
- **Phone format**: Add country code (+91 for India, +1 for USA)
- **Account balance**: Twilio needs credits for SMS
- **Number format**: International format required (+country-code)

---

## 📊 Tax Configuration

Current tax rate: **2%**

This is applied to:
- Email receipts: `Tax (2%): ₹X.XX`
- SMS messages: Included in total
- Frontend display: Shows in cart

To change tax rate, edit:
- `js/script.js` line 491: `const tax = subtotal * 0.02`
- `server/index.js` line 686: `const tax = +(subtotal * 0.02)`

---

## Advanced: Using other email providers

### Outlook/Hotmail
```env
SMTP_HOST=smtp.live.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxx
```

### AWS SES
```env
SMTP_HOST=email-smtp.region.amazonaws.com
SMTP_PORT=587
SMTP_USER=iam-user-credentials
SMTP_PASSWORD=iam-user-password
```

---

## Need Help?

1. Check server console for error messages (most helpful)
2. Verify credentials are correct (copy-paste from source)
3. Ensure server is restarted after `.env` changes
4. Check firewall/network settings if unable to connect

All logs appear in the terminal where you ran `npm start`
