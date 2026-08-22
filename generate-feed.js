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

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function buildProductUrl(p) {
  const slug = slugify(p.title || p.name || 'product');
  return `https://milliontcg.com/product.html?name=${slug}&id=${encodeURIComponent(p.id)}`;
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

  // 1. Generate google-feed.xml
  const productItems = listings.map(p => {
    const url  = esc(buildProductUrl(p));
    const title = esc(p.title || p.name || 'Trading Card');
    const desc = esc(p.desc || `${p.condition || 'Raw'} Single Card - ${p.category || 'Trading Card'}`);
    let rawImg = (p.gallery && p.gallery[0]) || p.image || 'https://milliontcg.com/images/logo.png';
    if (!rawImg.startsWith('http')) {
      rawImg = 'https://milliontcg.com/' + rawImg.replace(/^\//, '');
    }
    if (rawImg.includes('drive.google.com')) {
      const match = rawImg.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const driveUrl = 'https://drive.google.com/uc?export=download&id=' + match[1];
        rawImg = 'https://wsrv.nl/?url=' + encodeURIComponent(driveUrl) + '&output=jpg';
      }
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

  // 2. Generate static JS file for synchronous loading
  if (!fs.existsSync('js')) fs.mkdirSync('js');
  fs.writeFileSync('js/products-data.js', `window.MILLION_TCG_PRODUCTS = ${JSON.stringify(listings)};`);
  console.log('Successfully generated js/products-data.js');

  // 3. Generate sitemap.xml
  const sitemapItems = listings.map(p => {
    return `
  <url>
    <loc>${esc(buildProductUrl(p))}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join('');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://milliontcg.com/</loc>
    <lastmod>2026-08-05</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>https://milliontcg.com/images/hero-banner.png</image:loc>
      <image:title>MillionTCG Trading Card Marketplace</image:title>
      <image:caption>Premier Marketplace for Pokémon, Magic: The Gathering, Yu-Gi-Oh cards, booster boxes, and singles</image:caption>
    </image:image>
    <image:image>
      <image:loc>https://milliontcg.com/images/logo.png</image:loc>
      <image:title>MillionTCG Official Logo</image:title>
    </image:image>
  </url>
  <url>
    <loc>https://milliontcg.com/shop.html</loc>
    <lastmod>2026-08-05</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://milliontcg.com/sell.html</loc>
    <lastmod>2026-08-05</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://milliontcg.com/how-it-works.html</loc>
    <lastmod>2026-08-05</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://milliontcg.com/contact-us.html</loc>
    <lastmod>2026-08-05</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://milliontcg.com/track-order.html</loc>
    <lastmod>2026-08-05</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://milliontcg.com/shipping-policy.html</loc>
    <lastmod>2026-08-05</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://milliontcg.com/returns-policy.html</loc>
    <lastmod>2026-08-05</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>${sitemapItems}
</urlset>`;

  fs.writeFileSync('sitemap.xml', sitemapXml);
  console.log('Successfully updated sitemap.xml with product links.');
}

run();
