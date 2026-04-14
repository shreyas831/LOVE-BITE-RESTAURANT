// UPI Payment QR Code Generator with Amount
(function(){
  const checkoutBtn = document.getElementById('checkoutBtn');
  const paymentModal = document.getElementById('paymentModal');
  const closeBtn = document.getElementById('closePaymentModalBtn');
  const confirmBtn = document.getElementById('confirmPaymentBtn');
  const paymentTotal = document.getElementById('paymentTotal');
  const qrCodeEl = document.getElementById('qrCode');
  const tableInput = document.getElementById('tableNumber');
  const qrContainer = document.getElementById('qrCodeContainer');

  // ============================
  // AUTO UPI QR GENERATOR - CLEAN VERSION
  // ============================
  function generateUpiQr(amount, table){
    if(!qrCodeEl) return;
    
    // Your UPI ID - ADD YOUR UPI ID HERE
    const upiID = "8660589425@omni";  // Replace with your actual UPI ID
    const payeeName = "Love-Bite Restaurant";
    let note = "Food Order Payment";
    if(table && String(table).trim()){
      note += ` | Table ${String(table).trim()}`;
    }

    // Ensure amount is a valid integer
    const amt = Math.max(1, Math.round(Number(amount) || 0));

    // Create UPI URL with amount
    const upiUrl = `upi://pay?pa=${upiID}&pn=${encodeURIComponent(payeeName)}&tn=${encodeURIComponent(note)}&am=${amt}&cu=INR`;

    // Clear previous content (QR canvas and any previous labels)
    if(qrCodeEl) qrCodeEl.innerHTML = '';
    if(qrContainer){
      const prev = qrContainer.querySelectorAll('.qr-labels');
      prev.forEach(n => n.remove());
    }

    // Check if QRCode library is available
    if(!window.QRCode){
      qrCodeEl.innerHTML = `<div class="text-center p-4"><p class="text-red-600">QR Code library not loaded. Please refresh.</p></div>`;
      return;
    }

    try{
      const canvas = document.createElement('canvas');
      
      QRCode.toCanvas(canvas, upiUrl, {
        width: 220,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, function(error){
        if(error){
          console.error('QR Code Generation Error:', error);
          qrCodeEl.innerHTML = `<div class="text-center p-4"><p class="text-red-600 text-sm">Error generating QR</p><p class="text-gray-600 text-xs mt-2">Amount: ₹${amt}</p></div>`;
          return;
        }

        // Append canvas inside the QR box
        qrCodeEl.appendChild(canvas);

        console.log('QR Code generated successfully for amount:', amt);
      });
    }catch(error){
      console.error('QR Code Error:', error);
      qrCodeEl.innerHTML = `<div class="text-center p-4"><p class="text-red-600 text-sm">Error: ${error.message}</p></div>`;
    }
  }

  // Parse amount from text (removes currency symbols)
  function parseAmountText(text){
    if(!text) return 0;
    const cleaned = text.replace(/[₹,\s]/g, '');
    return Math.max(0, Number(cleaned) || 0);
  }

  // Handle checkout button click
  if(checkoutBtn){
    checkoutBtn.addEventListener('click', function(){
      const amountText = document.getElementById('totalAmount')?.innerText || '0';
      const amount = parseAmountText(amountText);

      if(amount <= 0){
        alert('Your cart is empty. Please add items.');
        return;
      }

      // Show payment modal
      if(paymentTotal) paymentTotal.innerText = '₹' + amount.toFixed(2);
      if(paymentModal) paymentModal.classList.remove('hidden');

      // read table number (if filled) and generate QR code with the amount + table info
      // Read current table input value. If empty, try to prefill from last booking in localStorage
      let tableValue = tableInput?.value || '';
      if(!tableValue){
        try{
          const bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
          if(Array.isArray(bookings) && bookings.length){
            const last = bookings[bookings.length - 1];
            if(last && (last.tableNumber || last.table)){
              tableValue = String(last.tableNumber || last.table || '').trim();
              if(tableInput) tableInput.value = tableValue;
            }
          }
        }catch(e){
          // ignore parse errors
        }
      } else {
        if(tableInput) tableInput.value = tableValue; // preserve value
      }

      generateUpiQr(amount, tableValue);
    });
  }

  // Close payment modal
  if(closeBtn){
    closeBtn.addEventListener('click', function(){
      if(paymentModal) paymentModal.classList.add('hidden');
    });
  }

  // Confirm payment
  if(confirmBtn){
    confirmBtn.addEventListener('click', async function(){
      const tableValue = tableInput?.value;
      const emailValue = document.getElementById('emailAddress')?.value?.trim();
      const phoneValue = document.getElementById('phoneNumber')?.value?.trim();
      
      // Get the current cart and calculate totals
      let cart = JSON.parse(localStorage.getItem('cart') || '[]');
      
      if(!cart || cart.length === 0){
        alert('Your cart is empty.');
        return;
      }
      
      // Calculate totals
      const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.qty || 1)), 0);
      const tax = subtotal * 0.02;
      const serviceFee = 2; // Fixed service fee
      const total = +(subtotal + tax + serviceFee);
      
      // Create order object
      const orderId = 'ORD-' + Date.now();
      const order = {
        id: orderId,
        items: cart,
        subtotal: subtotal,
        tax: tax,
        serviceCharge: serviceFee,
        total: total,
        tableNumber: tableValue || null,
        date: new Date().toISOString()
      };
      
      try {
        // Save order to server
        const orderResponse = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        });
        
        if(!orderResponse.ok){
          throw new Error('Failed to save order');
        }
        
        // Email is required for receipt
        if(!emailValue){
          alert('⚠️ Email is required for order receipt');
          return;
        }
        
        // Send receipt via email
        try {
          await fetch('/api/send-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: emailValue,
              phone: phoneValue || null,
              order: order
            })
          });
        } catch(receiptErr){
          console.warn('Receipt sending failed (non-critical):', receiptErr);
        }
        
        let successMsg = '✓ Payment successful! Thank you for your order.\n\nOrder ID: ' + orderId;
        if(tableValue && String(tableValue).trim()){
          successMsg += `\n\nTable: ${String(tableValue).trim()}`;
        }
        if(emailValue){
          successMsg += `\n\n📧 Receipt sent to: ${emailValue}`;
        }
        
        alert(successMsg);
        
        // Clear cart
        const cartItems = document.getElementById('cartItems');
        if(cartItems) cartItems.innerHTML = '<p id="emptyCartMessage" class="text-gray-500 text-center py-10">Your cart is empty</p>';
        
        // Clear localStorage cart
        localStorage.removeItem('cart');
        
        // Close modal
        if(paymentModal) paymentModal.classList.add('hidden');
        
        // Hide cart sidebar
        const cartSidebar = document.getElementById('cartSidebar');
        if(cartSidebar) cartSidebar.classList.add('translate-x-full');
        
        // Update cart count
        const cartCount = document.getElementById('cartCount');
        if(cartCount){
          cartCount.textContent = '0';
          cartCount.classList.add('hidden');
        }
        
      } catch(error){
        console.error('Order placement error:', error);
        alert('❌ Error placing order. Please try again.');
      }
    });
  }
})();
