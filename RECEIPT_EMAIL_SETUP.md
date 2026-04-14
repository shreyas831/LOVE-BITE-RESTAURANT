# Receipt Email Functionality Setup

## Overview
The Love-Bite Restaurant system now sends receipts via email and SMS when customers place orders. This document explains how the feature works and how to configure it.

## Features Implemented

### 1. **Email Input in Cart Sidebar**
- Email field in the checkout panel (optional)
- Phone number field in the checkout panel (optional)
- Real-time validation with visual feedback
- Green checkmark when email/phone format is correct

### 2. **Automatic Receipt Sending**
When a customer clicks "Payment Complete" button:
- Order is saved to the server
- Receipt email is automatically sent to the provided email address
- SMS receipt is sent to the provided phone number
- Customer sees confirmation message with receipt delivery status

### 3. **Receipt Email Content**
The email receipt includes:
- Order ID and date/time
- Customer phone number
- Table number (if applicable)
- Itemized list of ordered dishes with quantities and prices
- Billing breakdown:
  - Subtotal
  - Tax (10%)
  - Service Charge
  - Total Amount
- Order confirmation message

### 4. **SMS Receipt Content**
The SMS includes:
- Order ID
- Table number
- Summary of items ordered
- Total amount to be paid

## Configuration Required

### Email (SMTP) Setup
To enable email receipts, set these environment variables in your `.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_SECURE=false
```

**For Gmail:**
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password as `SMTP_PASSWORD`

### SMS (Twilio) Setup
To enable SMS receipts, set these environment variables:

```env
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM=+1234567890
TWILIO_PHONE_NUMBER=+1234567890
```

**For Twilio:**
1. Create a Twilio account at https://www.twilio.com
2. Get your Account SID and Auth Token from the dashboard
3. Purchase a phone number or use a trial number
4. Use that number as `TWILIO_FROM`

## How It Works

### Frontend Flow (JavaScript)
1. User adds items to cart
2. User enters email and/or phone in the cart sidebar
3. User clicks "Proceed to Payment"
4. QR code is generated for payment
5. User clicks "Payment Complete" after payment
6. Order details are sent to server along with email/phone
7. Success message shows if receipt was sent

### Backend Flow (Node.js)
1. `POST /api/orders` - Receives and stores order
2. `POST /api/send-receipt` - Sends email and SMS receipts
3. `sendReceiptEmail()` - Email function using Nodemailer
4. `sendSms()` - SMS function using Twilio

## Files Modified/Created

### Modified Files:
- **js/payments.js** - Added email/phone capture and receipt sending
- **js/script.js** - Already had receipt sending in completeOrder function
- **index.html** - Already had email/phone input fields in cart sidebar

### Server Files:
- **server/index.js** - Already has `/api/send-receipt` endpoint
- Includes `sendReceiptEmail()` and `sendSms()` functions
- Uses Nodemailer and Twilio for delivery

## Testing the Feature

### Test Email Sending:
1. Start the server: `npm start` or `npm run dev`
2. Add items to cart
3. Enter a test email address
4. Complete payment
5. Check if receipt email is received

### Test SMS Sending:
1. Use a real phone number (during testing, use a Twilio trial number)
2. Check if SMS is received with order details

### Without Email/SMS Setup:
- Orders will still be placed and saved
- Receipt sending will fail gracefully
- Customers will see appropriate messages

## Email Validation

The system validates email format with this regex:
```javascript
/^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

Valid formats:
- user@example.com ✓
- user.name@company.co.uk ✓

Invalid formats:
- user@example (missing domain extension) ✗
- user@.com (missing domain name) ✗
- userexample.com (missing @) ✗

## Phone Validation

The system validates phone format with this regex:
```javascript
/^[+]?[(]?[0-9]{1,3}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/
```

Valid formats:
- 9876543210 ✓
- +91-9876543210 ✓
- +1 (234) 567-8900 ✓

## API Endpoints

### POST /api/orders
Create a new order

**Request:**
```json
{
  "id": "ORD-1712938472346",
  "items": [
    {"id": 1, "name": "Paneer Tikka", "qty": 2, "price": 120}
  ],
  "subtotal": 240,
  "tax": 24,
  "serviceCharge": 2,
  "total": 266,
  "tableNumber": "5",
  "date": "2024-04-13T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "ORD-1712938472346"
}
```

### POST /api/send-receipt
Send receipt via email and SMS

**Request:**
```json
{
  "email": "customer@example.com",
  "phone": "9876543210",
  "order": {
    "id": "ORD-1712938472346",
    "items": [...],
    "total": 266
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Receipt delivery attempted",
  "orderId": "ORD-1712938472346",
  "email": {"success": true},
  "sms": {"success": true}
}
```

## Troubleshooting

### Emails not sending:
1. Check SMTP credentials are correct
2. Check if Gmail 2FA is enabled and App Password is used
3. Check server logs for errors
4. Verify firewall allows SMTP port 587

### SMS not sending:
1. Check Twilio credentials
2. Verify phone number format (should include country code)
3. Check Twilio account balance/credits
4. Verify phone number is valid

### Order placed but receipt not sent:
- This is expected behavior - order priority over receipt
- Customers can request receipt later
- Check server logs for any errors

### Validation errors showing:
- Ensure email follows standard format (user@domain.com)
- Ensure phone has at least 10 digits
- Remove any invalid characters

## Next Steps

To fully implement this feature:

1. **Set up email credentials** in .env file
2. **Set up SMS credentials** (optional but recommended)
3. **Test** order placement with email/phone
4. **Monitor logs** for any issues
5. **Update** UPI ID in payments.js if using actual UPI account

## Security Notes

- Email passwords should never be committed to repository
- Use .env file for sensitive information
- Validate all user inputs on both frontend and backend
- Rate limiting is applied to API endpoints (100 requests per 15 minutes)
- CORS is enabled for the app server

## Future Enhancements

- [ ] Email templates (HTML with branding)
- [ ] SMS templates (customizable messages)
- [ ] Receipt resend function
- [ ] Invoice PDF generation
- [ ] WhatsApp integration
- [ ] Email delivery tracking
- [ ] Bulk SMS to customers
- [ ] Digital receipt with QR code verification
