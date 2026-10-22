(() => {
  'use strict';
  const root = document.getElementById('store-root');
  if (!root) return;
  const slug = root.dataset.slug;
  const deliveryFee = Number(root.dataset.deliveryFee || 0);
  const storageKey = `shqipshop:cart:${slug}`;
  const overlay = document.getElementById('cart-overlay');
  const closeButton = document.getElementById('close-cart');
  const openButton = document.getElementById('open-cart');
  const cartEl = document.getElementById('cart-items');
  const cartCount = document.getElementById('cart-count');
  const statusEl = document.getElementById('checkout-status');
  const checkoutForm = document.getElementById('checkout-form');
  const submitButton = document.getElementById('checkout-submit');
  const format = n => new Intl.NumberFormat('sq-AL').format(n) + ' Lekë';
  const products = new Map(Array.from(document.querySelectorAll('[data-product-id]')).map(btn => [Number(btn.dataset.productId), {
    id: Number(btn.dataset.productId), name: btn.dataset.productName,
    price: Number(btn.dataset.productPrice), stock: Number(btn.dataset.productStock)
  }]));
  const allowedCart = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter(x => Number.isInteger(x.id) && Number.isInteger(x.quantity) && x.quantity > 0 && products.has(x.id) && products.get(x.id).stock > 0)
        .map(x => ({id: x.id, quantity: Math.min(x.quantity, products.get(x.id).stock, 100)}));
    } catch (_) { return []; }
  };
  let cart = allowedCart();
  let idempotencyKey = null;
  let lastFocus = null;
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(cart)); } catch (_) {} idempotencyKey = null; render(); };
  const change = (id, delta) => {
    const p = products.get(id); if (!p) return;
    const existing = cart.find(x => x.id === id);
    const next = Math.max(0, Math.min(p.stock, 100, (existing?.quantity || 0) + delta));
    cart = cart.filter(x => x.id !== id);
    if (next) cart.push({id, quantity: next});
    save();
  };
  const render = () => {
    cartCount.textContent = cart.reduce((a,x) => a + x.quantity, 0);
    cartEl.replaceChildren();
    if (!cart.length) {
      const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Shporta është bosh. Zgjidh një produkt për të filluar.';
      cartEl.append(empty);
    }
    for (const item of cart) {
      const p=products.get(item.id);
      const row=document.createElement('div'); row.className='cart-line';
      const details=document.createElement('div');
      const title=document.createElement('strong');title.textContent=p.name;
      const price=document.createElement('small');price.textContent=format(p.price*item.quantity);
      details.append(title,price);
      const actions=document.createElement('div');actions.className='quantity-controls';
      const minus=document.createElement('button');minus.textContent='−';minus.type='button';minus.setAttribute('aria-label','Hiq një '+p.name); minus.addEventListener('click',()=>change(item.id,-1));
      const value=document.createElement('span');value.textContent=item.quantity;
      const plus=document.createElement('button');plus.textContent='+';plus.type='button';plus.setAttribute('aria-label','Shto një '+p.name);plus.addEventListener('click',()=>change(item.id,1));
      actions.append(minus,value,plus);row.append(details,actions);cartEl.append(row);
    }
    const subtotal=cart.reduce((sum,x)=>sum+products.get(x.id).price*x.quantity,0);
    document.getElementById('subtotal').textContent=format(subtotal);
    document.getElementById('delivery').textContent=format(deliveryFee);
    document.getElementById('total').textContent=format(subtotal+deliveryFee);
    submitButton.disabled=!cart.length;
    checkoutForm.classList.toggle('hidden',!cart.length);
  };
  const open = () => { lastFocus=document.activeElement;overlay.classList.remove('hidden');document.body.classList.add('scroll-locked');closeButton.focus(); };
  const close = () => { overlay.classList.add('hidden');document.body.classList.remove('scroll-locked');lastFocus?.focus(); };
  openButton.addEventListener('click',open);
  closeButton.addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  overlay.addEventListener('keydown',e=>{
    if(e.key==='Escape'){close();return;}
    if(e.key!=='Tab')return;
    const focusable=Array.from(overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href]')).filter(el=>!el.closest('.hidden'));
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
  });
  document.querySelectorAll('[data-product-id]').forEach(btn=>btn.addEventListener('click',()=>{change(Number(btn.dataset.productId),1);open();}));
  const query=document.getElementById('product-search');const category=document.getElementById('category-filter');
  const filter=()=>{
    let n=0;
    document.querySelectorAll('.product-card').forEach(card=>{const show=card.dataset.name.includes(query.value.toLocaleLowerCase('sq-AL').trim()) && (!category.value||card.dataset.category===category.value);card.classList.toggle('hidden',!show);if(show)n++;});
    document.getElementById('search-empty').classList.toggle('hidden',n>0||document.querySelectorAll('.product-card').length===0);
  };
  query.addEventListener('input',filter);category.addEventListener('change',filter);
  checkoutForm.addEventListener('submit',async e=>{
    e.preventDefault();if(!cart.length)return;
    const form=new FormData(checkoutForm);
    if(!idempotencyKey)idempotencyKey=crypto.randomUUID().replaceAll('-','');
    const payload={idempotency_key:idempotencyKey,customer_name:form.get('customer_name'),customer_phone:form.get('customer_phone'),city:form.get('city'),address:form.get('address'),note:form.get('note')||'',accept_privacy:form.get('accept_privacy')==='on',items:cart.map(x=>({product_id:x.id,quantity:x.quantity}))};
    submitButton.disabled=true; statusEl.textContent='Po dërgojmë porosinë...'; statusEl.className='checkout-notice';
    try {
      const r=await fetch(`/api/stores/${encodeURIComponent(slug)}/orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
      const data=await r.json();
      if(!r.ok)throw new Error(data.detail||'Gabim gjatë porosisë');
      statusEl.textContent=`Porosia #${data.order_id} u regjistrua! ${data.replayed?'U konfirmua marrja e mëparshme.':'Dyqani do të të kontaktojë.'}`;
      statusEl.classList.add('success-message');
      if(data.tracking_token){const link=document.createElement('a');link.href=`/api/stores/${encodeURIComponent(slug)}/track/${encodeURIComponent(data.tracking_token)}`;link.textContent='Shiko statusin e porosisë';link.target='_blank';statusEl.append(document.createElement('br'),link);}
      // Preserve success until the user dismisses the drawer.
      cart=[];try{localStorage.removeItem(storageKey)}catch(_){}
      render();checkoutForm.reset();idempotencyKey=null;
    } catch(err){statusEl.textContent=err.message||'Gabim. Provo përsëri.';statusEl.classList.add('error-message');submitButton.disabled=false;}
  });
  render();
  if('serviceWorker' in navigator){navigator.serviceWorker.register(`/s/${encodeURIComponent(slug)}/service-worker.js`,{scope:`/s/${encodeURIComponent(slug)}/`}).catch(()=>{});}
})();
