// Removed old listener - now using unified message system at the bottom of file

// Restrict console.log output in content script to only key events
(function() {
  const originalLog = console.log.bind(console);
  console.log = (...args) => {
    try {
      const firstArg = args[0];
      if (typeof firstArg !== 'string') return;
      const allowed = firstArg.startsWith('LinkedIn scrape results') ||
                      firstArg.startsWith('Instagram scrape results') ||
                      firstArg.startsWith('Combined scrape results') ||
                      firstArg.startsWith('OpenAI prompt:') ||
                      firstArg.startsWith('OpenAI result:') ||
                      String(firstArg).includes('z-index set to');
      if (allowed) originalLog(...args);
    } catch {}
  };
})();

// --- Robust scrolling helpers (LinkedIn) ---
function getLinkedInScrollContainer() {
  try {
    // Prefer explicit feed/scroll containers first
    const candidates = [
      '.scaffold-layout__list-detail',
      '.scaffold-layout__list',
      '.scaffold-finite-scroll__content',
      '[role="feed"]',
      'div[data-test-id="feed-container"]',
      'main.scaffold-layout__main',
      '.core-rail',
      'main',
      '#main'
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const style = getComputedStyle(el);
      const hasOverflow = (el.scrollHeight - el.clientHeight) > 10;
      const canScroll = hasOverflow || style.overflowY.includes('auto') || style.overflowY.includes('scroll');
      if (canScroll) return el;
    }
    // Fallback to documentElement or body
    return document.scrollingElement || document.documentElement || document.body;
  } catch (e) {
    return document.scrollingElement || document.documentElement || document.body;
  }
}

function smartScrollLinkedIn(delta) {
  const container = getLinkedInScrollContainer();
  if (!container) return false;
  const before = (container === window || container === document || container === document.body)
    ? window.scrollY
    : container.scrollTop;
  try {
    try { window.focus(); } catch {}
    try { document.body && document.body.focus && document.body.focus(); } catch {}
    if (container && container.scrollBy) {
      container.scrollBy(0, delta);
    } else if (container === document.scrollingElement || container === document.documentElement || container === document.body) {
      window.scrollBy(0, delta);
    } else {
      container.scrollTop += delta;
    }
  } catch {
    // dispatch a wheel event as a last resort
    try {
      const evt = new WheelEvent('wheel', { deltaY: delta, bubbles: true, cancelable: true });
      (container || document).dispatchEvent(evt);
    } catch {}
  }
  // Also send a PageDown-like key event to encourage lazy-load
  try {
    const keyEvt = new KeyboardEvent('keydown', { key: 'PageDown', code: 'PageDown', bubbles: true });
    document.dispatchEvent(keyEvt);
  } catch {}
  const after = (container === window || container === document || container === document.body)
    ? window.scrollY
    : container.scrollTop;
  return after !== before;
}

function scrollToBottomLinkedIn() {
  try {
    const before = window.scrollY;
    const maxY = Math.max(
      document.body.scrollHeight || 0,
      document.documentElement.scrollHeight || 0
    );
    window.scrollTo(0, maxY);
    if (window.scrollY !== before) return true;
  } catch {}
  try {
    const feed =
      document.querySelector('[role=\"feed\"]') ||
      document.querySelector('.scaffold-layout__list') ||
      document.querySelector('.scaffold-finite-scroll__content') ||
      document.querySelector('main.scaffold-layout__main');
    if (feed) {
      const items = feed.querySelectorAll('div,[data-urn*=\"urn:li:activity\"],.update-components-update-v2');
      const last = items[items.length - 1];
      if (last && last.scrollIntoView) {
        last.scrollIntoView({ block: 'end' });
        return true;
      }
    }
  } catch {}
  return false;
}

function closeLinkedInOverlaysIfAny() {
  try {
    // Detect common LinkedIn modal/lightbox overlays
    const modals = [
      'div[role="dialog"][aria-modal="true"]',
      '.artdeco-modal',
      'div.image-viewer__container',
      'div[aria-label*="dialog"]',
      'div[role="presentation"][data-test-modal="true"]'
    ];
    const modalEl = modals.map(s => document.querySelector(s)).find(Boolean);
    if (!modalEl) return false;

    // Try close buttons
    const closeSelectors = [
      'button[aria-label*="Close" i]',
      'button[aria-label*="Dismiss" i]',
      'button.artdeco-modal__dismiss',
      'button[data-test-modal-close-btn]'
    ];
    for (const sel of closeSelectors) {
      const btn = modalEl.querySelector(sel) || document.querySelector(sel);
      if (btn) { btn.click(); return true; }
    }
    // Fallback: press Escape
    const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
    document.dispatchEvent(esc);
    return true;
  } catch {
    return false;
  }
}

async function waitForLinkedInFeed(maxMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const feed = document.querySelector('[role="feed"], .scaffold-layout__list, .scaffold-finite-scroll__content, main.scaffold-layout__main');
    if (feed) return true;
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}

// Helper function to log to both console AND background (so logs persist after tab closes)
function persistentLog(message, data = null) {
    console.error(message);
    try {
        chrome.runtime.sendMessage({ 
            type: 'DEBUG_LOG', 
            message: message,
            data: data 
        });
    } catch (e) {
        // Ignore if background isn't listening
    }
}

