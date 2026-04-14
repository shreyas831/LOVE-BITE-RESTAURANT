// Lightweight admin order viewer for the multi-device demo
async function loadAdminOrdersSimple() {
  try {
    const res = await fetch('/admin/orders');
    const data = await res.json();
    const div = document.getElementById('orders');
    div.innerHTML = '';
    if (!data || !data.length) {
      div.innerHTML = '<p>No orders yet.</p>';
      return;
    }

    data.forEach(o => {
      const p = document.createElement('p');
      p.innerHTML = `Table ${o.tableNumber || 'N/A'} | Total: ₹${Number(o.totalAmount || o.total || 0)}`;
      div.appendChild(p);
    });
  } catch (err) {
    console.error('Failed to load admin orders', err);
    document.getElementById('orders').innerHTML = '<p>Error loading orders</p>';
  }
}

loadAdminOrdersSimple();
setInterval(loadAdminOrdersSimple, 5000);
