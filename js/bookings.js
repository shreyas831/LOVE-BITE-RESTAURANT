// Table Booking System with Auto Table Allocation
(function(){
  // Configuration
  const TOTAL_TABLES = 15;
  const STORAGE_KEY = 'love_bite_tables';
  // Use common key 'bookings' so admin dashboard and other parts read the same data
  const BOOKINGS_KEY = 'bookings';

  // Initialize table allocation system
  let allocatedTables = loadAllocatedTables();

  function loadAllocatedTables(){
    try{
      // Prefer the current allocations map (admin_allocations). Fall back to legacy love_bite_tables array for compatibility.
      const storedMap = localStorage.getItem('admin_allocations');
      const storedArr = localStorage.getItem(STORAGE_KEY);
      const stored = storedMap || storedArr;
      if (!stored) return new Set();
      const parsed = JSON.parse(stored);
      // Support both object map (admin_allocations) and legacy array (love_bite_tables)
      if (Array.isArray(parsed)) {
        return new Set(parsed.map(n => Number(n)));
      } else if (typeof parsed === 'object' && parsed !== null) {
        return new Set(Object.keys(parsed).map(k => Number(k)));
      }
      return new Set();
    }catch(e){
      console.warn('Error loading allocated tables:', e);
      return new Set();
    }
  }

  function saveAllocatedTables(){
    try{
      // Persist minimal admin_allocations mapping (table -> current bookingId or null)
      const alloc = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
      Array.from(allocatedTables).forEach(n => {
        if (!(String(n) in alloc)) alloc[String(n)] = null;
      });
      localStorage.setItem('admin_allocations', JSON.stringify(alloc));
    }catch(e){
      console.warn('Error saving allocated tables:', e);
    }
  }

  function getNextAvailableTable(){
    for(let i = 1; i <= TOTAL_TABLES; i++){
      if(!allocatedTables.has(i)){
        allocatedTables.add(i);
        saveAllocatedTables();
        return i;
      }
    }
    return null;
  }

  function releaseTable(tableNumber){
    if(tableNumber){
      allocatedTables.delete(tableNumber);
      saveAllocatedTables();
    }
  }

  // Create booking modal
  function createModal(){
    const modal = document.createElement('div');
    modal.id = 'bookingModal';
    modal.className = 'fixed inset-0 flex items-center justify-center z-50 hidden';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        <!-- Header -->
        <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">Book a Table</h2>
          <button id="closeBooking" class="text-gray-500 dark:text-gray-300 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <!-- Scrollable Form Content -->
        <div class="p-4 overflow-y-auto flex-1">
          <form id="bookingForm" class="space-y-4">
            <!-- Name Field -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input required name="name" type="text" placeholder="Enter your name" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500" />
            </div>

            <!-- Phone Field -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input required name="phone" type="tel" placeholder="Enter phone number" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500" />
            </div>

            <!-- Date Field -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input required name="date" type="date" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500" />
            </div>

            <!-- Time Field -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input required name="time" type="time" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500" />
            </div>

            <!-- Guests Field -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Number of Guests</label>
              <input required name="guests" type="number" min="1" max="10" value="2" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500" />
            </div>

            <!-- Message Field -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Special Request (Optional)</label>
              <textarea name="message" placeholder="Any special requests or dietary restrictions?" class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500" rows="2"></textarea>
            </div>

            <!-- Allocation Success Message -->
            <div id="allocationSuccess" class="hidden bg-green-50 border-2 border-green-400 rounded-lg p-4">
              <div class="flex items-center mb-2">
                <span class="text-green-600 text-2xl mr-2">✓</span>
                <p class="font-bold text-green-700">Table Allocated!</p>
              </div>
              <p id="tableNumberDisplay" class="text-lg font-bold text-green-800">Table #<span id="tableNum">-</span></p>
              <p class="text-sm text-green-700 mt-2">Your table has been reserved. Please arrive on time.</p>
            </div>
          </form>
        </div>

        <!-- Footer (fixed) -->
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button id="confirmBookingBtn" class="flex-1 bg-gradient-to-r from-pink-600 to-orange-500 hover:opacity-90 text-white font-bold py-3 px-4 rounded-lg transition">Confirm Booking</button>
          <button type="button" id="cancelBooking" class="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  // Initialize modal
  const modal = createModal();
  const openBtn = document.getElementById('bookingBtn');
  const closeBtn = modal.querySelector('#closeBooking');
  const cancelBtn = modal.querySelector('#cancelBooking');
  const confirmBtn = modal.querySelector('#confirmBookingBtn');
  const form = modal.querySelector('#bookingForm');
  const allocationSuccess = modal.querySelector('#allocationSuccess');
  const tableNumDisplay = modal.querySelector('#tableNum');

  function openModal(){ 
    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
    allocationSuccess.classList.add('hidden');
    form.reset();
  }

  function closeModal(){ 
    modal.classList.add('hidden'); 
    modal.classList.remove('flex');
  }

  if(openBtn) openBtn.addEventListener('click', openModal);
  if(closeBtn) closeBtn.addEventListener('click', closeModal);
  if(cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if(confirmBtn) confirmBtn.addEventListener('click', () => {
    // Use requestSubmit so form validation runs before submit
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.submit();
    }
  });

  // Small date helper (dd/mm/yyyy, HH:MM:SS)
  function formatDateTime(value, includeTime = true) {
    if (!value && value !== 0) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    if (!includeTime) return `${dd}/${mm}/${yyyy}`;
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;
  }

  // Form submission with auto table allocation
  form.addEventListener('submit', async function(e){
    e.preventDefault();

    const formData = new FormData(form);
    const bookingData = Object.fromEntries(formData);
    bookingData.id = Date.now();
    bookingData.status = 'confirmed';

    // Record when customer submitted (ordered) this booking
    bookingData.createdAt = Date.now();
    bookingData.bookedAt = Date.now();

    // Auto-allocate table
    const tableNumber = getNextAvailableTable();
    
    if(!tableNumber){
      alert('⚠ Sorry! All tables are currently booked. Please try another time.');
      return;
    }

    // Store tableNumber and record allocation mapping separately (do not write into booking.table)
    bookingData.tableNumber = tableNumber;    // Record lastAssignedTable for historical visibility in manager dashboard
    bookingData.lastAssignedTable = tableNumber;    // Persist allocation mapping for admin UI
    try {
      const alloc = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
      alloc[String(tableNumber)] = bookingData.id;
      localStorage.setItem('admin_allocations', JSON.stringify(alloc));
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!arr.includes(Number(tableNumber))) {
        arr.push(Number(tableNumber));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      }
    } catch (e) { console.warn('Failed to persist admin allocation', e); }

    // Requested slot (customer's requested booking date & time)
    let requestedTimestamp = Date.now();
    if (bookingData.date && bookingData.time) {
      try {
        requestedTimestamp = new Date(`${bookingData.date}T${bookingData.time}`).getTime();
      } catch (e) {
        requestedTimestamp = Date.now();
      }
    } else if (bookingData.bookingDate) {
      requestedTimestamp = new Date(bookingData.bookingDate).getTime();
    }

    // Store requested slot in allocatedAt (per new requirement): "Allocated At" = requested slot
    bookingData.allocatedAt = requestedTimestamp;

    // Also record the time when the table was actually assigned (assignment timestamp)
    bookingData.tableAssignedAt = Date.now();

    // Save allocated table and timestamps to sessionStorage and set flag to show banner
    sessionStorage.setItem('allocatedTableNumber', tableNumber);
    sessionStorage.setItem('allocatedAt', bookingData.allocatedAt);
    sessionStorage.setItem('tableAssignedAt', bookingData.tableAssignedAt);
    sessionStorage.setItem('showTableBanner', 'true');

    // Save to localStorage
    try{
      const existingBookings = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]');
      existingBookings.push(bookingData);
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(existingBookings));
      // Notify same-tab listeners via custom event (some browsers block synthetic StorageEvent)
      try { window.dispatchEvent(new CustomEvent('bookings-updated', { detail: bookingData })); } catch (e) { /* ignore */ }
      console.log('Booking saved:', bookingData);
    }catch(e){
      console.warn('Error saving booking:', e);
    }

    // Try to send to server (optional) and reconcile server-assigned id
    try{
      const resp = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
        // note: fetch doesn't support timeout natively; rely on network timeouts
      }).catch(() => null);

      if (resp && resp.ok) {
        const data = await resp.json();
        if (data && data.bookingId && data.bookingId !== bookingData.id) {
          // update saved booking with server id
          try{
            const existingBookings = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]');
            const idx = existingBookings.findIndex(b => b.id == bookingData.id);
            if (idx !== -1) {
              existingBookings[idx].id = data.bookingId;
              // update the stored array
              localStorage.setItem(BOOKINGS_KEY, JSON.stringify(existingBookings));
            }
          }catch(e){
            console.warn('Failed to reconcile booking id with server:', e);
          }
        }
      }
    }catch(e){
      console.log('Server API unavailable, using local storage only');
    }

    // Show notification toast and close modal
    const notificationPanel = document.getElementById('notificationPanel');
    if(notificationPanel){
      const notification = document.createElement('div');
      notification.className = 'bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 animate-pulse';
      notification.innerHTML = `
        <i class="fas fa-check-circle text-xl"></i>
        <div>
          <p class="font-bold">Booking Confirmed!</p>
          <p class="text-sm">Table #${tableNumber} | ${bookingData.date} at ${bookingData.time}</p>
          <p class="text-xs">Requested for: ${formatDateTime(bookingData.allocatedAt)}</p>
          <p class="text-xs">Assigned at: ${formatDateTime(bookingData.tableAssignedAt)}</p>
        </div>
      `;
      notificationPanel.appendChild(notification);
      notificationPanel.classList.remove('hidden');
      
      // Show table allocated banner immediately
      const tableAllocatedBanner = document.getElementById('tableAllocatedBanner');
      const displayTableNum = document.getElementById('displayTableNum');
      const displayAllocatedTime = document.getElementById('displayAllocatedTime');
      const displayAssignedTime = document.getElementById('displayAssignedTime');
      if (tableAllocatedBanner && displayTableNum) {
        displayTableNum.textContent = tableNumber;
        if (displayAllocatedTime) displayAllocatedTime.textContent = formatDateTime(bookingData.allocatedAt);
        if (displayAssignedTime) displayAssignedTime.textContent = formatDateTime(bookingData.tableAssignedAt);
        tableAllocatedBanner.classList.remove('hidden');
      }
      
      setTimeout(() => {
        notification.remove();
        if(notificationPanel.children.length === 0){
          notificationPanel.classList.add('hidden');
        }
      }, 4000);
    }

    closeModal();
  });

  // table-number display removed — keeping booking persistence and notification only

  // Keep in sync if allocations change in other tabs/windows
  window.addEventListener('storage', (e) => {
    if (e.key === 'admin_allocations') {
      try {
        const parsed = JSON.parse(e.newValue || '{}');
        allocatedTables = new Set(Object.keys(parsed).map(k => Number(k)));
      } catch (err) { /* ignore */ }
    }
  });

})();
