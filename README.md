Scroll4Me (Chrome Extension)

Overview
Scroll4Me automates a short, focused scroll on LinkedIn and Instagram, collects public posts, filters them with OpenAI, and shows a concise stack of cards so you can stop doomscrolling and get on with your day.

What it does
- Opens your selected feeds (LinkedIn, Instagram) in an active tab (sequentially)
- Performs a brief, automated scroll to load posts
- Scrapes author, caption/text, main image, and original post URL (public content only)
- Batches posts to OpenAI (JSON output) and selects a small, high‑signal set
- Displays a clean stacked‑card UI with quick links back to the original posts

Privacy & data handling
- Only public content is included.
  - LinkedIn: exclude only when explicitly private; otherwise include.
  - Instagram: include when the account/post is public or post page is accessible (fail‑closed otherwise).
- No data is uploaded or persisted outside your machine. The OpenAI prompt includes truncated text and a hasImage boolean; no private data is sent.
- Your OpenAI key is stored locally (chrome.storage.local); calls are relayed via the background worker to avoid CORS.

Requirements
- Google Chrome (MV3 extensions)
- Logged into LinkedIn/Instagram in your regular browser window
- OpenAI API key (required)

API key setup (required)
- You must supply your own OpenAI API key. It is never committed to git.
- Preferred: In the extension UI, go to Profile → API Key, paste your key, and click Save. The key is stored locally on your machine in chrome.storage.local.
- Optional (dev-only): For local testing, you can temporarily hardcode your key:
  - Edit popup.js and set: const TRIAL_OPENAI_KEY = 'put your API key here';
  - Do not commit this change. Keep the placeholder when pushing to git.
- If no valid key is present or OpenAI returns an error, the app falls back to local scoring and still renders cards (reduced quality).

Install (developer mode)
1) chrome://extensions → Enable “Developer mode”
2) “Load unpacked” → select this folder
3) Click the extension icon (or the toolbar action) to open the app

Key files
- manifest.json: MV3 manifest, permissions and host_permissions
- background.js: Service worker; tab restore/close; public‑access verification; OpenAI proxy (chat/completions)
- content.js: Injected into linkedin.com and instagram.com; scrolling, extraction, privacy checks; sends results back
- popup.html: UI screens (onboarding, waiting/progress, animation, cards, profile)
- popup.js: Orchestration, storage, durations, batching to OpenAI, rendering

How to use
1) Onboarding
   - Select platforms (LinkedIn/Instagram)
   - Choose daily tags and optional weekly rules per platform
   - Finish to save your Focus Profile in chrome.storage.local

2) Daily run
   - Open the app and click “Scroll for me”
   - The extension opens one active tab per selected platform (sequentially)
   - You’ll see a progress indicator; when both sites finish, cards appear

Durations (defaults)
- Instagram: multi‑pass short scrolls
  - 7 passes × 10s each, ~3s settle per pass, 600ms cool‑downs
  - Effective scrolling phase ≈ ~1:35 total
  - Config: popup.js (multiPass object for Instagram)
- LinkedIn: single duration via getScrollDurationSeconds()
  - Default 120 seconds (2 minutes)
  - Config: popup.js → getScrollDurationSeconds()

Filtering with OpenAI
- Model: gpt‑4o‑mini
- Batch size: 8 posts per request (prompt includes Focus Profile and Today’s inputs)
- Response: JSON → {"relevant_posts": [...]}
- Selection cap: 10% of analyzed posts (round up), diversified, deduped
- Fallback: local scoring if the API fails
- Platform rule: If Instagram is selected, prefer at least one Instagram post when relevant

What gets scraped
- author (best‑effort display name/username)
- text (caption or extracted text, truncated in prompt)
- image (largest viable image; for Instagram we keep a handle to clone the exact node where possible)
- originalPostUrl
- platform (LinkedIn/Instagram)

Where things happen
- OpenAI proxy: background.js (message type: OPENAI_CHAT_COMPLETIONS)
- Scrolling & scraping: content.js → scrollAndScrape(...)
- Instagram multi‑pass: popup.js (multiPass config) → content.js runner
- LinkedIn scroll: window.scrollBy(...) with stuck handling
- Privacy checks:
  - LinkedIn: exclude explicit private items; otherwise include
  - Instagram: account/post public checks and logged‑out fetch fallback

Permissions
- tabs, scripting, activeTab, storage
- host_permissions: linkedin.com, instagram.com (and image CDNs), api.openai.com

Troubleshooting
- Instagram returns very few posts
  - The feed is virtualized; the extension now captures posts incrementally during scrolling and merges at the end.
  - If still small, slightly increase passes or settle time.

- LinkedIn doesn’t scroll
  - Ensure the opened URL is https://www.linkedin.com/feed/
  - Overlays/lightboxes are auto‑closed; try again if a modal appears.
  - Duration is from getScrollDurationSeconds(); increase if needed.

- OpenAI/CORS errors
  - Calls are proxied via background.js; ensure api.openai.com is in host_permissions
  - Add your key in Profile; if empty, the app falls back to limited local scoring

Configuration knobs (developer)
- popup.js
  - getScrollDurationSeconds(): LinkedIn scroll duration (seconds)
  - Instagram multi‑pass object (passes, passDurationSeconds, coolDownMs)
  - processBatchWithChatGPT(): model, batch size (8), max_tokens, selection cap (10%)
- content.js
  - Scrapers and privacy rules
  - Post extraction (author/text/image/url)
- background.js
  - Public‑access checks; OpenAI request relay

CO₂ note (modal)
- The modal explains that a short automated load + AI filtering typically uses fewer posts/data than an hour of manual doomscrolling, and the added AI cost is small in comparison.

Manual test checklist
1) Onboarding
   - Select platforms and tags → Finish
2) Daily run
   - Click “Scroll for me”; observe LinkedIn and Instagram tabs open and close
   - Check the console: “LinkedIn scrape results”, “Instagram scrape results”, “All sites completed! Combined posts”, “OpenAI prompt/result”
3) Results
   - Cards show authors, short summaries, platform badges, images where available
   - “View original post” opens the correct link
4) Error paths
   - No API key: app falls back to local scoring and returns a minimal set
   - API/network error: progress shows a fallback message; cards still render

License
- Experimental, non‑profit project. No warranty.
