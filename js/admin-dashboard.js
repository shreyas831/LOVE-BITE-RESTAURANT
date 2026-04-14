// Admin Dashboard Handler
(function() {
    const adminEmail = document.getElementById('adminEmail');
    const logoutBtn = document.getElementById('logoutBtn');
    const bookingsList = document.getElementById('bookingsList');
    const ordersList = document.getElementById('ordersList');
    const menuList = document.getElementById('menuList');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Toast container and helper
    function ensureToastContainer() {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.style.position = 'fixed';
            container.style.top = '16px';
            container.style.right = '16px';
            container.style.zIndex = 9999;
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '8px';
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type = 'info', duration = 4000) {
        const container = ensureToastContainer();
        const toast = document.createElement('div');
        toast.className = 'shadow-lg rounded p-3 text-sm flex items-start gap-3';
        toast.style.minWidth = '200px';
        toast.style.maxWidth = '320px';
        toast.style.boxSizing = 'border-box';
        if (type === 'success') {
            toast.style.background = '#ecfccb';
            toast.style.color = '#14532d';
        } else if (type === 'error') {
            toast.style.background = '#fee2e2';
            toast.style.color = '#7f1d1d';
        } else if (type === 'warning') {
            toast.style.background = '#fff7ed';
            toast.style.color = '#92400e';
        } else {
            toast.style.background = '#e6f0ff';
            toast.style.color = '#0f172a';
        }
        toast.innerHTML = `<div style="flex:1">${message}</div><button aria-label="dismiss" style="background:transparent;border:0;color:inherit;font-weight:700;cursor:pointer">×</button>`;
        const btn = toast.querySelector('button');
        btn.addEventListener('click', () => {
            toast.remove();
        });
        container.appendChild(toast);
        setTimeout(() => {
            try { toast.remove(); } catch (e) {}
        }, duration);
    }

    // Check authentication (session or persisted)
    const token = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken');
    const email = sessionStorage.getItem('adminEmail') || localStorage.getItem('adminEmail');

    if (!token || !email) {
        window.location.href = 'admin-login.html';
    }

    // Set admin email
    if (adminEmail) {
        adminEmail.textContent = email;
    }

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('adminToken');
            sessionStorage.removeItem('adminEmail');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminEmail');
            window.location.href = 'admin-login.html';
        });
    }

    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // Remove active class from all tabs
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            button.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            
            // Load data
            if (tabName === 'bookings') {
                loadBookings();
            } else if (tabName === 'orders') {
                loadOrders();
            } else if (tabName === 'menu') {
                loadMenu();
            } else if (tabName === 'ratings') {
                loadRatings();
            }
        });
    });

    // Real-time socket listeners (idempotent)
    try {
        if (typeof io !== 'undefined' && !window._adminSocketInitialized) {
            const socket = io();
            socket.on('connect', () => console.log('Admin dashboard connected to server'));
            socket.on('new-order', (order) => { showToast('📦 New order received', 'success'); loadOrders(); });
            socket.on('order-updated', (order) => { showToast('✏️ Order updated', 'info'); loadOrders(); });
            socket.on('order-deleted', (info) => { showToast('🗑️ Order removed', 'warning'); loadOrders(); });
            socket.on('table-updated', (table) => { showToast('🪑 Table updated', 'info'); try { loadBookings(); } catch (e) {} });
            socket.on('new-booking', (booking) => { showToast('🪑 New booking', 'success'); try { loadBookings(); } catch (e) {} });
            socket.on('sync-data', (data) => { try { loadOrders(); } catch (e) {}; try { loadBookings(); } catch (e) {} });
            window._adminSocketInitialized = true;
        }
    } catch (e) { console.warn('Socket setup in admin dashboard failed', e); }

    // Load Bookings
    async function loadBookings() {
        try {
            const response = await fetch('/api/bookings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let bookings = [];
            if (response.ok) {
                bookings = await response.json();
            } else {
                // Fallback to localStorage
                bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
            }

            renderBookings(bookings);
        } catch (error) {
            console.error('Error loading bookings:', error);
            // Try fallback to localStorage bookings before showing error
            const fallback = JSON.parse(localStorage.getItem('bookings') || '[]');
            if (fallback && fallback.length > 0) {
                console.warn('Using localStorage bookings as fallback');
                renderBookings(fallback);
                return;
            }
            bookingsList.innerHTML = '<p class="text-red-600">Error loading bookings.</p>';
        }
    }

    // Render bookings helper (extract rendering logic so it can be reused by fallbacks)
    function renderBookings(bookings) {
        // Display table availability
        displayTableAvailability(bookings);

        if (!bookings || bookings.length === 0) {
            bookingsList.innerHTML = '<p class="text-gray-500">No bookings yet.</p>';
            const tb = document.getElementById('totalBookings'); if(tb) tb.textContent = 0;
            const tg = document.getElementById('totalGuests'); if(tg) tg.textContent = 0;
            return;
        }

        bookingsList.innerHTML = '';
        const allocMapTop = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
        const bookedTables = new Set((Object.keys(allocMapTop) || []).concat((bookings || []).map(b => b.table).filter(t => t)));

        bookings.forEach((booking, idx) => {
            const bookingCard = document.createElement('div');
            bookingCard.className = 'border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-md transition';

            // Generate available tables for dropdown
            const availableTables = [];
            for (let i = 1; i <= 15; i++) {
                const selectedTableForBooking = Object.keys(allocMapTop).find(k => String(allocMapTop[k]) === String(booking.id));
                if ((!bookedTables.has(i.toString()) && !bookedTables.has(i)) || String(selectedTableForBooking) === String(i)) {
                    availableTables.push(i);
                }
            }

                        const selectedTableForBooking = Object.keys(allocMapTop).find(k => String(allocMapTop[k]) === String(booking.id));
                        bookingCard.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-3">
                                            <h3 class="font-bold text-gray-800">Booking #${booking.id}</h3>
                                            ${selectedTableForBooking ? `<span class="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded">Table ${selectedTableForBooking}</span>` : ''}
                    </div>
                    <span class="text-sm text-gray-500">${new Date(booking.date).toLocaleDateString()} ${booking.time || 'N/A'}</span>
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                        <p class="text-gray-600">Name</p>
                        <p class="font-medium text-gray-800">${booking.name || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">Phone</p>
                        <p class="font-medium text-gray-800">${booking.phone || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">Guests</p>
                        <p class="font-medium text-gray-800">${booking.guests || 1}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">Table</p>
                        <select class="table-select font-medium bg-white border border-pink-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pink-500" data-booking-id="${booking.id}" data-index="${idx}">
                            <option value="">Not assigned</option>
                            ${availableTables.map(t => '<option value="' + t + '" ' + ((String(selectedTableForBooking) === String(t)) ? 'selected' : '') + '>' + t + '</option>').join('')}
                        </select>
                    </div>
                </div>
                ${booking.message ? '<div class="mt-3 p-2 bg-white rounded border border-gray-200"><p class="text-sm text-gray-700"><strong>Message:</strong> ' + booking.message + '</p></div>' : ''}
                <div class="flex gap-2 mt-4">
                    <button class="save-table-btn flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium" data-index="${idx}">
                        <i class="fas fa-save mr-1"></i>Save Table
                    </button>
                    <button class="remove-booking-btn flex-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition text-sm font-medium" data-index="${idx}">
                        <i class="fas fa-trash mr-1"></i>Remove
                    </button>
                </div>
            `;
            bookingsList.appendChild(bookingCard);
        });

        // Add event listeners for save and remove
        document.querySelectorAll('.save-table-btn').forEach(btn => {
            btn.addEventListener('click', () => saveTableAssignment(parseInt(btn.dataset.index), bookings));
        });

        document.querySelectorAll('.remove-booking-btn').forEach(btn => {
            btn.addEventListener('click', () => removeBooking(parseInt(btn.dataset.index), bookings));
        });

        // Update stats
        const tb = document.getElementById('totalBookings'); if(tb) tb.textContent = bookings.length;
        const totalGuests = bookings.reduce((sum, b) => sum + (parseInt(b.guests) || 1), 0);
        const tg = document.getElementById('totalGuests'); if(tg) tg.textContent = totalGuests;
    }

    // Record table free/assignment history so manager retains records of freed tables
    function addTableHistory(tableNumber, bookingInfo) {
        try {
            const hist = JSON.parse(localStorage.getItem('table_history') || '[]');
            hist.unshift({
                table: String(tableNumber),
                bookingId: bookingInfo && bookingInfo.id ? bookingInfo.id : (bookingInfo || null),
                name: (bookingInfo && bookingInfo.name) || 'Guest',
                freedAt: Date.now()
            });
            // keep only latest 200 records
            localStorage.setItem('table_history', JSON.stringify(hist.slice(0, 200)));
        } catch (err) { console.warn('Failed to record table history', err); }
    }

    // Display table availability
    function displayTableAvailability(bookings) {
        const tableStatus = document.getElementById('tableStatus');
        if (!tableStatus) return;

        const totalTables = 15; // Total tables in restaurant
        // Use admin_allocations as source-of-truth for currently allocated tables
        const allocMap = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
        const bookedTables = new Set(Object.keys(allocMap).map(k => k));
        // map table number -> booking info for display
        const tableMap = {};
        try {
            const bookingsLocal = bookings || JSON.parse(localStorage.getItem('bookings') || '[]');
            Object.keys(allocMap).forEach(t => {
                const bid = allocMap[t];
                const bk = (bookingsLocal || []).find(b => String(b.id) === String(bid));
                tableMap[t] = bk || { id: bid, name: 'Guest' };
            });
            // fallback: include any bookings that still have table set (older entries)
            (bookingsLocal || []).forEach(b => { if (b && b.table) tableMap[b.table] = tableMap[b.table] || b; if (b && b.table) bookedTables.add(String(b.table)); });
        } catch (err) { console.warn('displayTableAvailability alloc parse error', err); }
        tableStatus.innerHTML = '';
        // add a small Clear All Tables button (always available) near the table grid
        const miniBtnId = 'clearAllTablesMini';
        let miniBtn = document.getElementById(miniBtnId);
        if (!miniBtn) {
            miniBtn = document.createElement('button');
            miniBtn.id = miniBtnId;
            miniBtn.className = 'mb-3 px-2 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200';
            miniBtn.textContent = 'Clear All Tables';
            miniBtn.title = 'Unassign all tables';
            miniBtn.addEventListener('click', () => {
                if (!confirm('Clear all table assignments? This will unassign every table but keep bookings.')) return;
                clearAllTableAssignments(bookings);
            });
            tableStatus.parentNode.insertBefore(miniBtn, tableStatus);
        }

        for (let i = 1; i <= totalTables; i++) {
            const isBooked = bookedTables.has(i.toString()) || bookedTables.has(i);
            const table = document.createElement('div');
            table.className = (`p-3 rounded-lg text-center font-bold text-sm cursor-pointer transition ${
                isBooked 
                ? 'bg-red-100 text-red-700 border-2 border-red-400' 
                : 'bg-green-100 text-green-700 border-2 border-green-400 hover:bg-green-200'
            }`);
            const owner = tableMap[i] ? (tableMap[i].name || 'Guest') : '';
            table.innerHTML = `<div class="flex items-center justify-center"><i class="fas fa-${isBooked ? 'times' : 'check'} mr-1"></i>Table ${i}</div>` + (isBooked && owner ? `<div class="text-xs text-gray-600 mt-1">by ${owner}</div>` : '');
            table.title = isBooked ? `Booked${owner ? ' by ' + owner : ''}` : 'Available';
            table.dataset.table = i;
            if (isBooked) {
                // create a small 'Free' badge to unassign the table
                const freeBadge = document.createElement('button');
                freeBadge.className = 'ml-2 text-xs text-white bg-red-600 px-2 py-1 rounded cursor-pointer';
                freeBadge.style.marginTop = '6px';
                freeBadge.textContent = 'Free';
                freeBadge.title = 'Click to free this table';
                freeBadge.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const booked = tableMap[i];
                    if (!booked) return;
                    if (!confirm(`Free Table ${i} assigned to ${booked.name || 'Guest'}? This will remove the allocation.`)) return;

                    // Best-effort: tell server to free table allocation
                    if (token) {
                        try {
                            await fetch('/api/tables/free', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tableNumber: String(i) })
                            });
                        } catch (err) { console.warn('Failed to free table on server', err); }
                    }

                    // Remove allocation mapping (local) and persist historical assignment on booking
                    try {
                        const alloc = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
                        const bookingId = alloc && alloc[String(i)];
                        if (alloc && alloc[String(i)]) delete alloc[String(i)];
                        localStorage.setItem('admin_allocations', JSON.stringify(alloc));

                        // Do NOT remove table from love_bite_tables - keep as a historical record for manager dashboard
                        try {
                            let globalAlloc = JSON.parse(localStorage.getItem('love_bite_tables') || '[]');
                            if (!globalAlloc.includes(Number(i)) && !globalAlloc.includes(String(i))) {
                                globalAlloc = Array.from(new Set(globalAlloc.concat([Number(i)])));
                                localStorage.setItem('love_bite_tables', JSON.stringify(globalAlloc));
                            }
                        } catch (err) { /* ignore */ }

                        // Persist historical table info to the booking object so manager retains the number
                        try {
                            const bookingsLocal = JSON.parse(localStorage.getItem('bookings') || '[]');
                            const idx = (bookingsLocal || []).findIndex(b => String(b.id) === String(booked.id));
                            if (idx !== -1) {
                                bookingsLocal[idx].lastAssignedTable = String(i);
                                bookingsLocal[idx].tableFreedAt = Date.now();
                                localStorage.setItem('bookings', JSON.stringify(bookingsLocal));
                                localStorage.setItem('admin_bookings', JSON.stringify(bookingsLocal));

                                if (token) {
                                    fetch('/api/bookings/' + bookingsLocal[idx].id, {
                                        method: 'PATCH',
                                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ lastAssignedTable: bookingsLocal[idx].lastAssignedTable, tableFreedAt: bookingsLocal[idx].tableFreedAt })
                                    }).catch(() => {});
                                }

                                // Record into table history for manager records
                                try { addTableHistory(i, bookingsLocal[idx]); } catch (err) {}
                            } else {
                                // If booking not found locally, still record minimal history
                                try { addTableHistory(i, booked); } catch (err) {}
                            }
                        } catch (err) { console.warn('Failed to persist historical table on booking', err); }
                    } catch (err) { console.warn('Failed to remove allocation', err); }

                    showToast('Allocation for table ' + i + ' removed.', 'success');
                    try { renderAllocatedFromStorage(); } catch (e) {}
                    try { displayTableAvailability(bookings); } catch (e) {}
                });
                // append free badge under owner label
                const ownerNode = table.querySelector('.text-xs');
                if (ownerNode) ownerNode.appendChild(freeBadge);
            }
            tableStatus.appendChild(table);
        }

        // If all tables booked, show a temporary toast notice (auto-dismiss) instead of a persistent banner
        const bookedCount = Array.from(bookedTables).length;
        if (bookedCount >= totalTables) {
            showToast(`All ${totalTables} tables are currently assigned. Use 'Clear All Tables' to unassign.`, 'warning', 6000);
        }
    }

    // Compact assigned table numbers so they are sequential (1..k) when some tables freed
    async function compactTableAssignments(bookings) {
        // Compact admin_allocations table numbers to be sequential (1..k) while keeping stable ordering
        try {
            const alloc = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
            const bookingsLocal = bookings || JSON.parse(localStorage.getItem('bookings') || '[]');

            // Build array of {table, booking, time}
            const arr = Object.keys(alloc).map(t => {
                const bid = alloc[t];
                const bk = (bookingsLocal || []).find(b => String(b.id) === String(bid)) || { id: bid };
                const time = Date.parse(bk.bookedAt || bk.createdAt || bk.created || bk.bookingDate || Date.now()) || Date.now();
                return { oldTable: Number(t), booking: bk, time };
            });

            arr.sort((a, b) => a.time - b.time || a.oldTable - b.oldTable);

            const newAlloc = {};
            const oldToNew = {};
            for (let i = 0; i < arr.length; i++) {
                const newNum = i + 1;
                newAlloc[String(newNum)] = arr[i].booking.id;
                oldToNew[arr[i].oldTable] = newNum;
            }

            // Save new mapping
            localStorage.setItem('admin_allocations', JSON.stringify(newAlloc));
            localStorage.setItem('love_bite_tables', JSON.stringify(Object.keys(newAlloc).map(n => Number(n))));

            // Update orders' tableNumber mapping according to oldToNew
            try {
                const orders = JSON.parse(localStorage.getItem('orders') || '[]');
                let changed = false;
                orders.forEach(o => {
                    if (!o) return;
                    const num = o.tableNumber ? (isNaN(Number(o.tableNumber)) ? o.tableNumber : Number(o.tableNumber)) : null;
                    if (num == null || num === '') return;
                    if (oldToNew[num]) {
                        o.tableNumber = String(oldToNew[num]);
                        changed = true;
                    } else if (!Object.keys(newAlloc).includes(String(num))) {
                        o.tableNumber = '';
                        changed = true;
                    }
                });
                if (changed) { localStorage.setItem('orders', JSON.stringify(orders)); try { loadOrders(); } catch (e) {} }
            } catch (err) { console.warn('Failed to update orders after compaction', err); }

            showToast('Allocations compacted.', 'success');
            try { renderAllocatedFromStorage(); } catch (e) {}
            try { displayTableAvailability(bookings); } catch (e) {}
        } catch (err) { console.warn('compactTableAssignments failed', err); }
    }

    // Clear all table assignments (unassign table field for all bookings)
    async function clearAllTableAssignments(bookings) {
        // Clear all admin allocations (local only) but preserve table records/history
        try {
            // Move current allocations into history, then clear allocations mapping (but keep table list as records)
            const alloc = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
            const bookingsLocal = JSON.parse(localStorage.getItem('bookings') || '[]');
            Object.keys(alloc).forEach(t => {
                const bid = alloc[t];
                const idx = (bookingsLocal || []).findIndex(b => String(b.id) === String(bid));
                if (idx !== -1) {
                    bookingsLocal[idx].lastAssignedTable = String(t);
                    bookingsLocal[idx].tableFreedAt = Date.now();
                    try { addTableHistory(t, bookingsLocal[idx]); } catch (err) {}
                } else {
                    try { addTableHistory(t, { id: bid, name: 'Guest' }); } catch (err) {}
                }
            });
            localStorage.setItem('bookings', JSON.stringify(bookingsLocal));
            localStorage.setItem('admin_bookings', JSON.stringify(bookingsLocal));
            localStorage.setItem('admin_allocations', JSON.stringify({}));
            // keep love_bite_tables intact as historical record
        } catch (err) { console.warn('Failed to clear allocations', err); }

        // Also clear any tableNumber in orders for local cleanliness
        try {
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            let ochanged = false;
            orders.forEach(o => {
                if (o && o.tableNumber) { o.tableNumber = ''; ochanged = true; }
            });
            if (ochanged) {
                localStorage.setItem('orders', JSON.stringify(orders));
                try { loadOrders(); } catch (e) {}
            }
        } catch (err) { console.warn('Failed to clear orders tableNumber', err); }

        showToast('All local table allocations cleared.', 'success');
        try { renderAllocatedFromStorage(); } catch (e) {}
        try { displayTableAvailability(bookings); } catch (e) {}
    }

    // Clear allocation-related data from localStorage (local-only)
    function clearLocalAllocations() {
        try { localStorage.removeItem('admin_allocations'); } catch (e) { /* ignore */ }
        try { localStorage.removeItem('love_bite_tables'); } catch (e) { /* ignore */ }

        // Also clear tableNumber from orders / admin_orders for cleanliness
        ['orders', 'admin_orders'].forEach(key => {
            try {
                const arr = JSON.parse(localStorage.getItem(key) || '[]');
                let changed = false;
                (arr || []).forEach(o => {
                    if (!o) return;
                    if (o.tableNumber) { o.tableNumber = ''; changed = true; }
                });
                if (changed) localStorage.setItem(key, JSON.stringify(arr));
            } catch (err) { /* ignore */ }
        });

        showToast('Local allocation data cleared.', 'success');
        try { renderAllocatedFromStorage(); } catch (e) {}
        try { displayTableAvailability(JSON.parse(localStorage.getItem('bookings') || '[]')); } catch (e) {}
    }

    // Expose to console for quick use
    window.clearLocalAllocations = clearLocalAllocations;

    // Wire Clear All Allocations button to local clear action (confirmation first)
    const clearAllocatedBtn = document.getElementById('clearAllocatedBtn');
    if (clearAllocatedBtn) clearAllocatedBtn.addEventListener('click', async () => {
        if (!confirm('Clear all table allocations from localStorage and server? This will unassign tables locally and attempt to clear allocations on the server.')) return;
        // Clear locally
        clearLocalAllocations();
        // Best-effort: clear on server as well
        if (token) {
            try {
                await fetch('/api/allocations/clear', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            } catch (err) { console.warn('Failed to clear allocations on server', err); }
        }
    });

    // Save table assignment
    async function saveTableAssignment(index, bookings) {
        const booking = bookings[index];
        if (!booking) return;

        const select = document.querySelector(`.table-select[data-index="${index}"]`);
        const newTable = select ? select.value : '';

        if (!newTable) {
            showToast('Please select a table', 'warning');
            return;
        }

        // DO NOT write table into booking record. Instead update allocation mapping.
        try {
            // allocations: map tableNumber -> bookingId
            const alloc = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
            // remove any previous table for this booking
            Object.keys(alloc).forEach(t => { if (String(alloc[t]) === String(booking.id)) delete alloc[t]; });
            alloc[String(newTable)] = booking.id;
            localStorage.setItem('admin_allocations', JSON.stringify(alloc));

            // maintain a simple love_bite_tables set for quick checks
            const setArr = Array.from(new Set((JSON.parse(localStorage.getItem('love_bite_tables') || '[]')).concat([Number(newTable)])));
            localStorage.setItem('love_bite_tables', JSON.stringify(setArr));

            // Also persist a historical assignment on the booking object (lastAssignedTable)
            try {
                booking.lastAssignedTable = String(newTable);
                booking.tableAssignedAt = Date.now();
                // Save bookings array back to storage so manager can display historical assignment
                localStorage.setItem('bookings', JSON.stringify(bookings));
                localStorage.setItem('admin_bookings', JSON.stringify(bookings));

                // Try to persist to server (best-effort)
                if (token) {
                    // Reserve table on the server as well
                    try {
                        await fetch('/api/tables/reserve', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tableNumber: String(newTable), bookingId: booking.id })
                        });
                    } catch (err) { console.warn('Failed to reserve table on server', err); }

                    // Also update booking record with historical assignment
                    try {
                        await fetch('/api/bookings/' + booking.id, {
                            method: 'PATCH',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lastAssignedTable: booking.lastAssignedTable, tableAssignedAt: booking.tableAssignedAt })
                        });
                    } catch (err) { /* ignore */ }
                }
            } catch (err) { console.warn('Failed to record lastAssignedTable on booking', err); }
        } catch (err) { console.warn('Failed to persist allocation locally', err); }

        showToast('Table ' + newTable + ' allocated to ' + (booking.name || '') + ' (saved in allocations).', 'success');
        try { loadBookings(); } catch (e) {}
        try { renderAllocatedFromStorage(); } catch (e) {}
    }

    // Remove booking
    function removeBooking(index, bookings) {
        const booking = bookings[index];
        if (!booking) return;

        if (!confirm('Remove booking for ' + (booking.name || '') + '?')) {
            return;
        }

        // Remove from array
        bookings.splice(index, 1);

        // Save to localStorage
        localStorage.setItem('bookings', JSON.stringify(bookings));

        // Try to delete on server
        fetch('/api/bookings/' + booking.id, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).catch(() => {});

        showToast('Booking for ' + (booking.name || '') + ' removed successfully!', 'success');
        loadBookings(); // Reload bookings
    }

    // Load Orders
    async function loadOrders() {
        try {
            const response = await fetch('/api/orders', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let orders = [];
            if (response.ok) {
                orders = await response.json();
            } else {
                // Fallback to localStorage
                orders = JSON.parse(localStorage.getItem('orders') || '[]');
            }

            if (orders.length === 0) {
                ordersList.innerHTML = '<p class="text-gray-500">No orders yet.</p>';
                return;
            }

            ordersList.innerHTML = '';
            let totalRevenue = 0;

            orders.forEach((order, idx) => {
                totalRevenue += order.total || 0;
                const orderCard = document.createElement('div');
                orderCard.className = 'border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-md transition';
                orderCard.innerHTML = `
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="font-bold text-gray-800">Order #${order.id || idx + 1}</h3>
                        <span class="text-sm text-gray-500">${new Date(order.date).toLocaleDateString()}</span>
                    </div>
                    <div class="mb-3">
                        <p class="text-sm text-gray-600">Items</p>
                        <ul class="text-sm">
                            ${(order.items || []).map(item => '<li class="text-gray-700">• ' + item.name + ' x' + item.quantity + '</li>').join('')}
                        </ul>
                    </div>
                    <div class="flex justify-between items-center pt-3 border-t border-gray-200">
                        <p class="text-gray-600">Total</p>
                        <p class="font-bold text-pink-600 text-lg">₹${order.total ? order.total.toFixed(2) : '0.00'}</p>
                    </div>
                    ${order.phoneNumber ? '<p class="text-xs text-gray-500 mt-2"><i class="fas fa-phone mr-1"></i>' + order.phoneNumber + '</p>' : ''}
                `;
                ordersList.appendChild(orderCard);
            });

            // Update stats
            const to = document.getElementById('totalOrders'); if(to) to.textContent = orders.length;
            const tr = document.getElementById('totalRevenue'); if(tr) tr.textContent = '₹' + totalRevenue.toFixed(2);
        } catch (error) {
            console.error('Error loading orders:', error);
            ordersList.innerHTML = '<p class="text-red-600">Error loading orders.</p>';
        }
    }

    // Load Menu
    async function loadMenu() {
        try {
            const response = await fetch('/api/menu', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let menuItems = [];
            if (response.ok) {
                menuItems = await response.json();
            } else {
                // Fallback to localStorage
                menuItems = JSON.parse(localStorage.getItem('menu') || '[]');
            }

            if (menuItems.length === 0) {
                menuList.innerHTML = '<p class="text-gray-500">No menu items.</p>';
                return;
            }

            menuList.innerHTML = '';
            menuItems.forEach(item => {
                const menuCard = document.createElement('div');
                menuCard.className = 'border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-md transition';
                menuCard.innerHTML = `
                    <div class="flex gap-4">
                        ${item.image ? '<img src="' + item.image + '" alt="' + item.name + '" class="w-24 h-24 object-cover rounded">' : ''}
                        <div class="flex-1">
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="font-bold text-gray-800">${item.name}</h3>
                                <span class="text-lg font-bold text-pink-600">₹${item.price.toFixed(2)}</span>
                            </div>
                            <p class="text-sm text-gray-600 mb-2">${item.category}</p>
                            <p class="text-sm text-gray-700">${item.description || 'No description'}</p>
                        </div>
                    </div>
                `;
                menuList.appendChild(menuCard);
            });
        } catch (error) {
            console.error('Error loading menu:', error);
            menuList.innerHTML = '<p class="text-red-600">Error loading menu.</p>';
        }
    }

    // Initial load - bookings tab
    loadBookings();

    // Render Allocated tab from local allocations storage
    function renderAllocatedFromStorage() {
        const allocatedList = document.getElementById('allocatedList');
        const search = document.getElementById('allocatedSearch');
        const sort = document.getElementById('allocatedSort');
        const selectAll = document.getElementById('selectAllAllocated');
        const bulkFree = document.getElementById('bulkFreeBtn');

        if (!allocatedList) return;

        const alloc = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
        const bookings = JSON.parse(localStorage.getItem('bookings') || '[]');

        const rows = Object.keys(alloc).map(table => {
            const bid = alloc[table];
            const booking = (bookings || []).find(b => String(b.id) === String(bid)) || { id: bid, name: 'Guest', phone: '' };
            return { table: Number(table), booking };
        });

        // Append recent history of freed tables (skip if currently allocated)
        try {
            const history = JSON.parse(localStorage.getItem('table_history') || '[]');
            (history || []).forEach(h => {
                const tableNum = Number(h.table);
                if (rows.some(r => r.table === tableNum)) return; // prefer active allocation
                const booking = (bookings || []).find(b => String(b.id) === String(h.bookingId)) || { id: h.bookingId, name: h.name || 'Guest', phone: '' };
                rows.push({ table: tableNum, booking, freedAt: h.freedAt, freed: true });
            });
        } catch (err) { /* ignore */ }

        // optionally apply search filter
        const q = (search && search.value || '').trim().toLowerCase();
        let filtered = rows.filter(r => {
            if (!q) return true;
            return String(r.table).includes(q) || (r.booking.name || '').toLowerCase().includes(q) || (r.booking.phone || '').includes(q) || String(r.booking.id).includes(q);
        });

        // sort
        const mode = (sort && sort.value) || 'table';
        filtered.sort((a, b) => {
            if (mode === 'name') return (a.booking.name || '').localeCompare(b.booking.name || '');
            return a.table - b.table;
        });

        if (filtered.length === 0) {
            allocatedList.innerHTML = '<p class="text-gray-500">No allocations yet.</p>';
            if (bulkFree) bulkFree.disabled = true;
            return;
        }

        allocatedList.innerHTML = '';
        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = 'border rounded p-3 bg-white flex items-start gap-3';
            card.innerHTML = `
                <div class="w-6">${item.freed ? '' : `<input type=\"checkbox\" class=\"alloc-checkbox\" data-table=\"${item.table}\">`}</div>
                <div class="flex-1">
                    <div class="flex justify-between items-center">
                        <div><strong>Table ${item.table}</strong> — ${item.booking.name || 'Guest'}</div>
                        <div class="text-sm text-gray-500">ID: ${item.booking.id}</div>
                    </div>
                    <div class="text-sm text-gray-600">${item.booking.phone || ''}</div>
                </div>
                <div>
                    ${item.freed ? `<div class=\"text-xs text-gray-500\">Freed ${item.freedAt ? new Date(item.freedAt).toLocaleString() : ''}</div>` : `<button class=\"free-alloc-btn bg-red-600 text-white px-2 py-1 rounded text-sm\" data-table=\"${item.table}\">Free</button>`}
                </div>
            `;
            allocatedList.appendChild(card);
        });

        // wire controls
        document.querySelectorAll('.free-alloc-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const t = btn.dataset.table;
                if (!confirm('Free allocation for table ' + t + '?')) return;

                // Best-effort: tell server to free table allocation
                if (token) {
                    try {
                        await fetch('/api/tables/free', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tableNumber: String(t) })
                        });
                    } catch (err) { console.warn('Failed to free table on server', err); }
                }

                try {
                    const alloc = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
                    const bookingId = alloc && alloc[String(t)];
                    // persist historical info on booking
                    try {
                        const bookingsLocal = JSON.parse(localStorage.getItem('bookings') || '[]');
                        const idx = (bookingsLocal || []).findIndex(b => String(b.id) === String(bookingId));
                        if (idx !== -1) {
                            bookingsLocal[idx].lastAssignedTable = String(t);
                            bookingsLocal[idx].tableFreedAt = Date.now();
                            localStorage.setItem('bookings', JSON.stringify(bookingsLocal));
                            localStorage.setItem('admin_bookings', JSON.stringify(bookingsLocal));
                            if (token) {
                                fetch('/api/bookings/' + bookingsLocal[idx].id, {
                                    method: 'PATCH',
                                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ lastAssignedTable: bookingsLocal[idx].lastAssignedTable, tableFreedAt: bookingsLocal[idx].tableFreedAt })
                                }).catch(() => {});
                            }
                            // Add to history
                            try { addTableHistory(t, bookingsLocal[idx]); } catch (err) {}
                        } else {
                            try { addTableHistory(t, { id: bookingId, name: 'Guest' }); } catch (err) {}
                        }
                    } catch (err) { console.warn('Failed to persist historical table on booking', err); }

                    if (alloc && alloc[String(t)]) delete alloc[String(t)];
                    localStorage.setItem('admin_allocations', JSON.stringify(alloc));

                    // Keep table number in love_bite_tables as a record (do not remove)
                } catch (err) { console.warn(err); }
                renderAllocatedFromStorage();
            });
        });

        const checkboxes = document.querySelectorAll('.alloc-checkbox');
        checkboxes.forEach(cb => cb.addEventListener('change', () => {
            const any = Array.from(document.querySelectorAll('.alloc-checkbox')).some(x => x.checked);
            if (bulkFree) bulkFree.disabled = !any;
        }));

        if (selectAll) {
            selectAll.checked = false;
            selectAll.onchange = () => {
                const checked = selectAll.checked;
                document.querySelectorAll('.alloc-checkbox').forEach(x => x.checked = checked);
                if (bulkFree) bulkFree.disabled = !checked;
            };
        }

        if (bulkFree) {
            bulkFree.disabled = true;
            bulkFree.onclick = () => {
                const checked = Array.from(document.querySelectorAll('.alloc-checkbox')).filter(x => x.checked).map(x => x.dataset.table);
                if (checked.length === 0) return;
                if (!confirm('Free ' + checked.length + ' selected allocations?')) return;
                try {
                    const alloc = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
                    const bookingsLocal = JSON.parse(localStorage.getItem('bookings') || '[]');
                    checked.forEach(t => {
                        const bookingId = alloc && alloc[String(t)];
                        if (bookingId) {
                            const idx = (bookingsLocal || []).findIndex(b => String(b.id) === String(bookingId));
                            if (idx !== -1) {
                                bookingsLocal[idx].lastAssignedTable = String(t);
                                bookingsLocal[idx].tableFreedAt = Date.now();
                                try { addTableHistory(t, bookingsLocal[idx]); } catch (err) {}
                            } else {
                                try { addTableHistory(t, { id: bookingId, name: 'Guest' }); } catch (err) {}
                            }
                        }
                        if (alloc && alloc[String(t)]) delete alloc[String(t)];
                    });
                    localStorage.setItem('admin_allocations', JSON.stringify(alloc));
                    // Keep table numbers in love_bite_tables as historical records (do not remove)
                    localStorage.setItem('bookings', JSON.stringify(bookingsLocal));
                    localStorage.setItem('admin_bookings', JSON.stringify(bookingsLocal));
                } catch (err) { console.warn(err); }
                renderAllocatedFromStorage();
            };
        }

        const exportBtn = document.getElementById('exportAllocatedBtn');
        if (exportBtn) {
            exportBtn.onclick = () => {
                const alloc = JSON.parse(localStorage.getItem('admin_allocations') || '{}');
                const rows = Object.keys(alloc).map(t => ({ table: t, bookingId: alloc[t] }));
                const csv = ['Table,BookingId'].concat(rows.map(r => `${r.table},${r.bookingId}`)).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'allocations.csv'; a.click();
                URL.revokeObjectURL(url);
            };
        }
    }

    // ensure allocated tab renders when opened
    const allocatedTabBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('data-tab') === 'allocated');
    if (allocatedTabBtn) allocatedTabBtn.addEventListener('click', () => setTimeout(renderAllocatedFromStorage, 50));

    // Initial render for allocations (if tab visible)
    try { renderAllocatedFromStorage(); } catch (e) {}

    // Listen for localStorage changes so dashboard updates when bookings/allocations/history are modified
    window.addEventListener('storage', (e) => {
        if (!e.key) return;
        try {
            if (e.key === 'bookings') {
                const newBookings = JSON.parse(e.newValue || '[]');
                renderBookings(newBookings);
            } else if (e.key === 'admin_allocations' || e.key === 'love_bite_tables' || e.key === 'table_history' || e.key === 'admin_bookings') {
                try { renderAllocatedFromStorage(); } catch (err) {}
                try { displayTableAvailability(JSON.parse(localStorage.getItem('bookings') || '[]')); } catch (err) {}
            }
        } catch (err) {
            console.warn('Failed to handle storage event', err);
        }
    });

    // Add Menu Item Handler
    const addItemBtn = document.getElementById('addItemBtn');
    const itemName = document.getElementById('itemName');
    const itemPrice = document.getElementById('itemPrice');
    const itemCategory = document.getElementById('itemCategory');
    const itemDesc = document.getElementById('itemDesc');

    if (addItemBtn) {
        addItemBtn.addEventListener('click', async () => {
            const name = itemName.value.trim();
            const price = parseFloat(itemPrice.value);
            const category = itemCategory.value;
            const description = itemDesc.value.trim();

            if (!name || !price || !category) {
                showToast('Please fill in all required fields', 'warning');
                return;
            }

            const newItem = {
                id: Date.now(),
                name,
                price,
                category,
                description,
                image: null
            };

            try {
                // Try to post to server
                const response = await fetch('/api/admin/menu', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newItem)
                });

                if (!response.ok) throw new Error('Server error');
            } catch (error) {
                console.log('Server unavailable, using localStorage');
            }

            // Always save to localStorage
            const menu = JSON.parse(localStorage.getItem('menu') || '[]');
            menu.push(newItem);
            localStorage.setItem('menu', JSON.stringify(menu));

            // Clear form
            itemName.value = '';
            itemPrice.value = '';
            itemCategory.value = '';
            itemDesc.value = '';

            showToast('Menu item added successfully!', 'success');
            loadMenu();
        });
    }

    // Rating Management
    const ratingModal = document.getElementById('ratingModal');
    const ratingModalTitle = document.getElementById('ratingModalTitle');
    const ratingSlider = document.getElementById('ratingSlider');
    const ratingValue = document.getElementById('ratingValue');
    const saveRatingBtn = document.getElementById('saveRatingBtn');
    const closeRatingModalBtn = document.getElementById('closeRatingModalBtn');
    const ratingsList = document.getElementById('ratingsList');

    let currentEditingDishId = null;



    function loadRatings() {
        const menu = JSON.parse(localStorage.getItem('menu') || '[]');
        const dishRatings = JSON.parse(localStorage.getItem('dishRatings') || '{}');

        if (!menu || menu.length === 0) {
            ratingsList.innerHTML = '<p class="text-gray-500">No menu items available.</p>';
            return;
        }

        ratingsList.innerHTML = '';
        
        menu.forEach(dish => {
            const currentRating = dishRatings[dish.id] || 4.5;
            const stars = renderStars(currentRating);
            
            const ratingCard = document.createElement('div');
            ratingCard.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center justify-between';
            ratingCard.innerHTML = `
                <div>
                    <p class="font-semibold text-gray-800">${dish.name}</p>
                    <p class="text-sm text-gray-600">${dish.category}</p>
                    <p class="text-lg text-yellow-400 font-bold">${currentRating.toFixed(1)}</p>
                </div>
                <button class="edit-rating-btn bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition" data-dish-id="${dish.id}" data-dish-name="${dish.name}">
                    <i class="fas fa-edit mr-2"></i>Edit
                </button>
            `;
            ratingsList.appendChild(ratingCard);
        });

        // Attach edit button listeners
        document.querySelectorAll('.edit-rating-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                currentEditingDishId = parseInt(this.getAttribute('data-dish-id'));
                const dishName = this.getAttribute('data-dish-name');
                const dishRatings = JSON.parse(localStorage.getItem('dishRatings') || '{}');
                const currentRating = dishRatings[currentEditingDishId] || 4.5;
                
                ratingModalTitle.textContent = `Edit Rating - ${dishName}`;
                ratingSlider.value = currentRating;
                updateRatingDisplay();
                ratingModal.classList.remove('hidden');
            });
        });
    }

    function updateRatingDisplay() {
        const rating = parseFloat(ratingSlider.value);
        if (ratingValue) ratingValue.textContent = rating.toFixed(1);
    }

    ratingSlider.addEventListener('input', updateRatingDisplay);

    saveRatingBtn.addEventListener('click', () => {
        if (currentEditingDishId === null) return;

        const newRating = parseFloat(ratingSlider.value);
        const dishRatings = JSON.parse(localStorage.getItem('dishRatings') || '{}');
        dishRatings[currentEditingDishId] = newRating;
        localStorage.setItem('dishRatings', JSON.stringify(dishRatings));

        showToast('Rating updated successfully!', 'success');
        ratingModal.classList.add('hidden');
        loadRatings();
    });

    closeRatingModalBtn.addEventListener('click', () => {
        ratingModal.classList.add('hidden');
    });

    ratingModal.addEventListener('click', (e) => {
        if (e.target === ratingModal) {
            ratingModal.classList.add('hidden');
        }
    });
})();
