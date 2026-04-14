// Simple admin UI to add/list/delete menu items via /api/menu
(async function(){
  const form = document.getElementById('addItem');
  const list = document.getElementById('items');

  async function fetchItems(){
    try{
      const res = await fetch('/api/menu');
      if(!res.ok) throw new Error('no api');
      const data = await res.json();
      return data;
    }catch(e){
      // fallback to localStorage
      return JSON.parse(localStorage.getItem('menu')||'[]');
    }
  }

  function render(items){
    list.innerHTML = '';
    items.forEach(item=>{
      const el = document.createElement('div');
      el.className = 'menu-card p-4';
      el.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-bold">${item.name} — ₹${item.price}</h3>
            <p class="text-sm text-gray-500">${item.category}</p>
            <p class="text-sm">${item.description||''}</p>
          </div>
          <div class="space-y-2">
            <button data-id="${item.id}" class="btn-primary edit">Edit</button>
            <button data-id="${item.id}" class="btn-primary" style="background:#ef4444">Delete</button>
          </div>
        </div>`;
      list.appendChild(el);
    });
  }

  async function refresh(){
    const items = await fetchItems();
    render(items);
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form).entries());
    body.price = Number(body.price)||0;
    body.id = Date.now();
    try{
      const res = await fetch('/api/admin/menu', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'add', item: body})});
      if(res.ok){ form.reset(); refresh(); return; }
    }catch(e){ }

    const existing = JSON.parse(localStorage.getItem('menu')||'[]');
    existing.push(body);
    localStorage.setItem('menu', JSON.stringify(existing));
    form.reset(); refresh();
  });

  // initial load
  refresh();
})();
