/**
 * MillionTCG Serverless Cloud Marketplace & Auth Backend
 * Google Apps Script Deployment Engine
 * Connected Account: tcgmillion@gmail.com
 * 
 * INSTRUCTIONS TO UPDATE YOUR GOOGLE APPS SCRIPT:
 * 1. Open https://script.google.com/
 * 2. Open your "MillionTCG Auth / Database" project
 * 3. Replace all code with this file
 * 4. Click "Deploy" -> "New deployment" -> Select "Web app"
 *    - Execute as: "Me (tcgmillion@gmail.com)"
 *    - Who has access: "Anyone"
 * 5. Click "Deploy" and authorize access.
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'ping';
  var scriptProps = PropertiesService.getScriptProperties();

  if (action === 'getListings') {
    try {
      var raw = scriptProps.getProperty('mtcg_cloud_listings');
      if (raw) {
        var listings = JSON.parse(raw);
        return jsonResponse({ ok: true, listings: listings });
      }

      // Check fallback individual properties
      var rawIds = scriptProps.getProperty('mtcg_listing_ids');
      if (rawIds) {
        var ids = JSON.parse(rawIds);
        var allProps = scriptProps.getProperties();
        var listings = [];
        ids.forEach(function(id) {
          if (allProps['listing_' + id]) {
            try { listings.push(JSON.parse(allProps['listing_' + id])); } catch (e) {}
          }
        });
        return jsonResponse({ ok: true, listings: listings });
      }

      return jsonResponse({ ok: true, listings: [] });
    } catch (err) {
      return jsonResponse({ ok: false, error: err.toString(), listings: [] });
    }
  }

  if (action === 'getUser') {
    var email = (e.parameter.email || '').toLowerCase().trim();
    if (!email) return jsonResponse({ ok: false, error: 'Email required' });
    try {
      var rawUser = scriptProps.getProperty('user_' + email);
      if (rawUser) {
        return jsonResponse({ ok: true, user: JSON.parse(rawUser) });
      } else {
        return jsonResponse({ ok: false, error: 'User not found' });
      }
    } catch (err) {
      return jsonResponse({ ok: false, error: err.toString() });
    }
  }

  if (action === 'getOrders') {
    var adminKey = (e && e.parameter && e.parameter.adminKey) ? e.parameter.adminKey : '';
    if (adminKey !== 'MTCG_ADMIN_2026') return jsonResponse({ ok: false, error: 'Unauthorized' });
    try {
      var raw = scriptProps.getProperty('mtcg_orders');
      var orders = raw ? JSON.parse(raw) : [];
      return jsonResponse({ ok: true, orders: orders });
    } catch (err) {
      return jsonResponse({ ok: false, error: err.toString(), orders: [] });
    }
  }

  return jsonResponse({ ok: true, status: 'MillionTCG Cloud Marketplace & Auth Engine Active 🚀' });
}

function saveImageToDrive(base64Str, filename) {
  try {
    if (!base64Str || typeof base64Str !== 'string' || base64Str.indexOf('data:image') !== 0) {
      return base64Str;
    }
    var parts = base64Str.split(',');
    var mime = parts[0].split(':')[1].split(';')[0];
    var bytes = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(bytes, mime, filename || ('card_' + Date.now() + '.jpg'));
    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();
    // Return high-speed direct Google CDN thumbnail URL
    return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
  } catch (err) {
    Logger.log('Drive save note: ' + err.toString());
    return base64Str;
  }
}

function doPost(e) {
  var scriptProps = PropertiesService.getScriptProperties();
  var payload = {};

  try {
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Invalid JSON payload' });
  }

  var action = payload.action || '';

  // 1. Save Card Listing to Global Cloud Database
  if (action === 'saveListing') {
    var newListing = payload.listing;
    if (!newListing || !newListing.id) {
      return jsonResponse({ ok: false, error: 'Listing data with ID required' });
    }

    try {
      // If image is a base64 string, upload to Google Drive for permanent, fast CDN hosting
      if (newListing.image && typeof newListing.image === 'string' && newListing.image.indexOf('data:image') === 0) {
        newListing.image = saveImageToDrive(newListing.image, 'card_' + newListing.id + '_front.jpg');
      }
      if (newListing.gallery && Array.isArray(newListing.gallery)) {
        newListing.gallery = newListing.gallery.map(function(img, idx) {
          if (img && typeof img === 'string' && img.indexOf('data:image') === 0) {
            return saveImageToDrive(img, 'card_' + newListing.id + '_' + idx + '.jpg');
          }
          return img;
        });
      }

      var rawListings = scriptProps.getProperty('mtcg_cloud_listings');
      var listings = rawListings ? JSON.parse(rawListings) : [];
      
      // Update existing or prepend new
      var existingIdx = -1;
      for (var i = 0; i < listings.length; i++) {
        if (String(listings[i].id) === String(newListing.id)) {
          existingIdx = i;
          break;
        }
      }

      if (existingIdx >= 0) {
        listings[existingIdx] = newListing;
      } else {
        listings.unshift(newListing);
      }

      // Limit cloud store to most recent 200 items to avoid quota caps
      if (listings.length > 200) listings = listings.slice(0, 200);

      try {
        scriptProps.setProperty('mtcg_cloud_listings', JSON.stringify(listings));
      } catch (propErr) {
        try {
          // If master list is too large, store each listing in individual property
          scriptProps.setProperty('listing_' + newListing.id, JSON.stringify(newListing));
          var ids = listings.map(function(item) { return String(item.id); });
          scriptProps.setProperty('mtcg_listing_ids', JSON.stringify(ids));
        } catch (innerErr) {
          // If STILL too large (e.g. 9KB property limit hit due to base64 images), strip the heavy base64 strings
          if (newListing.image && newListing.image.indexOf('data:image') === 0) newListing.image = 'images/logo.png';
          if (newListing.gallery) newListing.gallery = ['images/logo.png'];
          scriptProps.setProperty('listing_' + newListing.id, JSON.stringify(newListing));
          
          if (existingIdx >= 0) listings[existingIdx] = newListing;
          else listings[0] = newListing;
          
          var ids = listings.map(function(item) { return String(item.id); });
          scriptProps.setProperty('mtcg_listing_ids', JSON.stringify(ids));
        }
      }

      return jsonResponse({ ok: true, message: 'Listing saved to Cloud Marketplace!', listing: newListing });
    } catch (err) {
      return jsonResponse({ ok: false, error: err.toString() });
    }
  }

  // 2. Delete Card Listing from Cloud Database
  if (action === 'deleteListing') {
    var idToDelete = payload.id;
    if (!idToDelete) return jsonResponse({ ok: false, error: 'Listing ID required' });

    try {
      var rawListings = scriptProps.getProperty('mtcg_cloud_listings');
      var listings = rawListings ? JSON.parse(rawListings) : [];
      var filtered = listings.filter(function(item) {
        return String(item.id) !== String(idToDelete);
      });
      scriptProps.setProperty('mtcg_cloud_listings', JSON.stringify(filtered));

      // Also remove individual key if exists
      scriptProps.deleteProperty('listing_' + idToDelete);

      return jsonResponse({ ok: true, message: 'Listing deleted from Cloud' });
    } catch (err) {
      return jsonResponse({ ok: false, error: err.toString() });
    }
  }

  // 3. Save User Account to Cloud
  if (action === 'saveUser') {
    var email = (payload.email || '').toLowerCase().trim();
    if (!email) return jsonResponse({ ok: false, error: 'Email required' });

    try {
      scriptProps.setProperty('user_' + email, JSON.stringify(payload));
      return jsonResponse({ ok: true, message: 'User account synced to cloud' });
    } catch (err) {
      return jsonResponse({ ok: false, error: err.toString() });
    }
  }

  // 4. Send Verification Code Email from tcgmillion@gmail.com
  if (action === 'sendVerification') {
    var targetEmail = payload.email;
    var code = payload.code;
    var name = payload.name || 'Collector';

    if (!targetEmail || !code) return jsonResponse({ ok: false, error: 'Target email and code required' });

    try {
      MailApp.sendEmail({
        to: targetEmail,
        subject: 'Your 6-Digit MillionTCG Verification Code: ' + code,
        htmlBody: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#141416;color:#ffffff;padding:32px;border-radius:12px;border:1px solid #333;">' +
          '<h2 style="color:#eab308;margin-top:0;">MILLION TCG VERIFICATION</h2>' +
          '<p>Hello ' + name + ',</p>' +
          '<p>Here is your 6-digit verification code to access your MillionTCG account:</p>' +
          '<div style="text-align:center;margin:28px 0;">' +
            '<span style="font-size:32px;font-weight:bold;letter-spacing:6px;background:#000;color:#eab308;padding:14px 28px;border-radius:8px;border:2px solid #eab308;display:inline-block;">' + code + '</span>' +
          '</div>' +
          '<p style="color:#aaa;font-size:13px;">If you did not request this code, you can safely ignore this email.</p>' +
          '<hr style="border:none;border-top:1px solid #333;margin:24px 0;">' +
          '<p style="color:#777;font-size:12px;text-align:center;">MillionTCG • The Premier High-Octane TCG Platform</p>' +
        '</div>'
      });
      return jsonResponse({ ok: true, message: 'Verification email sent' });
    } catch (err) {
      return jsonResponse({ ok: false, error: err.toString() });
    }
  }

  // 5. Save Order to Cloud (called after every completed checkout)
  if (action === 'saveOrder') {
    var order = payload.order;
    if (!order || !order.id) return jsonResponse({ ok: false, error: 'Order with ID required' });

    try {
      var rawOrders = scriptProps.getProperty('mtcg_orders');
      var orders = rawOrders ? JSON.parse(rawOrders) : [];
      // Remove any duplicate if the same order ID is re-sent
      orders = orders.filter(function(o) { return String(o.id) !== String(order.id); });
      orders.unshift(order);
      // Limit to 500 most recent orders
      if (orders.length > 500) orders = orders.slice(0, 500);
      scriptProps.setProperty('mtcg_orders', JSON.stringify(orders));
      return jsonResponse({ ok: true, message: 'Order saved to cloud', orderId: order.id });
    } catch (err) {
      return jsonResponse({ ok: false, error: err.toString() });
    }
  }

  return jsonResponse({ ok: false, error: 'Unknown action' });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