// Simplified LinkedIn scraping - similar to Instagram approach
async function scrapeLinkedInContent() {
    const posts = [];
    
    // CORRECT selector: LinkedIn posts are divs with componentkey="urn:li:activity:..."
    const allPostDivs = document.querySelectorAll('div[componentkey*="urn:li:activity:"]');
    persistentLog(`🔎 SCRAPING DEBUG: Found ${allPostDivs.length} total post divs with urn:li:activity`);
    
    // IMPORTANT: Don't filter by visibility! Posts that are scrolled past are off-screen but still valid.
    // Just filter by size (using offsetHeight/offsetWidth which works for off-screen elements too)
    const postElements = Array.from(allPostDivs).filter(el => {
        try {
            // Use offsetHeight/offsetWidth instead of getBoundingClientRect
            // This works for elements that are in the DOM but scrolled off-screen
            const height = el.offsetHeight;
            const width = el.offsetWidth;
            const isValidSize = height > 200 && width > 300; // Posts are bigger than UI elements
            
            if (!isValidSize && height > 0) {
                persistentLog(`  ⚠️ Filtered out post div: height=${height}, width=${width}`);
            }
            return isValidSize;
        } catch {
            return false;
        }
    });

    persistentLog(`📊 LinkedIn: Processing ${postElements.length} post elements (filtered from ${allPostDivs.length} total)`);
    
    let contentFailures = 0;
    let privacyFiltered = 0;
    let successfulPosts = 0;
    
    postElements.forEach((postEl, index) => {
        try {
            // Extract author name from profile links
            let author = 'Unknown Author';
            
            // LinkedIn structure: <a href="/in/username"><div><p>Author Name</p></div></a>
            const profileLinks = Array.from(postEl.querySelectorAll('a[href*="/in/"]'));
            for (const link of profileLinks) {
                // Get ALL <p> tags inside the link
                const allPs = link.querySelectorAll('p');
                for (const p of allPs) {
                    const text = p.textContent?.trim().split('•')[0].split('<')[0].trim(); // Split on • and < to remove extra content
                    // Look for name (not job title, not timestamps)
                    if (text && text.length > 2 && text.length < 100 && !text.includes('ago') && !text.includes('wk') && !text.includes('hr')) {
                        author = text;
                        break;
                    }
                }
                if (author !== 'Unknown Author') break;
            }

            // Extract post text - LinkedIn uses data-view-name="feed-commentary"
            let text = '';
            
            // First try the specific LinkedIn commentary selector
            const commentaryEl = postEl.querySelector('[data-view-name="feed-commentary"]');
            if (commentaryEl) {
                text = commentaryEl.innerText?.trim() || '';
            }
            
            // Fallback: look for any substantial text block
            if (!text || text.length < 10) {
                const textCandidates = Array.from(postEl.querySelectorAll('div, span, p'));
                for (const el of textCandidates) {
                    const innerText = el.innerText?.trim() || '';
                    // Look for text blocks that are substantial but not the whole feed
                    if (innerText.length > 20 && innerText.length < 5000) {
                        // Skip if it's UI text
                        if (!innerText.includes('Interessant') && !innerText.includes('Commentaar')) {
                            text = innerText;
                            break;
                        }
                    }
                }
            }
            
            // DIAGNOSTIC: Log what we extracted for first 3 posts
            if (index < 3) {
                persistentLog(`\n🔍 POST ${index} DETAILED DIAGNOSTIC:`);
                persistentLog(`  Tag: ${postEl.tagName}, Classes: ${postEl.className.substring(0, 50)}...`);
                persistentLog(`  Size: ${postEl.offsetHeight}x${postEl.offsetWidth}`);
                persistentLog(`  HTML length: ${postEl.innerHTML.length} chars`);
                persistentLog(`  HTML preview: ${postEl.innerHTML.substring(0, 200)}...`);
                persistentLog(`  Profile links found: ${profileLinks.length}`);
                if (profileLinks.length > 0) {
                    persistentLog(`    → First link href: ${profileLinks[0].href}`);
                    persistentLog(`    → First link text: "${profileLinks[0].textContent?.trim().substring(0, 100)}"`);
                    const firstP = profileLinks[0].querySelector('p');
                    persistentLog(`    → Has <p> inside? ${!!firstP}`);
                    if (firstP) {
                        persistentLog(`    → <p> text: "${firstP.textContent?.trim()}"`);
                    }
                } else {
                    persistentLog(`    → No profile links! Checking all <a> tags...`);
                    const allLinks = postEl.querySelectorAll('a');
                    persistentLog(`    → Total <a> tags: ${allLinks.length}`);
                    if (allLinks.length > 0) {
                        persistentLog(`    → First link href: ${allLinks[0].href}`);
                    }
                }
                persistentLog(`  Text candidates found: ${textCandidates.length}`);
                if (textCandidates.length > 0) {
                    persistentLog(`    → First candidate length: ${textCandidates[0].innerText?.length || 0}`);
                    persistentLog(`    → First candidate preview: "${textCandidates[0].innerText?.trim().substring(0, 60)}..."`);
                }
                persistentLog(`  All <a> links: ${postEl.querySelectorAll('a').length}`);
                persistentLog(`  Links with /posts/: ${Array.from(postEl.querySelectorAll('a')).filter(a => a.href?.includes('/posts/')).length}`);
                persistentLog(`  Links with /activity: ${Array.from(postEl.querySelectorAll('a')).filter(a => a.href?.includes('/activity')).length}`);
                persistentLog(`  → EXTRACTED: author="${author}", textLength=${text.length}, url=${!!originalPostUrl}`);
            }
            
            // Extract image: Find all images in the post and filter to find the main one.
            const allImages = Array.from(postEl.querySelectorAll('img'));
            const postImages = allImages.filter(img => {
                const parentElement = img.parentElement;
                if (!parentElement) return false;

                const parentWidth = parentElement.clientWidth;
                const parentHeight = parentElement.clientHeight;

                // Rule 1: Must be large enough to be a post image, not an icon.
                const isLargeEnough = parentWidth > 200 && parentHeight > 100;

                // Rule 2: Alt text shouldn't identify it as a profile picture.
                const isNotProfileByAlt = !img.alt.toLowerCase().includes('profile');
                
                // Rule 3: URL shouldn't match common profile picture patterns.
                const isNotProfileBySrc = !img.src.includes('profile-displayphoto');

                // Rule 4: Must not be inside the post header component.
                const isNotInHeader = !img.closest('.feed-shared-actor');

                return isLargeEnough && isNotProfileByAlt && isNotProfileBySrc && isNotInHeader;
            });

            const image = postImages.length > 0 ? postImages[0].src : null;

            // Extract post URL - use componentkey attribute which contains urn:li:activity
            let originalPostUrl = null;
            
            // The post div itself has componentkey="urn:li:activity:XXXXX"
            const componentKey = postEl.getAttribute('componentkey');
            if (componentKey && componentKey.includes('urn:li:activity:')) {
                const activityId = componentKey.split(':').pop();
                originalPostUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`;
            }
            
            // Fallback: look for activity links
            if (!originalPostUrl) {
                const allLinks = Array.from(postEl.querySelectorAll('a[href]'));
                for (const link of allLinks) {
                    const href = link.href;
                    if (href && (href.includes('/posts/') || href.includes('/activity'))) {
                        originalPostUrl = href.split('?')[0]; // Remove query params
                        break;
                    }
                }
            }

            // LinkedIn privacy detection (milder): only exclude if explicitly private
            const heuristic = isLinkedInPostPublic(postEl);
            const permalink = getLinkedInPermalink(postEl) || originalPostUrl;

            // Only proceed if we have some content
            if (text || image || author !== 'Unknown Author') {
                // Handle reshares – exclude only if explicitly private
                const resharedBlock = findResharedBlock(postEl);
                let isReshareAllowed = true;
                if (resharedBlock) {
                    const originalPermalink = getLinkedInPermalink(resharedBlock) || permalink || originalPostUrl;
                    const originalHeuristic = isLinkedInPostPublic(resharedBlock);
                    if (originalHeuristic?.isPublic === false) {
                        isReshareAllowed = false;
                    }
                }

                if (heuristic?.isPublic === false) {
                    // Explicitly private → exclude
                    privacyFiltered++;
                    if (index < 3) {
                        console.error(`❌ Post ${index} filtered: explicitly private (${heuristic.reason})`);
                    }
                } else if (!isReshareAllowed) {
                    // Private reshare → exclude
                    privacyFiltered++;
                    if (index < 3) {
                        console.error(`❌ Post ${index} filtered: private reshare`);
                    }
                } else if (isReshareAllowed) {
                    // Public or unknown → include
                    const reason = heuristic?.isPublic === true ? (heuristic.reason || 'heuristic_public') : 'assumed_public';
                    const confidence = heuristic?.isPublic === true ? (heuristic.confidence || 'medium') : 'low';
                    posts.push({
                        author,
                        text,
                        image,
                        originalPostUrl,
                        platform: 'LinkedIn',
                        isPublic: true,
                        privacyInfo: { isPublic: true, reason, confidence },
                        privacyReason: reason
                    });
                    successfulPosts++;
                    
                    // Log first few successful posts
                    if (posts.length <= 3) {
                        console.error(`✓ Post ${posts.length}: "${author}" - ${text.substring(0, 50)}...`);
                    }
                }
            } else {
                contentFailures++;
                if (index < 3) {
                    console.error(`⚠️ Post ${index} skipped: no content (author="${author}", textLen=${text.length}, image=${!!image})`);
                }
            }
        } catch (error) {
            console.error('Error scraping a LinkedIn post element:', error, postEl);
        }
    });

    persistentLog(`🎯 FINAL: LinkedIn scraped ${posts.length} posts from ${postElements.length} elements`);
    persistentLog(`   → Content failures: ${contentFailures} (no author/text/image)`);
    persistentLog(`   → Privacy filtered: ${privacyFiltered}`);
    persistentLog(`   → Successful posts: ${successfulPosts}`);
    return posts;
}

// --- SINGLE SOURCE OF TRUTH: Instagram scraper with logged-out fallback ---
async function scrapeInstagramContent() {
  const posts = [];
  const pendingVerifications = [];

  const possibleSelectors = [
    'article',
    '[role="article"]',
    'div[style*="flex-direction: column"]',
    'main section > div > div > div',
    'div._ac7v',
    'div.x1iyjqo2.x1t1x2f9' // recent IG feed card wrapper class combo
  ];

  let postElements = [];
  for (const sel of possibleSelectors) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) { postElements = els; break; }
  }
  console.log(`Instagram: Found ${postElements.length} potential post elements.`);

  postElements.forEach((postEl, index) => {
    try {
      // Helper to safely build regex from display name/username
      const escapeRegExp = (str) => {
        try { return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); } catch { return String(str); }
      };
      // AUTHOR
      let author = 'Unknown Author';
      const authorCandidates = [
        'header a[href^="/"][href*="/"] span', // Display name in span
        'header a[href^="/"]', // Username fallback
        '[data-testid="user-avatar"] + div a', // Alternative layout
        'header div[dir] span', // Another common pattern
        'article header span[dir]' // Direct span with direction
      ];
      for (const sel of authorCandidates) {
        const el = postEl.querySelector(sel);
        if (el && el.textContent?.trim()) {
          const text = el.textContent.trim();
          // Skip if it's just a username (starts with @) and we can find a better display name
          if (text.startsWith('@') && sel !== 'header a[href^="/"]') continue;
          author = text;
          break;
        }
      }

      // TEXT
      let text = '';
      const textCandidates = [
        // Instagram caption containers (most specific first)
        'article div[style*="word-wrap"] span',
        'ul li div[role] span',
        'article div[dir] span:not([aria-label])',
        'div[data-testid*="caption"] span',
        'div[style*="line-height"] span',
        // Broader fallbacks
        'div[lang] span',
        'span[dir]:not([aria-label]):not([role])',
        'div[dir]:not([aria-label]):not([role])'
      ];
      for (const sel of textCandidates) {
        const el = postEl.querySelector(sel);
        if (!el) continue;
        if (el.innerText?.trim()) {
          const captionText = el.innerText.trim();
          // Skip if caption equals author/username (common in header)
          const normalizedAuthor = (author || '').replace(/^@/, '').trim().toLowerCase();
          const normalizedCaption = captionText.replace(/^@/, '').trim().toLowerCase();
          if (normalizedAuthor && normalizedCaption === normalizedAuthor) continue;

          // Filter out common non-caption text
          if (captionText.length > 3 && 
              !captionText.includes('View profile') &&
              !captionText.includes('Follow') &&
              !captionText.includes('Verified') &&
              !captionText.match(/^\d+[,.]?\d*\s*(likes?|comments?|views?)$/i)) {
            text = captionText;
            break;
          }
        }
      }

      // Post-process: clean caption and ensure it's not just the username
      if (text) {
        // Many IG captions start with the username; strip it off if present
        const normalizedAuthor = (author || '').replace(/^@/, '').trim();
        if (normalizedAuthor) {
          const pattern = new RegExp(`^@?${escapeRegExp(normalizedAuthor)}\\s*[:\\-–—]*\\s*`, 'i');
          text = text.replace(pattern, '').trim();
        }
      }

      // If text is still missing or equals the author/username, search deeper for a proper caption
      if (!text || text === author || text.replace(/^@/, '') === (author || '').replace(/^@/, '')) {
        try {
          const probableCaptionSpans = Array.from(postEl.querySelectorAll('header ~ * ul li span, ul li span, div[role="button"] span, article h1, article h2, article h3'))
            .map(el => el && el.innerText ? el.innerText.trim() : '')
            .filter(t => t && t.length > 2);
          const uiNoise = [/^suggested post/i, /view profile/i, /follow/i, /verified/i, /add a comment/i];
          const filtered = probableCaptionSpans.filter(t => {
            if (author && t === author) return false;
            if (t.length < 3) return false;
            if (uiNoise.some(rx => rx.test(t))) return false;
            // Avoid pure username-only texts
            return true;
          });
          if (filtered.length > 0) {
            // Prefer the longest meaningful candidate
            filtered.sort((a,b) => b.length - a.length);
            text = filtered[0];
            // Strip leading username again if present
            const normalizedAuthor2 = (author || '').replace(/^@/, '').trim();
            if (normalizedAuthor2) {
              const pattern2 = new RegExp(`^@?${escapeRegExp(normalizedAuthor2)}\\s*[:\\-–—]*\\s*`, 'i');
              text = text.replace(pattern2, '').trim();
            }
          }
        } catch (e) {
          // ignore and keep existing text
        }
      }

      // Final guard: if text equals author (or @author) after cleaning, drop it
      if (text && author && (text === author || text.replace(/^@/, '') === author.replace(/^@/, ''))) {
        text = '';
      }

      // IMAGE (URL fallback; in-page overlay should prefer cloneNode of the real <img>)
      let image = null;
      let imageElementId = null;
      const imgs = Array.from(postEl.querySelectorAll('img')).filter(img => {
        const r = img.getBoundingClientRect();
        return r.width > 200 && r.height > 100;
      }).sort((a,b) => (b.width*b.height) - (a.width*a.height));
      if (imgs.length) {
        const first = imgs[0];
        let url = first.src;
        if (!url || url.includes('…') || !url.startsWith('http')) {
          const srcset = first.getAttribute('srcset');
          if (srcset) {
            const list = srcset.split(',').map(s => s.trim().split(' ')[0]);
            url = list[list.length - 1];
          }
        }
        if (url && url.startsWith('http')) image = url;

        // label the element so renderer can clone the exact node
        if (!first.getAttribute('data-s4m-id')) {
          first.setAttribute('data-s4m-id', 's4m-img-' + Math.random().toString(36).slice(2));
        }
        imageElementId = first.getAttribute('data-s4m-id');

        // If no text found yet, try the image alt which often contains caption
        if (!text) {
          const alt = first.getAttribute('alt');
          if (alt && alt.trim()) {
            text = alt.trim();
          }
        }
      }

      // PERMALINK
      let originalPostUrl = null;
      const linkSel = ['a[href*="/p/"]','a[href*="/reel/"]','time[datetime] parent a','a[href*="instagram.com/p/"]'];
      for (const s of linkSel) {
        const a = postEl.querySelector(s);
        if (a) {
          let href = a.getAttribute('href');
          if (href) {
            if (href.startsWith('/')) href = 'https://www.instagram.com' + href;
            originalPostUrl = href;
            break;
          }
        }
      }
  // Fallback: look for any anchor linking to a post within the post element
  if (!originalPostUrl) {
    const anyLink = Array.from(postEl.querySelectorAll('a[href]'))
      .map(a => a.getAttribute('href'))
      .find(h => h && (/\/p\//.test(h) || /\/reel\//.test(h)));
    if (anyLink) {
      originalPostUrl = anyLink.startsWith('/') ? 'https://www.instagram.com' + anyLink : anyLink;
    }
  }

      // PRIVACY / IDENTITY
      const username = getInstagramUsernameFromPost(postEl);
      // Fallback: if author is unknown but we have username, use it
      if (author === 'Unknown Author' && username) {
        author = username;
        // Re-clean caption now that author is known to avoid caption == username
        if (text) {
          const normalizedAuthor = (author || '').replace(/^@/, '').trim();
          if (normalizedAuthor) {
            const pattern = new RegExp(`^@?${escapeRegExp(normalizedAuthor)}\\s*[:\\-–—]*\\s*`, 'i');
            text = text.replace(pattern, '').trim();
          }
          const normalizedText = text.replace(/^@/, '').trim().toLowerCase();
          const normalizedAuthorLower = normalizedAuthor.toLowerCase();
          if (normalizedText === normalizedAuthorLower) {
            text = '';
          }
        }
      }
      const hasIdentity = !!(username || originalPostUrl);
      if ((author !== 'Unknown Author' || text.length > 10 || image) && hasIdentity) {
        const verificationPromise = (async () => {
          // Strategy: prefer account-level public check; fall back to post-page accessibility
          let publicOk = false;
          let reason = 'unknown';
          if (username) {
            console.log(`Checking Instagram account privacy for: ${username}`);
            const accPublic = await isInstagramAccountPublic(username);
            if (accPublic === true) { publicOk = true; reason = 'verified_public_account'; }
            else if (accPublic === null && username) {
              console.log(`Instagram API inconclusive for ${username} → trying logged-out fallback`);
              const ok = await verifyInstagramPublic(username);
              if (ok) { publicOk = true; reason = 'verified_logged_out'; }
            }
          }
          // If still unknown, optimistically include if post URL exists (to avoid zero results); we'll filter later in AI
          if (!publicOk && originalPostUrl) {
            const postOk = await isInstagramPostPublic(originalPostUrl);
            if (postOk === null) { // inconclusive → optimistically include
              publicOk = true; reason = 'post_accessibility_inconclusive';
            } else if (postOk) {
              publicOk = true; reason = 'post_accessible';
            }
          }
          if (publicOk) {
            // Resolve caption via fallback if needed
            let finalText = text;
            if (!finalText && originalPostUrl) {
              const fetched = await fetchInstagramCaptionFromPostUrl(originalPostUrl);
              if (fetched) {
                finalText = fetched;
                const normalizedAuthor3 = (author || '').replace(/^@/, '').trim();
                if (normalizedAuthor3) {
                  const pattern3 = new RegExp(`^@?${escapeRegExp(normalizedAuthor3)}\\s*[:\\-–—]*\\s*`, 'i');
                  finalText = finalText.replace(pattern3, '').trim();
                }
              }
            }
            return {
              author, text: finalText || '', image, originalPostUrl, platform: 'Instagram', imageElementId,
              isPublic: true,
              privacyInfo: { isPublic: true, reason, confidence: 'medium', username },
              privacyReason: reason
            };
          }
          console.log(`Instagram: unable to verify public status → exclude`);
          return null;
        })().catch(err => {
          console.error(`Privacy check error for ${username}:`, err);
          return null; // fail-closed
        });

        pendingVerifications.push(verificationPromise);
      } else if (!hasIdentity) {
        console.log('No username or post URL → exclude (fail-closed).');
      }
    } catch (e) {
      console.error(`Instagram: Error processing post ${index}:`, e);
    }
  });

  console.log(`Instagram: Waiting for ${pendingVerifications.length} privacy verifications to complete.`);
  try {
    // Process verifications with a timeout to avoid stalling when Instagram throttles
    const withTimeout = (p, ms) => Promise.race([
      p,
      new Promise((resolve) => setTimeout(() => resolve(null), ms))
    ]);
    const results = await Promise.allSettled(
      pendingVerifications.map(v => withTimeout(v, 5000))
    );
    const verifiedPosts = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    console.log(`Instagram: Privacy verification complete. ${verifiedPosts.length} of ${pendingVerifications.length} verified public.`);
    posts.push(...verifiedPosts);
  } catch (e) {
    console.error('Instagram: Error during privacy verification:', e);
  }

  console.log(`Instagram: Successfully scraped ${posts.length} verified public posts`);
  return posts;
}

// Lightweight logged-out check for post accessibility; return true/false/null (null = inconclusive)
async function isInstagramPostPublic(postUrl) {
  try {
    if (!postUrl) return null;
    const res = await fetch(postUrl, { credentials: 'omit', redirect: 'manual' });
    if (res.status === 200 || res.status === 302) {
      const text = (await res.text()).slice(0, 2000).toLowerCase();
      const blocked = /login|sign in|private|not available|unavailable/.test(text);
      return !blocked;
    }
    if (res.type === 'opaqueredirect') return null; // uncertain
    return null;
  } catch (e) {
    return null; // inconclusive
  }
}

// Enhanced scrolling function with better content loading detection
function scrollAndScrape(site, positiveInput, negativeInput, scrollDuration, remainingSites, prevTabId, scrapeTabId, multiPass) {
  console.log(`Starting scroll and scrape for ${site} (${scrollDuration}s)`);
  
  const isInstagram = site === 'instagram';
  const durationMs = (scrollDuration || 30) * 1000;
  const passes = (isInstagram && multiPass && Number(multiPass.passes)) ? Number(multiPass.passes) : 1;
  const passDurationMs = (isInstagram && multiPass && Number(multiPass.passDurationSeconds)) ? Number(multiPass.passDurationSeconds) * 1000 : durationMs;
  const coolDownMs = (isInstagram && multiPass && Number(multiPass.coolDownMs)) ? Number(multiPass.coolDownMs) : 800;
  let lastPostCount = 0;
  let stuckCount = 0;
  let scrollAttempts = 0;
  // For Instagram: accumulate posts across passes to avoid virtualization losses
  const igCollected = new Map(); // key: originalPostUrl || imageElementId, value: raw fields

  function extractIgRawFromElement(postEl) {
    try {
      const escapeRegExp = (str) => { try { return String(str).replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'); } catch { return String(str); } };
      // AUTHOR
      let author = 'Unknown Author';
      const authorCandidates = [
        'header a[href^="/"][href*="/"] span',
        'header a[href^="/"]',
        '[data-testid="user-avatar"] + div a',
        'header div[dir] span',
        'article header span[dir]'
      ];
      for (const sel of authorCandidates) {
        const el = postEl.querySelector(sel);
        if (el && el.textContent?.trim()) { author = el.textContent.trim(); break; }
      }
      // TEXT (caption)
      let text = '';
      const textCandidates = [
        'article div[style*="word-wrap"] span',
        'ul li div[role] span',
        'article div[dir] span:not([aria-label])',
        'div[data-testid*="caption"] span',
        'div[style*="line-height"] span',
        'div[lang] span',
        'span[dir]:not([aria-label]):not([role])',
        'div[dir]:not([aria-label]):not([role])'
      ];
      for (const sel of textCandidates) {
        const el = postEl.querySelector(sel);
        if (el && el.innerText?.trim()) {
          const t = el.innerText.trim();
          if (t.length > 3 && !/^(View profile|Follow|Verified)$/i.test(t)) { text = t; break; }
        }
      }
      if (text) {
        const normalizedAuthor = (author || '').replace(/^@/, '').trim();
        if (normalizedAuthor) {
          const rx = new RegExp(`^@?${escapeRegExp(normalizedAuthor)}\\s*[:\\-–—]*\\s*`, 'i');
          text = text.replace(rx, '').trim();
        }
      }
      // IMAGE
      let image = null; let imageElementId = null;
      const imgs = Array.from(postEl.querySelectorAll('img')).filter(img => {
        const r = img.getBoundingClientRect();
        return r.width > 200 && r.height > 100;
      }).sort((a,b) => (b.width*b.height) - (a.width*a.height));
      if (imgs.length) {
        const first = imgs[0];
        let url = first.src;
        if ((!url || url.includes('…') || !url.startsWith('http')) && first.getAttribute('srcset')) {
          const list = first.getAttribute('srcset').split(',').map(s => s.trim().split(' ')[0]);
          url = list[list.length - 1];
        }
        if (url && url.startsWith('http')) image = url;
        if (!first.getAttribute('data-s4m-id')) {
          first.setAttribute('data-s4m-id', 's4m-img-' + Math.random().toString(36).slice(2));
        }
        imageElementId = first.getAttribute('data-s4m-id');
        if (!text) {
          const alt = first.getAttribute('alt');
          if (alt && alt.trim()) text = alt.trim();
        }
      }
      // URL
      let originalPostUrl = null;
      const linkSel = ['a[href*="/p/"]','a[href*="/reel/"]','time[datetime] parent a','a[href*="instagram.com/p/"]'];
      for (const s of linkSel) {
        const a = postEl.querySelector(s);
        if (a) {
          let href = a.getAttribute('href');
          if (href) { if (href.startsWith('/')) href = 'https://www.instagram.com' + href; originalPostUrl = href; break; }
        }
      }
      if (!originalPostUrl) {
        const anyLink = Array.from(postEl.querySelectorAll('a[href]')).map(a => a.getAttribute('href')).find(h => h && (/\/p\//.test(h) || /\/reel\//.test(h)));
        if (anyLink) originalPostUrl = anyLink.startsWith('/') ? 'https://www.instagram.com' + anyLink : anyLink;
      }
      const username = getInstagramUsernameFromPost(postEl);
      const key = originalPostUrl || imageElementId || (username ? `u:${username}:${text.slice(0,20)}` : null);
      if (!key) return null;
      return { key, author, text, image, imageElementId, originalPostUrl, platform: 'Instagram', username };
    } catch { return null; }
  }

  async function finalizeIgCollected() {
    const entries = Array.from(igCollected.values());
    if (entries.length === 0) return [];
    const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
    const results = await Promise.all(entries.map(async (raw) => {
      try {
        let publicOk = false; let reason = 'unknown';
        if (raw.username) {
          const acc = await withTimeout(isInstagramAccountPublic(raw.username), 5000);
          if (acc === true) { publicOk = true; reason = 'verified_public_account'; }
          else if (acc === null) {
            const ok = await withTimeout(verifyInstagramPublic(raw.username), 5000);
            if (ok) { publicOk = true; reason = 'verified_logged_out'; }
          }
        }
        if (!publicOk && raw.originalPostUrl) {
          const postOk = await withTimeout(isInstagramPostPublic(raw.originalPostUrl), 5000);
          if (postOk === null) { publicOk = true; reason = 'post_accessibility_inconclusive'; }
          else if (postOk) { publicOk = true; reason = 'post_accessible'; }
        }
        if (!publicOk) return null;
        let finalText = raw.text || '';
        if (!finalText && raw.originalPostUrl) {
          finalText = (await withTimeout(fetchInstagramCaptionFromPostUrl(raw.originalPostUrl), 5000)) || '';
        }
        return {
          author: raw.author,
          text: finalText,
          image: raw.image,
          originalPostUrl: raw.originalPostUrl,
          platform: 'Instagram',
          imageElementId: raw.imageElementId,
          isPublic: true,
          privacyInfo: { isPublic: true, reason, confidence: 'medium', username: raw.username },
          privacyReason: reason
        };
      } catch { return null; }
    }));
    return results.filter(Boolean);
  }
  
  console.log(`Starting enhanced scroll and scrape for ${site} with ${passes} pass(es)`);

  function runSinglePass(passMs) {
    const start = Date.now();
    console.error(`=== runSinglePass STARTED for ${site}, duration: ${passMs}ms ===`);
    return new Promise((resolve) => {
      const interval = setInterval(() => {
    // Get current post count to detect if new content is loading
    let currentPostCount = 0;
    if (site === 'linkedin') {
      // Count actual post divs (same selector as scraping)
      const possiblePosts = document.querySelectorAll('div[componentkey*="urn:li:activity:"]');
      const visiblePosts = Array.from(possiblePosts).filter(el => {
        try {
          const rect = el.getBoundingClientRect();
          return rect.height > 200 && rect.width > 300;
        } catch {
          return false;
        }
      });
      currentPostCount = visiblePosts.length;
      
      // Log progress every 10 attempts
      if (scrollAttempts % 10 === 0) {
        console.error(`🔍 LinkedIn scrolling: Found ${possiblePosts.length} post divs, ${currentPostCount} visible (h>200, w>300)`);
      }
      
      // NO CLICKING - just scroll like Instagram!
    } else if (site === 'instagram') {
      // Instagram-specific counting with better detection
      const igSelectors = [
        'article',
        '[role="article"]', 
        'div[style*="flex-direction: column"]'
      ];
      
      for (const selector of igSelectors) {
        const elements = document.querySelectorAll(selector);
        // Filter to actual posts (with media and author)
        const actualPosts = Array.from(elements).filter(post => {
          const hasMedia = post.querySelector('img, video');
          const hasAuthor = post.querySelector('a[href*="/"]');
          const isNotNav = !post.closest('nav') && !post.closest('[role="navigation"]');
          return hasMedia && hasAuthor && isNotNav;
        });
        currentPostCount = actualPosts.length;
        // Collect posts visible now to avoid losing them later (virtualized DOM)
        actualPosts.forEach(el => {
          const raw = extractIgRawFromElement(el);
          if (raw && !igCollected.has(raw.key)) igCollected.set(raw.key, raw);
        });
        if (currentPostCount > 0) break;
      }
    }
    
    scrollAttempts++;
    
    // Instagram needs different scrolling strategy than LinkedIn
    if (site === 'instagram') {
      // Instagram lazy loading is more aggressive - use varied scroll patterns
      if (scrollAttempts % 4 === 0) {
        // Every 4th attempt, scroll more aggressively
        window.scrollBy(0, 1200);
        setTimeout(() => window.scrollBy(0, 600), 200);
      } else if (currentPostCount === lastPostCount) {
        stuckCount++;
        // If stuck, try different scroll amounts
        if (stuckCount > 2) {
          window.scrollBy(0, 1600);
          setTimeout(() => window.scrollBy(0, -300), 300); // Slight back-scroll
          setTimeout(() => window.scrollBy(0, 800), 600);
        } else {
          window.scrollBy(0, 800);
        }
      } else {
        stuckCount = 0;
        window.scrollBy(0, 600); // Normal Instagram scroll
      }
      
      // Instagram sometimes needs pause for content to load
      if (scrollAttempts % 6 === 0) {
        // Every 6th attempt, pause briefly for content loading
        setTimeout(() => {
          console.log(`Instagram loading pause - currently ${currentPostCount} posts`);
        }, 800);
      }
    } else {
      // LinkedIn scrolling - simple and clean
      if (currentPostCount === lastPostCount) {
        stuckCount++;
        smartScrollLinkedIn(stuckCount > 3 ? 1000 : 500);
        if (stuckCount > 5) {
          setTimeout(() => smartScrollLinkedIn(200), 100);
          setTimeout(() => smartScrollLinkedIn(300), 200);
        }
      } else {
        stuckCount = 0;
        smartScrollLinkedIn(300);
      }
    }
    
    lastPostCount = currentPostCount;
    console.log(`${site}: Found ${currentPostCount} posts, stuck count: ${stuckCount}, scroll attempts: ${scrollAttempts}`);

    // Periodically force-load more for Instagram by clicking "Show more"/"Load more" patterns
    if (site === 'instagram' && scrollAttempts % 10 === 0) {
      try {
        const buttons = Array.from(document.querySelectorAll('button, a'))
          .filter(el => /show more|load more|meer|meer weergeven/i.test(el.textContent || ''));
        if (buttons.length) {
          buttons[0].click();
          console.log('Clicked an IG load-more like button');
        }
      } catch {}
    }
    
        // Check if we should finish this pass
        if (Date.now() - start > passMs) {
          clearInterval(interval);
          // Wait longer for Instagram content to load
          const waitTime = site === 'instagram' ? 3000 : 2000;
          setTimeout(resolve, waitTime);
        }
      }, site === 'instagram' ? 250 : 400); // LinkedIn needs more time between scroll checks
    });
  }

  (async () => {
    if (site === 'linkedin') {
      // Wait for feed to load
      await waitForLinkedInFeed(6000);
      
      // Prewarm: a few quick scrolls to trigger lazy loading
      for (let i = 0; i < 3; i++) {
        smartScrollLinkedIn(800);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    if (isInstagram && passes > 1) {
      for (let i = 0; i < passes; i++) {
        console.log(`IG pass ${i+1}/${passes} starting for ${Math.round(passDurationMs/1000)}s`);
        await runSinglePass(passDurationMs);
        if (i < passes - 1 && coolDownMs > 0) {
          console.log(`Cooldown ${coolDownMs}ms between passes`);
          await new Promise(r => setTimeout(r, coolDownMs));
          window.scrollBy(0, -200);
          setTimeout(() => window.scrollBy(0, 300), 200);
        }
      }
    } else {
      await runSinglePass(durationMs);
    }

    console.error(`✅ Finished scrolling ${site}. Starting final scraping...`);
    console.error(`===========================================`);

    let scrapedData = [];
    if (site === 'linkedin') {
      console.error(`📊 Starting LinkedIn scraping now...`);
      
      // Scroll to bottom to ensure all posts are in DOM
      const container = getLinkedInScrollContainer();
      if (container && container !== window) {
        console.error(`  → Scrolling container to bottom before scraping...`);
        container.scrollTo(0, container.scrollHeight);
        await new Promise(r => setTimeout(r, 1000));
        
        // Then scroll to top so we can see all posts (some might be lazy-loaded)
        console.error(`  → Scrolling back to top...`);
        container.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 1000));
      }
      
      // Wait extra time for LinkedIn to render content
      console.error(`  → Waiting 3s for content to fully render...`);
      await new Promise(r => setTimeout(r, 3000));
      
      scrapedData = await scrapeLinkedInContent();
    } else if (site === 'instagram') {
      console.log('Finalizing Instagram posts (incremental + final scrape)');
      const incremental = await finalizeIgCollected();
      const endScrape = await scrapeInstagramContent();
      // Merge & dedupe by URL
      const byUrl = new Map();
      incremental.concat(endScrape).forEach(p => {
        const k = p.originalPostUrl || p.imageElementId || Math.random().toString(36);
        if (!byUrl.has(k)) byUrl.set(k, p);
      });
      scrapedData = Array.from(byUrl.values());
    } else {
      console.error('Unknown site:', site);
      scrapedData = [];
    }
    console.log(`Scraping completed for ${site}, got ${scrapedData.length} posts`);

    // Wait for final items to finish loading
    await new Promise(r => setTimeout(r, 800));

    console.error(`🎯 Final result for ${site}: ${scrapedData.length} posts scraped`);
    console.error(`⏳ Keeping tab open for 5 seconds so you can see the logs above...`);

    chrome.runtime.sendMessage({ 
      action: 'showScrapeResult', 
      site: site,
      data: scrapedData,
      positiveInput,
      negativeInput,
      remainingSites,
      scrapeTabId: scrapeTabId
    });

    // WAIT 5 seconds so user can see the scraping logs before tab closes
    await new Promise(r => setTimeout(r, 5000));
    
    console.error(`✅ Done! Closing tab now...`);

    chrome.runtime.sendMessage({ 
      type: 'RESTORE_AND_CLOSE_TAB',
      prevTabId: prevTabId,
      scrapeTabId: scrapeTabId
    });
  })();
}

function extractUsernameFromLink(url) {
  try {
    const inMatch = url.match(/\/in\/([^\/]+)\//);
    const postsMatch = url.match(/\/posts\/([^_]+)_/);
    
    return (inMatch && inMatch[1]) || (postsMatch && postsMatch[1]) || null;
  } catch (error) {
    console.error('Error extracting username:', error);
    return null;
  }
}

// BULLETPROOF Privacy detection functions with fail-closed approach
function isLinkedInPostPublic(feedItemRoot) {
  try {
    // 1) Try explicit text labels around the timestamp/actor line
    const visibilitySelectors = [
      '.update-components-actor__sub-description',
      '.update-components-actor__meta', 
      '.feed-shared-actor__sub-description',
      '[data-test-reuse="update-actor-meta"]'
    ];

    let visText = '';
    for (const selector of visibilitySelectors) {
      const element = feedItemRoot.querySelector(selector);
      if (element) {
        visText += ' ' + element.innerText;
      }
    }
    visText = visText.toLowerCase();

    // Explicit public indicators
    if (/\banyone\b/.test(visText)) {
      console.log('LinkedIn post marked as public via "Anyone" text');
      return { isPublic: true, reason: 'explicit_anyone_text', confidence: 'high' };
    }
    
    // Explicit private indicators - FAIL CLOSED
    if (/\bconnections\b|\bgroup\b|\bcompany\b|\bfollowers\b|\blogged-?in\b/.test(visText)) {
      console.log('LinkedIn post marked as private via visibility text:', visText);
      return { isPublic: false, reason: 'explicit_private_text', confidence: 'high' };
    }

    // 2) Icon heuristic (globe icon often marks public)
    const globeSelectors = [
      'li-icon[type*="globe"]',
      'svg[aria-label*="Anyone"]', 
      'svg[aria-label*="Public"]',
      '[data-test-icon="globe-icon"]'
    ];
    
    for (const selector of globeSelectors) {
      const hasGlobe = feedItemRoot.querySelector(selector);
      if (hasGlobe) {
        console.log('LinkedIn post marked as public via globe icon');
        return { isPublic: true, reason: 'globe_icon', confidence: 'high' };
      }
    }

    // 3) Check for connection indicators - PRIVATE
    const connectionIndicators = [
      '1st', 'first', '2nd', 'second', '3rd', 'third', 
      'connection', 'mutual', 'colleague'
    ];
    
    for (const indicator of connectionIndicators) {
      if (visText.includes(indicator)) {
        console.log('LinkedIn post marked as private via connection indicator:', indicator);
        return { isPublic: false, reason: 'connection_indicator', confidence: 'high' };
      }
    }

    // 4) Check for private/restricted icons
    const privateIconSelectors = [
      '[data-test-id*="privacy"]',
      '[aria-label*="private"]',
      '[aria-label*="connection"]',
      '.privacy-icon',
      '[data-control-name*="privacy"]',
      'li-icon[type*="lock"]',
      'svg[aria-label*="Connections"]'
    ];

    for (const selector of privateIconSelectors) {
      const element = feedItemRoot.querySelector(selector);
      if (element) {
        console.log('LinkedIn post marked as private via privacy icon');
        return { isPublic: false, reason: 'privacy_icon', confidence: 'high' };
      }
    }

    console.log('LinkedIn post privacy status unknown - will require verification');
    return null; // unknown → requires verification
    
  } catch (error) {
    console.error('Error detecting LinkedIn privacy:', error);
    return null; // unknown due to error → requires verification
  }
}

function findResharedBlock(feedItemRoot) {
  return feedItemRoot.querySelector('.update-components-reshare, [data-test-reuse="reshare"]');
}

function getLinkedInPermalink(feedItemRoot) {
  // Look for obvious anchors
  const selectors = [
    'a[href*="/feed/update/"]',
    'a[href*="/posts/"]', 
    'a[href*="/activity-"]',
    '[data-control-name="overlay_actor_image"] a',
    '[data-control-name="actor_container"] a'
  ];
  
  for (const selector of selectors) {
    const a = feedItemRoot.querySelector(selector);
    if (a && a.href) {
      try {
        return new URL(a.href).toString();
      } catch (e) {
        console.warn('Invalid LinkedIn URL:', a.href);
      }
    }
  }
  
  console.warn('No LinkedIn permalink found for post');
  return null;
}

// Legacy function for backward compatibility - now uses new bulletproof system
function detectLinkedInPrivacy(postElement) {
  const result = isLinkedInPostPublic(postElement);
  
  if (result === null) {
    // Unknown - will need verification, but for legacy compatibility return uncertain
    return {
      isPublic: false, // FAIL CLOSED - assume private if uncertain
      reason: 'unknown_requires_verification',
      confidence: 'low'
    };
  }
  
  return {
    isPublic: result.isPublic,
    reason: result.reason,
    confidence: result.confidence
  };
}



// Instagram privacy detection with API check and fail-closed approach
const IG_APP_ID = '936619743392459'; // commonly required header
const instagramPrivacyCache = new Map(); // Cache privacy results
const linkedinPrivacyCache = new Map(); // Cache LinkedIn verification results

// Verification functions that communicate with background script
async function verifyLinkedInPublic(permalink) {
  if (!permalink) return false;
  
  // Check cache first
  const cached = linkedinPrivacyCache.get(permalink);
  if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 minute cache
    console.log('Using cached LinkedIn verification result for:', permalink, cached.isAccessible);
    return cached.isAccessible;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      type: 'VERIFY_PUBLIC_LINKEDIN', 
      url: permalink 
    });
    
    const isAccessible = response?.ok || false;
    
    // Cache the result
    linkedinPrivacyCache.set(permalink, {
      isAccessible: isAccessible,
      timestamp: Date.now()
    });
    
    console.log('LinkedIn post verification result:', permalink, isAccessible);
    return isAccessible;

  } catch (error) {
    console.error('Error verifying LinkedIn post:', error);
    return false; // fail closed
  }
}

async function verifyInstagramPublic(username) {
  if (!username) return false;
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      type: 'VERIFY_PUBLIC_IG_PROFILE', 
      username: username 
    });
    
    const isAccessible = response?.ok || false;
    console.log('Instagram profile verification result:', username, isAccessible);
    return isAccessible;
    
  } catch (error) {
    console.error('Error verifying Instagram profile:', error);
    return false; // fail closed
  }
}

function getInstagramUsernameFromPost(postEl) {
  try {
    // Works for feed cards and reels tiles in the home timeline
    const selectors = [
      'header a[href^="/"][href*="/"] span',
      'header a[href^="/"]',
      'article a[href^="/"][role="link"]',
      '[data-testid="user-avatar"] + div a'
    ];
    
    for (const selector of selectors) {
      const element = postEl.querySelector(selector);
      if (element) {
        const href = element.getAttribute('href') || element.closest('a')?.getAttribute('href');
        if (href) {
          // hrefs look like "/some_user/"
          const match = href.match(/^\/([^\/]+)\/$/);
          if (match) {
            console.log('IG username extracted via selector:', selector, '→', match[1]);
            return match[1];
          }
        }
      }
    }
    
    console.warn('Could not extract Instagram username from post');
    return null;
  } catch (error) {
    console.error('Error extracting Instagram username:', error);
    return null;
  }
}

async function isInstagramAccountPublic(username) {
  if (!username) return null;
  
  // Check cache first
  const cacheKey = `ig_${username}`;
  const cached = instagramPrivacyCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 minute cache
    console.log('Using cached Instagram privacy result for:', username, cached.isPublic);
    return cached.isPublic;
  }
  
  try {
    console.log('Checking Instagram account privacy for:', username);
    const response = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
      headers: { 'x-ig-app-id': IG_APP_ID },
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.warn('Instagram API request failed:', response.status);
      return null; // unknown → fail closed
    }
    
    const data = await response.json();
    const isPublic = data?.data?.user?.is_private === false;
    
    // Cache the result
    instagramPrivacyCache.set(cacheKey, {
      isPublic: isPublic,
      timestamp: Date.now()
    });
    
    console.log('Instagram account', username, 'is public:', isPublic);
    return isPublic;
    
  } catch (error) {
    console.error('Error checking Instagram account privacy:', error);
    return null; // unknown → fail closed
  }
}

// Fallback: fetch the post page and parse OpenGraph/meta description for caption
async function fetchInstagramCaptionFromPostUrl(postUrl) {
  try {
    if (!postUrl) return null;
    const res = await fetch(postUrl, { credentials: 'omit' });
    if (!res.ok) return null;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let content = (doc.querySelector('meta[property="og:description"]')?.getAttribute('content'))
      || (doc.querySelector('meta[name="description"]')?.getAttribute('content'))
      || '';
    if (!content) return null;
    // Common pattern: "<author> on Instagram: “<caption>”"
    const matchQuoted = content.match(/[“\"][^”\"]+[”\"]/);
    if (matchQuoted && matchQuoted[0]) {
      return matchQuoted[0].replace(/[“”\"]/g, '').trim();
    }
    // Fallback: try text after first colon
    const idx = content.indexOf(':');
    if (idx !== -1 && idx + 1 < content.length) {
      return content.slice(idx + 1).replace(/^[\s\-–—\"']+/, '').trim();
    }
    return content.trim();
  } catch (e) {
    console.warn('Failed to fetch IG caption from post URL:', e);
    return null;
  }
}

// Legacy function for backward compatibility - now uses FAIL CLOSED approach
function detectInstagramPrivacy(postElement) {
  // FAIL CLOSED: Assume private unless we can definitively prove it's public
  const privacyInfo = {
    isPublic: false, // FAIL CLOSED - assume private by default
    reason: 'unknown_requires_verification',
    confidence: 'low'
  };

  try {
    // Check for private account indicators
    const authorLink = postElement.querySelector('a[href^="/"]');
    if (authorLink) {
      const href = authorLink.getAttribute('href');
      
      // Check if this is a private account post by looking for lock icons or indicators
      const privacyIndicators = [
        '[aria-label*="private"]',
        '[data-testid*="private"]',
        '.private-account-icon',
        '[title*="private"]'
      ];

      for (const selector of privacyIndicators) {
        const element = postElement.querySelector(selector);
        if (element) {
          privacyInfo.isPublic = false;
          privacyInfo.reason = 'private_account';
          privacyInfo.confidence = 'high';
          break;
        }
      }
    }

    // Check for "Close Friends" story indicators (green ring, etc.)
    const closeFriendsIndicators = [
      '[data-testid*="close-friends"]',
      '.close-friends-indicator',
      '[style*="rgb(30, 215, 96)"]', // Instagram's close friends green color
      '[aria-label*="close friends"]'
    ];

    for (const selector of closeFriendsIndicators) {
      const element = postElement.querySelector(selector);
      if (element) {
        privacyInfo.isPublic = false;
        privacyInfo.reason = 'close_friends';
        privacyInfo.confidence = 'high';
        break;
      }
    }

    // Check for verification badge - verified accounts are usually public
    const verificationBadge = postElement.querySelector('[data-testid*="verified"], [aria-label*="verified"], .verified-badge');
    if (verificationBadge) {
      privacyInfo.isPublic = true;
      privacyInfo.reason = 'verified_account';
      privacyInfo.confidence = 'high';
    }

    // Check for business account indicators
    const businessIndicators = [
      '[data-testid*="business"]',
      '[aria-label*="business"]',
      '.business-badge'
    ];

    for (const selector of businessIndicators) {
      const element = postElement.querySelector(selector);
      if (element) {
        privacyInfo.isPublic = true;
        privacyInfo.reason = 'business_account';
        privacyInfo.confidence = 'high';
        break;
      }
    }

    // Check URL accessibility - if we can construct a direct URL, it's likely public
    const postUrl = postElement.querySelector('a[href*="/p/"], a[href*="/reel/"]')?.href;
    if (postUrl && postUrl.includes('instagram.com')) {
      privacyInfo.isPublic = true;
      privacyInfo.reason = 'accessible_url';
      privacyInfo.confidence = 'medium';
    }

  } catch (error) {
    console.error('Error in Instagram privacy detection:', error);
    privacyInfo.confidence = 'low';
  }

  return privacyInfo;
} 

// Overlay rendering for displaying images in-page
let overlayRoot = null;

function ensureOverlay() {
  if (overlayRoot) return overlayRoot;
  const host = document.createElement('div');
  host.id = 'scroll4me-overlay-host';
  host.style.cssText = `
    position: fixed; top: 0; right: 0; height: 100vh; width: 420px;
    z-index: 999999; pointer-events: auto; 
  `;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .panel { box-sizing: border-box; height: 100vh; overflow:auto; 
             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
             color: black; font-family: 'IBM Plex Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; 
             border-left: 1px solid #222; padding: 20px; }
    .card { background: rgba(255, 255, 255, 0.2); margin: 16px 0; padding: 16px; border-radius: 10px; 
            border: 1px solid black; backdrop-filter: blur(10px); }
    .meta { font-size: 12px; margin-bottom: 8px; font-weight: 600; }
    .platform-badge { display: inline-block; padding: 4px 8px; background: rgba(255, 255, 255, 0.3); 
                     border-radius: 6px; margin-right: 8px; font-size: 11px; }
    .author { font-weight: bold; font-size: 16px; margin-bottom: 8px; }
    .summary { margin-bottom: 8px; line-height: 1.4; font-size: 14px; }
    .img { width: 100%; border-radius: 8px; display: block; margin: 12px 0; max-height: 200px; object-fit: cover; }
    .link { color: #666; text-decoration: underline; font-style: italic; font-size: 12px; 
            display: inline-block; margin-top: 8px; }
    .link:hover { color: black; }
    .close { position: sticky; top: 0; display: block; margin: -20px -20px 16px -20px; padding: 12px 20px; 
             background: rgba(255, 255, 255, 0.9); border-bottom: 1px solid black; backdrop-filter: blur(10px); }
    .btn { background: rgba(255, 255, 255, 0.2); border: 1px solid black; border-radius: 10px; 
           padding: 8px 16px; color: black; cursor: pointer; font-family: 'IBM Plex Sans', sans-serif; }
    .btn:hover { background: black; color: white; }
    .title { font-size: 24px; font-weight: 600; margin-bottom: 16px; text-align: center; }
  `;
  const container = document.createElement('div');
  container.className = 'panel';
  container.innerHTML = `
    <div class="close">
      <div class="title">Scroll4Me Results</div>
      <button class="btn" id="s4m-close">Close</button>
    </div>
    <div id="s4m-list"></div>
  `;
  shadow.appendChild(style);
  shadow.appendChild(container);

  shadow.getElementById('s4m-close').addEventListener('click', () => {
    host.remove();
    overlayRoot = null;
  });

  overlayRoot = { shadow, list: shadow.getElementById('s4m-list'), host };
  return overlayRoot;
}

function renderPostsInPage(posts) {
  const { list } = ensureOverlay();
  list.innerHTML = '';
  
  if (!posts || posts.length === 0) {
    list.innerHTML = '<div class="card"><div class="summary">No relevant posts found today.</div></div>';
    return;
  }
  
  posts.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<span class="platform-badge">${p.platform}</span>${p.focusTag ? `🎯 ${p.focusTag}` : ''}`;
    card.appendChild(meta);

    if (p.author) {
      const author = document.createElement('div');
      author.className = 'author';
      author.textContent = p.author;
      card.appendChild(author);
    }

    if (p.openaiSummary || p.text) {
      const summary = document.createElement('div');
      summary.className = 'summary';
      summary.textContent = p.openaiSummary || p.text;
      card.appendChild(summary);
    }

    if (p.platform === 'Instagram' && p.imageElementId) {
      const original = document.querySelector(`[data-s4m-id="${p.imageElementId}"]`);
      if (original) {
        console.log(`Instagram: Cloning original image element: ${p.imageElementId}`);
        const clone = original.cloneNode(true);
        clone.className = 'img';
        clone.removeAttribute('srcset'); // optional: avoid refetching variants
        // keep the same src the page already resolved
        card.appendChild(clone);
      } else if (p.image) {
        console.log(`Instagram: Original element not found, falling back to URL: ${p.imageElementId}`);
        // fallback to URL if the node isn't found
        const img = document.createElement('img');
        img.className = 'img';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'strict-origin-when-cross-origin';
        img.src = p.image;
        img.onerror = () => img.remove();
        card.appendChild(img);
      }
    } else if (p.image) {
      // non-Instagram or no element id: use URL as you do today
      const img = document.createElement('img');
      img.className = 'img';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'strict-origin-when-cross-origin';
      img.src = p.image;
      img.alt = 'Post image';
      img.onerror = () => { 
        console.log(`Failed to load image in overlay: ${p.image}`);
        img.remove(); 
      };
      img.onload = () => {
        console.log(`Successfully loaded image in overlay: ${p.platform} post`);
      };
      card.appendChild(img);
    }

    if (p.originalPostUrl) {
      const a = document.createElement('a');
      a.className = 'link';
      a.href = p.originalPostUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = p.platform === 'Instagram' ? 'View on Instagram' : 'View original post';
      card.appendChild(a);
    }

    list.appendChild(card);
  });
}

// Message listener
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Ping/ack for content script health check
  if (msg && msg.action === 'ping') {
    sendResponse({ pong: true, on: window.location.hostname });
    return true;
  }
  
  if (msg?.type === 'SCROLL_AND_SCRAPE') {
    const { site, totalScrolls, scrollDelay, positiveInput, negativeInput, remainingSites, prevTabId, scrapeTabId } = msg;
    // Convert back to duration for compatibility with existing scrollAndScrape function
    const scrollDuration = Math.ceil(totalScrolls / 5); // Convert scroll count back to duration
    scrollAndScrape(site, positiveInput, negativeInput, scrollDuration, remainingSites, prevTabId, scrapeTabId)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async
  }
  
  if (msg?.type === 'S4M_RENDER_IN_PAGE' && Array.isArray(msg.posts)) {
    console.log('Content script received render request for', msg.posts.length, 'posts on', window.location.hostname);
    renderPostsInPage(msg.posts);
    sendResponse({ ok: true });
    return true;
  }
}); 