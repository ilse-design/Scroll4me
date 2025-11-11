// Register the click handler at top level so it always works,
// even after the service worker is restarted.
chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 400,
    height: 300
  });
});

function getMainTab(callback) {
  chrome.windows.getAll({ populate: true }, (windows) => {
    for (let win of windows) {
      if (win.type === 'normal') {
        let activeTab = win.tabs.find(tab => tab.active);
        if (activeTab) {
          callback(activeTab);
          return;
        }
      }
    }
  });
}

// Privacy verification functions for logged-out checks
async function verifyLinkedInPublic(url) {
  try {
    console.log('Verifying LinkedIn post accessibility:', url);
    const response = await fetch(url, { 
      credentials: 'omit', 
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Some public posts return 200; sometimes 302 to a public share page is ok
    const isOkayStatus = response.status === 200 || response.status === 302;
    
    if (!isOkayStatus) {
      console.log('LinkedIn verification failed with status:', response.status);
      return false;
    }
    
    // Optionally read a small slice to detect "This content is not available"
    let text = '';
    try { 
      text = (await response.text()).slice(0, 5000).toLowerCase(); 
    } catch (e) {
      console.warn('Could not read response text:', e);
    }
    
    const blocked = /login|sign in|not available|no longer available|unavailable/.test(text);
    const isAccessible = isOkayStatus && !blocked;
    
    console.log('LinkedIn post verification result:', { url, status: response.status, blocked, isAccessible });
    return isAccessible;
    
  } catch (error) {
    console.error('Error verifying LinkedIn post:', error);
    return false; // fail closed
  }
}

async function verifyInstagramPublic(username) {
  try {
    console.log('Verifying Instagram profile accessibility:', username);
    const url = `https://www.instagram.com/${username}/`;
    const response = await fetch(url, { 
      credentials: 'omit',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log('Instagram verification failed with status:', response.status);
      return false;
    }
    
    const text = await response.text();
    const textLower = text.toLowerCase();
    const isPrivate = /this account is private/.test(textLower);
    const isAccessible = !isPrivate;
    
    console.log('Instagram profile verification result:', { username, isPrivate, isAccessible });
    return isAccessible;
    
  } catch (error) {
    console.error('Error verifying Instagram profile:', error);
    return false; // fail closed
  }
}

// Relay scrape results to all extension views (e.g., popup window)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DEBUG_LOG') {
    // Persistent logging from content script - stays visible even after tab closes
    console.log(`[Content Script] ${msg.message}`, msg.data || '');
    return;
  } else if (msg.action === 'scrapeResult') {
    chrome.storage.local.set({ scrapeData: msg.data }, () => {
      chrome.runtime.sendMessage({ 
        action: 'showScrapeResult', 
        data: msg.data,
        site: msg.site,
        remainingSites: msg.remainingSites
      });
    });
  } else if (msg.type === 'VERIFY_PUBLIC_LINKEDIN') {
    // Verify LinkedIn post accessibility logged-out
    verifyLinkedInPublic(msg.url).then(isAccessible => {
      sendResponse({ ok: isAccessible });
    });
    return true; // async response
  } else if (msg.type === 'VERIFY_PUBLIC_IG_PROFILE') {
    // Verify Instagram profile accessibility logged-out
    verifyInstagramPublic(msg.username).then(isAccessible => {
      sendResponse({ ok: isAccessible });
    });
    return true; // async response
  } else if (msg.type === 'RESTORE_AND_CLOSE_TAB') {
    // Restore previous tab and close scraping tab
    const { prevTabId, scrapeTabId } = msg;
    
    if (prevTabId) {
      chrome.tabs.update(prevTabId, { active: true }, () => {
        console.log(`Restored previous tab: ${prevTabId}`);
      });
    }
    
    if (scrapeTabId) {
      chrome.tabs.remove(scrapeTabId, () => {
        console.log(`Closed scraping tab: ${scrapeTabId}`);
      });
    }
  }
  else if (msg.type === 'FETCH_IMAGE_AS_DATA_URL') {
    const url = msg.url;
    (async () => {
      try {
        const res = await fetch(url, { credentials: 'omit', mode: 'cors' });
        if (!res.ok) {
          sendResponse({ ok: false, error: `status ${res.status}` });
          return;
        }
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ ok: true, dataUrl: reader.result });
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async
  }
  else if (msg.type === 'FETCH_OG_IMAGE') {
    const pageUrl = msg.url;
    (async () => {
      try {
        const res = await fetch(pageUrl, { credentials: 'omit' });
        if (!res.ok) {
          sendResponse({ ok: false, error: `status ${res.status}` });
          return;
        }
        const html = await res.text();
        const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);
        if (match && match[1]) {
          let imageUrl = match[1];
          if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
          sendResponse({ ok: true, imageUrl });
        } else {
          sendResponse({ ok: false, error: 'og:image not found' });
        }
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async
  }
  else if (msg.type === 'OPENAI_CHAT_COMPLETIONS') {
    const { apiKey, model, messages, max_tokens, temperature, response_format } = msg;
    (async () => {
      try {
        if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
          sendResponse({ ok: false, status: 401, error: 'missing_api_key' });
          return;
        }
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ model, messages, max_tokens, temperature, response_format })
        });
        const data = await res.json();
        sendResponse({ ok: res.ok, status: res.status, data });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async
  }
}); 