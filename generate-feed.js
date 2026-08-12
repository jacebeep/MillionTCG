const fs = require('fs');
const CLOUD_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhoUyU3cfpYh-66NG3aerW_YhLDnQ1Quv22DupQwjLQ-5WD5XOpcR7KoJ2KZ09cQ4O/exec';

function esc(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

function buildProductUrl(id) {
  return `https://milliontcg.com/product.html?id=${encodeURIComponent(id)}`;
}

async function run() {
  let listings = [];
  try {
    const res = await fetch(`${CLOUD_SCRIPT_URL}?action=getListings`);
    if (res.ok) {
      const json = await res.json();
      listings = Array.isArray(json) ? json : (Array.isArray(json.listings) ? json.listings : []);
    }
  } catch (err) {
    console.error('Error fetching listings:', err);
  }

  const productItems = listings.map(p => {
    const url  = esc(buildProductUrl(p.id));
    const title = esc(p.title || p.name || 'Trading Card');
    const desc = esc(p.desc || `${p.condition || 'Raw'} Single Card - ${p.category || 'Trading Card'}`);
    let rawImg = (p.gallery && p.gallery[0]) || p.image || 'https://milliontcg.com/images/logo.png';
    if (!rawImg.startsWith('http')) {
      rawImg = 'https://milliontcg.com/' + rawImg.replace(/^\//, '');
    }
    // Trick Google Merchant Center into accepting Google Drive thumbnail URLs
    if (rawImg.includes('drive.google.com')) {
      rawImg = rawImg.replace('thumbnail?id=', 'uc?export=download&id=') + '&ext=.jpg';
    }
    const img = esc(rawImg);
    const price = parseFloat(p.price || 0).toFixed(2);
    const condition = (p.condition || '').toLowerCase().includes('raw') ? 'used' : 'new';
    
    return `
    <item>
      <g:id>${esc(p.id)}</g:id>
      <g:title>${title}</g:title>
      <g:description>${desc}</g:description>
      <g:link>${url}</g:link>
      <g:image_link>${img}</g:image_link>
      <g:condition>${condition}</g:condition>
      <g:availability>in_stock</g:availability>
      <g:price>${price} USD</g:price>
      <g:brand>${esc(p.category || 'Trading Card')}</g:brand>
      <g:google_product_category>1243</g:google_product_category>
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>MillionTCG</title>
    <link>https://milliontcg.com</link>
    <description>Premier Trading Card Marketplace</description>
${productItems}
  </channel>
</rss>`;

  fs.writeFileSync('google-feed.xml', xml);
  console.log('Successfully generated google-feed.xml with ' + listings.length + ' products.');
}

run();
