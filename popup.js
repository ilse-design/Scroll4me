const urls = {
  // Use the main feed per user preference
  linkedin: 'https://www.linkedin.com/feed/',
  instagram: 'https://www.instagram.com/',
  news: 'https://www.bbc.com/news/'
};

// Onboarding flow state
let onboardingData = {
  selectedPlatforms: [],
  linkedinTags: [],
  linkedinWeeklyRules: [],
  instagramTags: [],
  instagramWeeklyRules: [],
  dailyScrollTime: 45
};

// Temporary demo mode for screen recording (set to false to disable)
const DEMO_MODE = false;

// Free trial: provide Ilse's shared API key for first 5 sessions (stored locally only)
const TRIAL_OPENAI_KEY = 'put your API key here';

function getDemoPosts() {
  return [
    // LinkedIn (5)
    {
      platform: 'LinkedIn',
      author: 'waag-society',
      text: 'Citizen science expo – meet and explore.',
      openaiSummary: 'Citizen science expo – meet and explore.',
      originalPostUrl: 'https://www.linkedin.com/posts/waag-society_citizenscience-kennismaken-expo-activity-7366397172331741187-Mtgp?utm_source=share&utm_medium=member_desktop&rcm=ACoAABjpQYoBEKLA7YatprXQV0X54Xon7GY2sp0',
      focusTag: 'Event',
      image: chrome.runtime.getURL('post1.jpeg')
    },
    {
      platform: 'LinkedIn',
      author: 'nathan-pottier',
      text: "Master's thesis announcement.",
      openaiSummary: "Master's thesis announcement.",
      originalPostUrl: 'https://www.linkedin.com/posts/nathan-pottier-1749a3176_glad-to-announce-that-my-masters-thesis-at-activity-7366386335395262464-KSbY?utm_source=share&utm_medium=member_desktop&rcm=ACoAABjpQYoBEKLA7YatprXQV0X54Xon7GY2sp0',
      focusTag: 'Inspiration',
      image: chrome.runtime.getURL('post2.jpeg')
    },
    {
      platform: 'LinkedIn',
      author: 'amsterdam-dance-event',
      text: 'ADE Arts & Culture unfolds.',
      openaiSummary: 'ADE Arts & Culture unfolds.',
      originalPostUrl: 'https://www.linkedin.com/posts/amsterdam-dance-event_a-new-wave-of-ade-arts-culture-unfolds-ugcPost-7364629416598994944-nBfA?utm_source=share&utm_medium=member_desktop&rcm=ACoAABjpQYoBEKLA7YatprXQV0X54Xon7GY2sp0',
      focusTag: 'Event',
      image: chrome.runtime.getURL('post3.jpeg')
    },
    {
      platform: 'LinkedIn',
      author: 'cyjilllin',
      text: 'LEGO design leadership – interactive play.',
      openaiSummary: 'LEGO design leadership – interactive play.',
      originalPostUrl: 'https://www.linkedin.com/posts/cyjilllin_lego-designleadership-interactiveplay-activity-7365579856333398016-g4wQ?utm_source=share&utm_medium=member_desktop&rcm=ACoAABjpQYoBEKLA7YatprXQV0X54Xon7GY2sp0',
      focusTag: 'Jobs',
      image: chrome.runtime.getURL('post4.jpeg')
    },
    {
      platform: 'LinkedIn',
      author: 'studio-falkland',
      text: 'Packet Run exhibited at OYFO Techniekmuseum.',
      openaiSummary: 'Packet Run exhibited at OYFO Techniekmuseum.',
      originalPostUrl: 'https://www.linkedin.com/posts/studio-falkland_packet-run-is-now-exhibited-at-oyfo-techniekmuseum-activity-7358501271168815104-RZ0R?utm_source=share&utm_medium=member_desktop&rcm=ACoAABjpQYoBEKLA7YatprXQV0X54Xon7GY2sp0',
      focusTag: 'Inspiration',
      image: chrome.runtime.getURL('post5.jpeg')
    },
    // Instagram (5)
    {
      platform: 'Instagram',
      author: 'unknown',
      originalPostUrl: 'https://www.instagram.com/reel/DNfRPHeMBnk/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==',
      focusTag: 'Culture'
    },
    {
      platform: 'Instagram',
      author: 'unknown',
      originalPostUrl: 'https://www.instagram.com/reel/DLF_AQyO7jG/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==',
      focusTag: 'Art'
    },
    {
      platform: 'Instagram',
      author: 'unknown',
      originalPostUrl: 'https://www.instagram.com/p/DN0y7u4WE-Y/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==',
      focusTag: 'Sport'
    },
    {
      platform: 'Instagram',
      author: 'unknown',
      originalPostUrl: 'https://www.instagram.com/p/DNVmIuGIKlm/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==',
      focusTag: 'Art'
    },
    {
      platform: 'Instagram',
      author: 'unknown',
      originalPostUrl: 'https://www.instagram.com/p/DNyVRKz2svK/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==',
      focusTag: 'Event'
    }
  ];
}

// Centralized scroll duration (in seconds)
function getScrollDurationSeconds() {
  return 40; // ~40 seconds per platform (collects ~250 LinkedIn posts)
}

// Restrict console.log output to only key events
(function() {
  const isAllowed = (firstArg) => {
    if (typeof firstArg !== 'string') return false;
    return firstArg.startsWith('LinkedIn scrape results') ||
           firstArg.startsWith('Instagram scrape results') ||
           firstArg.startsWith('Combined scrape results') ||
           firstArg.startsWith('All sites completed! Combined posts') ||
           firstArg.startsWith('OpenAI prompt:') ||
           firstArg.startsWith('OpenAI result:') ||
           firstArg.includes('z-index set to');
  };
  const originalLog = console.log.bind(console);
  console.log = (...args) => {
    try {
      if (isAllowed(args[0])) originalLog(...args);
    } catch {}
  };
})();

// Check if user is new and needs onboarding
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['hasCompletedOnboarding'], function(result) {
    if (result.hasCompletedOnboarding) {
      // Show daily start screen
      showScreen('daily-start');
      // Initialize trial counter display on landing
      updateTrialCounterDisplay();
    } else {
      // Show onboarding
      showScreen('onboarding-welcome');
    }
  });
});

// Onboarding navigation functions
function nextScreen(screenId) {
  showScreen(screenId);
}

function previousScreen(screenId) {
  showScreen(screenId);
}

// Modal functions
function showPromptModal() {
  document.getElementById('prompt-modal').style.display = 'flex';
}

function showCo2Modal() {
  document.getElementById('co2-modal').style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// Utility to set z-index and interactivity for a card deck element
function applyZOrderAndInteractivityToDeck(cardDeckElement) {
  const cards = Array.from(cardDeckElement.children).filter(c => c.style.display !== 'none');
  const total = cards.length;
  cards.forEach((c, i) => {
    c.style.zIndex = String(total - i);
    c.style.pointerEvents = i === 0 ? 'auto' : 'none';
  });
}

// Time savings calculation
function calculateTimeSavings() {
  const selectedTime = parseInt(document.getElementById('daily-scroll-time').value);
  onboardingData.dailyScrollTime = selectedTime;
  
  const appUsage = 5; // 5 minutes with the app
  const dailySaved = selectedTime - appUsage;
  const weeklySaved = dailySaved * 7;
  const monthlySaved = dailySaved * 30;
  const yearlySaved = dailySaved * 365;
  
  // Format time display
  function formatTime(minutes) {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes`;
  }
  
  function formatLargeTime(minutes) {
    const hours = Math.round(minutes / 60 * 10) / 10;
    if (hours < 24) return `${hours} hours`;
    const days = Math.round(hours / 24 * 10) / 10;
    return `${days} days`;
  }
  
  document.getElementById('daily-savings').textContent = `${formatTime(dailySaved)} per day`;
  document.getElementById('weekly-savings').textContent = `${formatTime(weeklySaved)} per week`;
  document.getElementById('monthly-savings').textContent = `${formatLargeTime(monthlySaved)} per month`;
  document.getElementById('yearly-savings').textContent = `${formatLargeTime(yearlySaved)} per year`;
  
  nextScreen('onboarding-savings');
}

// Platform selection
function proceedToPlatformSetup() {
  const selectedPlatforms = [];
  const linkedinChecked = document.getElementById('linkedin-checkbox').checked;
  const instagramChecked = document.getElementById('instagram-checkbox').checked;
  
  if (linkedinChecked) selectedPlatforms.push('linkedin');
  if (instagramChecked) selectedPlatforms.push('instagram');
  
  if (selectedPlatforms.length === 0) {
    alert('Please select at least one platform to continue');
    return;
  }
  
  onboardingData.selectedPlatforms = selectedPlatforms;
  
  // Go to LinkedIn setup if LinkedIn is selected
  if (linkedinChecked) {
    nextScreen('onboarding-linkedin');
  } else if (instagramChecked) {
    // Skip to Instagram if only Instagram is selected
    nextScreen('onboarding-instagram');
  }
}

// Tag selection functionality
function initializeTagSelection() {
  console.log('Initializing tag selection with current profile data...');
  console.log('Current onboardingData:', onboardingData);
  
  // LinkedIn tags
  const linkedinTags = document.querySelectorAll('#linkedin-tags .tag:not(.add-tag)');
  console.log('Found LinkedIn tags:', linkedinTags.length);
  
  linkedinTags.forEach((tag, index) => {
    console.log(`Processing LinkedIn tag ${index}:`, tag.dataset.tag, tag.textContent);
    
    // Remove existing selection first
    tag.classList.remove('selected');
    
    // Remove any existing event listeners by cloning the element
    const newTag = tag.cloneNode(true);
    tag.parentNode.replaceChild(newTag, tag);
    
    // Add fresh click event listener
    newTag.addEventListener('click', function(e) {
      console.log('LinkedIn tag clicked:', this.dataset.tag);
      this.classList.toggle('selected');
      updateSelectedTags('linkedin');
    });
    
    // Pre-select if this tag was in the current profile
    if (onboardingData.linkedinTags && onboardingData.linkedinTags.includes(newTag.dataset.tag)) {
      newTag.classList.add('selected');
      console.log('Pre-selected LinkedIn tag:', newTag.dataset.tag);
    }
  });
  
  // Instagram tags
  const instagramTags = document.querySelectorAll('#instagram-tags .tag:not(.add-tag)');
  console.log('Found Instagram tags:', instagramTags.length);
  
  instagramTags.forEach((tag, index) => {
    console.log(`Processing Instagram tag ${index}:`, tag.dataset.tag, tag.textContent);
    
    // Remove existing selection first
    tag.classList.remove('selected');
    
    // Remove any existing event listeners by cloning the element
    const newTag = tag.cloneNode(true);
    tag.parentNode.replaceChild(newTag, tag);
    
    // Add fresh click event listener
    newTag.addEventListener('click', function(e) {
      console.log('Instagram tag clicked:', this.dataset.tag);
      this.classList.toggle('selected');
      updateSelectedTags('instagram');
    });
    
    // Pre-select if this tag was in the current profile
    if (onboardingData.instagramTags && onboardingData.instagramTags.includes(newTag.dataset.tag)) {
      newTag.classList.add('selected');
      console.log('Pre-selected Instagram tag:', newTag.dataset.tag);
    }
  });
  
  // Pre-populate weekly rules if they exist
  populateWeeklyRules();
  
  console.log('Tag selection initialization complete');
}

function populateWeeklyRules() {
  console.log('Populating weekly rules...');
  
  // Clear existing weekly rules display
  const linkedinWeeklyList = document.getElementById('linkedin-weekly-list');
  const instagramWeeklyList = document.getElementById('instagram-weekly-list');
  
  if (linkedinWeeklyList) {
    linkedinWeeklyList.innerHTML = '';
    
    // Add existing LinkedIn weekly rules
    if (onboardingData.linkedinWeeklyRules && onboardingData.linkedinWeeklyRules.length > 0) {
      onboardingData.linkedinWeeklyRules.forEach(rule => {
        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'weekly-rule';
        ruleDiv.innerHTML = `
          <span>${rule.day}: ${rule.text}</span>
          <button type="button" onclick="removeWeeklyRule('linkedin', '${rule.day}')">×</button>
        `;
        linkedinWeeklyList.appendChild(ruleDiv);
        console.log('Added LinkedIn weekly rule:', rule);
      });
    }
  }
  
  if (instagramWeeklyList) {
    instagramWeeklyList.innerHTML = '';
    
    // Add existing Instagram weekly rules
    if (onboardingData.instagramWeeklyRules && onboardingData.instagramWeeklyRules.length > 0) {
      onboardingData.instagramWeeklyRules.forEach(rule => {
        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'weekly-rule';
        ruleDiv.innerHTML = `
          <span>${rule.day}: ${rule.text}</span>
          <button type="button" onclick="removeWeeklyRule('instagram', '${rule.day}')">×</button>
        `;
        instagramWeeklyList.appendChild(ruleDiv);
        console.log('Added Instagram weekly rule:', rule);
      });
    }
  }
}

function updateSelectedTags(platform) {
  const selectedTags = Array.from(document.querySelectorAll(`#${platform}-tags .tag.selected`))
    .map(tag => tag.dataset.tag);
  
  if (platform === 'linkedin') {
    onboardingData.linkedinTags = selectedTags;
  } else {
    onboardingData.instagramTags = selectedTags;
  }
}

function addCustomTag(platform) {
  // Center the prompt by adding CSS to the page temporarily
  const style = document.createElement('style');
  style.textContent = `
    .custom-prompt-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }
    .custom-prompt {
      background: white;
      padding: 24px;
      border-radius: 10px;
      border: 1px solid black;
      text-align: center;
    }
    .custom-prompt input {
      width: 300px;
      padding: 12px;
      border: 1px solid black;
      border-radius: 10px;
      margin: 16px 0;
      font-size: 16px;
    }
    .custom-prompt button {
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid black;
      border-radius: 10px;
      padding: 8px 16px;
      margin: 0 8px;
      cursor: pointer;
      font-size: 16px;
    }
    .custom-prompt button:hover {
      background: black;
      color: white;
    }
  `;
  document.head.appendChild(style);
  
  // Create custom centered prompt
  const overlay = document.createElement('div');
  overlay.className = 'custom-prompt-overlay';
  overlay.innerHTML = `
    <div class="custom-prompt">
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Add Custom Tag</div>
      <input type="text" id="custom-tag-input" placeholder="Enter a custom tag..." autofocus>
      <br>
      <button id="confirm-custom-tag">Add</button>
      <button id="cancel-custom-tag">Cancel</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Focus the input
  setTimeout(() => {
    document.getElementById('custom-tag-input').focus();
  }, 100);
  
  // Add event listeners
  document.getElementById('confirm-custom-tag').addEventListener('click', () => confirmCustomTag(platform));
  document.getElementById('cancel-custom-tag').addEventListener('click', cancelCustomTag);
  
  // Handle Enter key
  document.getElementById('custom-tag-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      confirmCustomTag(platform);
    }
  });
}

function confirmCustomTag(platform) {
  const input = document.getElementById('custom-tag-input');
  const customTag = input.value.trim();
  
  if (customTag) {
    const tagList = document.getElementById(`${platform}-tags`);
    const addButton = tagList.querySelector('.add-tag');
    
    const newTag = document.createElement('div');
    newTag.className = 'tag';
    newTag.dataset.tag = customTag;
    newTag.textContent = customTag;
    newTag.addEventListener('click', function() {
      this.classList.toggle('selected');
      updateSelectedTags(platform);
    });
    // Auto-select the newly added tag
    newTag.classList.add('selected');
    
    tagList.insertBefore(newTag, addButton);

    // Persist selection immediately
    updateSelectedTags(platform);
  }
  
  cancelCustomTag();
}

function cancelCustomTag() {
  const overlay = document.querySelector('.custom-prompt-overlay');
  const style = document.querySelector('style');
  if (overlay) overlay.remove();
  if (style && style.textContent.includes('custom-prompt-overlay')) style.remove();
}

// Weekly rules functionality
function addWeeklyRule(platform) {
  const container = document.getElementById(`${platform}-weekly-rules`);
  const newRule = document.createElement('div');
  newRule.className = 'weekly-rule';
  newRule.innerHTML = `
    <select class="weekly-dropdown">
      <option value="">Select day</option>
      <option value="monday">Monday</option>
      <option value="tuesday">Tuesday</option>
      <option value="wednesday">Wednesday</option>
      <option value="thursday">Thursday</option>
      <option value="friday">Friday</option>
      <option value="saturday">Saturday</option>
      <option value="sunday">Sunday</option>
    </select>
    <input type="text" class="weekly-input" placeholder="What you want to see on this day...">
  `;
  container.appendChild(newRule);
}

function collectWeeklyRules(platform) {
  const rules = [];
  const ruleElements = document.querySelectorAll(`#${platform}-weekly-rules .weekly-rule`);
  
  ruleElements.forEach(rule => {
    const day = rule.querySelector('.weekly-dropdown').value;
    const text = rule.querySelector('.weekly-input').value.trim();
    
    if (day && text) {
      rules.push({ day, text });
    }
  });
  
  return rules;
}

// Save preferences functions
function saveLinkedInPreferences() {
  onboardingData.linkedinWeeklyRules = collectWeeklyRules('linkedin');
  
  // Go to Instagram setup if Instagram is also selected
  if (onboardingData.selectedPlatforms.includes('instagram')) {
    nextScreen('onboarding-instagram');
  } else {
    // Skip to summary if only LinkedIn was selected
    updateSummary();
    nextScreen('onboarding-summary');
  }
}

function saveInstagramPreferences() {
  onboardingData.instagramWeeklyRules = collectWeeklyRules('instagram');
  updateSummary();
  nextScreen('onboarding-summary');
}

// Summary update
function updateSummary() {
  // Daily tags summary
  const allTags = [...onboardingData.linkedinTags, ...onboardingData.instagramTags];
  const dailyTagsText = allTags.length > 0 ? allTags.join(', ') : 'No tags selected';
  document.getElementById('summary-daily-tags').textContent = dailyTagsText;
  
  // Weekly rules summary with capitalized weekdays and line breaks
  const allWeeklyRules = [...onboardingData.linkedinWeeklyRules, ...onboardingData.instagramWeeklyRules];
  let weeklyText = 'No weekly rules set';
  if (allWeeklyRules.length > 0) {
    weeklyText = allWeeklyRules.map(rule => {
      const capitalizedDay = rule.day.charAt(0).toUpperCase() + rule.day.slice(1);
      return `${capitalizedDay}: ${rule.text}`;
    }).join('\n');
  }
  
  // Use innerHTML to preserve line breaks
  document.getElementById('summary-weekly-rules').innerHTML = weeklyText.replace(/\n/g, '<br>');
}

// Navigation helper for summary screen
function goToPreviousFromSummary() {
  // Go back to the last platform setup screen that was accessed
  if (onboardingData.selectedPlatforms.includes('instagram')) {
    nextScreen('onboarding-instagram');
  } else if (onboardingData.selectedPlatforms.includes('linkedin')) {
    nextScreen('onboarding-linkedin');
  } else {
    nextScreen('onboarding-platform');
  }
}

// Finish onboarding
function finishOnboarding() {
  // Console log the focus profile
  console.log('Focus Profile:', onboardingData);
  
  // Save onboarding data to Chrome storage
  chrome.storage.local.set({
    hasCompletedOnboarding: true,
    focusProfile: onboardingData
  }, async function() {
    console.log('Onboarding completed and saved');
  
    // Transition to daily start screen
    showScreen('daily-start');
  });
}

// Initialize tag selection when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Small delay to ensure all elements are rendered
  setTimeout(initializeTagSelection, 100);
  
  // Initialize all event listeners
  initializeEventListeners();
});

// Initialize all event listeners (replaces inline onclick handlers)
function initializeEventListeners() {
  // Onboarding navigation buttons
  const welcomeContinue = document.getElementById('welcome-continue-btn');
  if (welcomeContinue) welcomeContinue.addEventListener('click', () => nextScreen('onboarding-rules'));
  
  const rulesContinue = document.getElementById('rules-continue-btn');
  if (rulesContinue) rulesContinue.addEventListener('click', () => nextScreen('onboarding-privacy'));
  
  const privacyContinue = document.getElementById('privacy-continue-btn');
  if (privacyContinue) privacyContinue.addEventListener('click', () => nextScreen('onboarding-time'));
  
  const timeContinue = document.getElementById('time-continue-btn');
  if (timeContinue) timeContinue.addEventListener('click', calculateTimeSavings);
  
  const savingsContinue = document.getElementById('savings-continue-btn');
  if (savingsContinue) savingsContinue.addEventListener('click', () => nextScreen('onboarding-platform'));
  
  const platformContinue = document.getElementById('platform-continue-btn');
  if (platformContinue) platformContinue.addEventListener('click', proceedToPlatformSetup);
  
  // LinkedIn setup buttons
  const linkedinPrevious = document.getElementById('linkedin-previous-btn');
  if (linkedinPrevious) linkedinPrevious.addEventListener('click', () => previousScreen('onboarding-platform'));
  
  const linkedinContinue = document.getElementById('linkedin-continue-btn');
  if (linkedinContinue) linkedinContinue.addEventListener('click', saveLinkedInPreferences);
  
  const linkedinAddTag = document.getElementById('linkedin-add-tag');
  if (linkedinAddTag) linkedinAddTag.addEventListener('click', () => addCustomTag('linkedin'));
  
  const linkedinAddWeekly = document.getElementById('linkedin-add-weekly');
  if (linkedinAddWeekly) linkedinAddWeekly.addEventListener('click', () => addWeeklyRule('linkedin'));
  
  // Instagram setup buttons
  const instagramPrevious = document.getElementById('instagram-previous-btn');
  if (instagramPrevious) instagramPrevious.addEventListener('click', () => previousScreen('onboarding-linkedin'));
  
  const instagramContinue = document.getElementById('instagram-continue-btn');
  if (instagramContinue) instagramContinue.addEventListener('click', saveInstagramPreferences);
  
  const instagramAddTag = document.getElementById('instagram-add-tag');
  if (instagramAddTag) instagramAddTag.addEventListener('click', () => addCustomTag('instagram'));
  
  const instagramAddWeekly = document.getElementById('instagram-add-weekly');
  if (instagramAddWeekly) instagramAddWeekly.addEventListener('click', () => addWeeklyRule('instagram'));
  
  // Summary screen
  const summaryFinish = document.getElementById('summary-finish-btn');
  if (summaryFinish) summaryFinish.addEventListener('click', finishOnboarding);
  
  // Modal buttons
  const viewPromptLink = document.getElementById('view-prompt-link');
  if (viewPromptLink) viewPromptLink.addEventListener('click', showPromptModal);
  
  const co2Link = document.getElementById('co2-link');
  if (co2Link) co2Link.addEventListener('click', showCo2Modal);
  
  const promptModalClose = document.getElementById('prompt-modal-close');
  if (promptModalClose) promptModalClose.addEventListener('click', () => closeModal('prompt-modal'));
  
  const co2ModalClose = document.getElementById('co2-modal-close');
  if (co2ModalClose) co2ModalClose.addEventListener('click', () => closeModal('co2-modal'));
  
  // Removed settings reset button in production
  
  // Summary previous button
  const summaryPrevious = document.getElementById('summary-previous-btn');
  if (summaryPrevious) summaryPrevious.addEventListener('click', goToPreviousFromSummary);
  
  // Daily flow buttons
  const startScrollBtn = document.getElementById('start-scroll-btn');
  if (startScrollBtn) startScrollBtn.addEventListener('click', guardedStartDailyScroll);
  
  const enjoyDayBtn = document.getElementById('enjoy-day-btn');
  if (enjoyDayBtn) enjoyDayBtn.addEventListener('click', closeExtension);
  
  // Menu buttons (About/Profile) - add multiple listeners for different screens
  const aboutBtns = ['about-btn', 'about-btn-2', 'about-btn-3', 'about-btn-4', 'about-btn-animation', 'about-btn-about', 'about-btn-profile'];
  aboutBtns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => showScreen('about-screen'));
  });
  
  const profileBtns = ['profile-btn', 'profile-btn-2', 'profile-btn-3', 'profile-btn-4', 'profile-btn-animation', 'profile-btn-about', 'profile-btn-profile'];
  profileBtns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => {
      showScreen('profile-screen');
      loadProfileData(); // Load and display the focus profile data
    });
  });
  
  // Back buttons
  const backFromAbout = document.getElementById('back-from-about');
  if (backFromAbout) backFromAbout.addEventListener('click', () => showScreen('daily-start'));

  // Change Focus Profile button
  const changeFocusBtn = document.getElementById('change-focus-profile');
  if (changeFocusBtn) changeFocusBtn.addEventListener('click', async () => {
    console.log('Change Focus button clicked - starting focus profile editing');
    
    // Load current focus profile to pre-populate the editing screens
    await loadCurrentProfileForEditing();
    
    // Initialize tag selection screens with current data
    initializeTagSelection();
    
    // Go to platform selection first (proper onboarding flow)
    showScreen('onboarding-platform');
  });

  // Redo Onboarding button
  const redoOnboardingBtn = document.getElementById('redo-onboarding-btn');
  if (redoOnboardingBtn) redoOnboardingBtn.addEventListener('click', () => {
    console.log('Redo Onboarding button clicked');
    resetOnboarding();
  });

  // API Key functionality
  const apiKeyInput = document.getElementById('api-key-input');
  const apiKeySaveBtn = document.getElementById('api-key-save-btn');
  if (apiKeyInput) {
    // Load saved API key when profile loads
    apiKeyInput.addEventListener('input', () => {
      // Save API key as user types (with debouncing)
      clearTimeout(window.apiKeySaveTimeout);
      window.apiKeySaveTimeout = setTimeout(() => {
        const apiKey = apiKeyInput.value.trim();
        chrome.storage.local.set({ 'openaiApiKey': apiKey }, () => {
          console.log('API key saved');
        });
      }, 1000); // Save after 1 second of no typing
    });
  }

  if (apiKeySaveBtn && apiKeyInput) {
    apiKeySaveBtn.addEventListener('click', () => {
      const apiKey = apiKeyInput.value.trim();
      chrome.storage.local.set({ 'openaiApiKey': apiKey }, () => {
        console.log('API key saved via button');
      });
    });
  }

  // API Key tutorial link
  const apiKeyTutorial = document.getElementById('api-key-tutorial');
  if (apiKeyTutorial) {
    apiKeyTutorial.addEventListener('click', () => {
      console.log('Opening API key tutorial video');
      chrome.tabs.create({ 
        url: 'https://www.youtube.com/watch?v=SzPE_AE0eEo&t=3s' 
      });
    });
  }

  // Ensure free-trial counter is initialized
  initializeTrialCounter();
  
  const backFromProfile = document.getElementById('back-from-profile');
  if (backFromProfile) backFromProfile.addEventListener('click', () => showScreen('daily-start'));
  
  // Profile editor button
  const editFocusProfile = document.getElementById('edit-focus-profile');
  if (editFocusProfile) editFocusProfile.addEventListener('click', editFocusProfileFlow);
  
  // Removed test animation button in production
}

// Function to reset onboarding (for settings)
function resetOnboarding() {
  if (confirm('This will reset your focus profile and restart the onboarding process. Are you sure?')) {
    chrome.storage.local.remove(['hasCompletedOnboarding', 'focusProfile'], function() {
      console.log('Onboarding reset');
      // Reset onboarding data
      onboardingData = {
        selectedPlatforms: [],
        linkedinTags: [],
        linkedinWeeklyRules: [],
        instagramTags: [],
        instagramWeeklyRules: [],
        dailyScrollTime: 45
      };
      // Restart onboarding
      showScreen('onboarding-welcome');
    });
  }
}

// Screen transition functions
function showScreen(screenId) {
  // Hide all screens (including onboarding and daily screens)
  const allScreens = [
    'onboarding-welcome', 'onboarding-rules', 'onboarding-privacy', 'onboarding-time', 
    'onboarding-savings', 'onboarding-platform', 'onboarding-linkedin', 'onboarding-instagram', 
    'onboarding-summary', 'daily-start', 'daily-waiting', 'daily-cards', 'daily-complete',
    'about-screen', 'profile-screen', 'loading-screen', 'results-screen', 'filter-animation-screen'
  ];
  
  allScreens.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.remove('active');
    }
  });
  
  // Show target screen
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }

  // Keep trial counter fresh when returning to daily start
  if (screenId === 'daily-start') {
    updateTrialCounterDisplay();
  }
}

// Filter Animation Functions
function startFilterAnimation(posts) {

  
  // Store total posts count for status text
  window.animationData = {
    totalPosts: window.scrapeResults ? 
      (window.scrapeResults.linkedin.length + window.scrapeResults.instagram.length) : 45,
    selectedPosts: posts.length
  };

  
  // Show animation screen

  showScreen('filter-animation-screen');
  
  // Update status text with initial phase

  updateStatusText('initial');
  
  // Create the initial grid with typewriter effect

  createFilterGridTypewriter(() => {

    // After grid is complete, start the animation sequence
    setTimeout(() => {

      fadeAllBoxes();
      
      setTimeout(() => {

        highlightSelectedBoxes(posts.length);
        
        setTimeout(() => {

          fadeUnselectedBoxes();
          
          setTimeout(() => {

            moveSelectedBoxesToCenter(posts);
          }, 500);
        }, (posts.length * 400) + 500); // Dynamic timing: posts.length * 400ms + 500ms buffer
      }, 500);
    }, 200);
  });
}

function createFilterGridTypewriter(callback) {
  try {

    const filterGrid = document.getElementById('filter-grid');

    
    if (!filterGrid) {
      console.error('Filter grid element not found!');
      if (callback) callback(); // Call callback even if failed
      return;
    }
    
    filterGrid.innerHTML = '';
    
    // Create all boxes but keep them invisible
    const boxes = [];
    for (let i = 0; i < 256; i++) {
      const box = document.createElement('div');
      box.classList.add('grid-box');
      box.dataset.index = i;
      filterGrid.appendChild(box);
      boxes.push(box);
    }

    
    // Show status text
    const statusText = document.getElementById('status-text');
    console.log('Status text element for show class:', !!statusText);
    if (statusText) {
      statusText.classList.add('show');
      console.log('Added show class to status text');
    }
    
    // Animate boxes appearing with diagonal lay-down effect (top-left to bottom-right)

    const gridCols = 32;
    const gridRows = 8;
    const totalDiagonals = gridCols + gridRows - 1; // Maximum diagonal index
    
    // Create groups of boxes by diagonal (top-left to bottom-right)
    const diagonalGroups = [];
    for (let d = 0; d < totalDiagonals; d++) {
      diagonalGroups[d] = [];
    }
    
    // Group boxes by their diagonal index
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const boxIndex = row * gridCols + col;
        const diagonalIndex = row + col;
        if (boxes[boxIndex]) {
          diagonalGroups[diagonalIndex].push(boxes[boxIndex]);
        }
      }
    }
    
    // Animate each diagonal group with a delay
    let completedDiagonals = 0;
    diagonalGroups.forEach((group, diagonalIndex) => {
      setTimeout(() => {
        // Animate all boxes in this diagonal simultaneously
        group.forEach(box => {
          box.classList.add('appear');
        });
        
        completedDiagonals++;
        if (completedDiagonals % 5 === 0 || completedDiagonals === totalDiagonals) {

        }
        
        // Call callback when all diagonals are complete
        if (completedDiagonals === totalDiagonals) {
      
        if (callback) callback();
      }
      }, diagonalIndex * 50); // 50ms delay between each diagonal wave
    });
    
  } catch (error) {
    console.error('Error in createFilterGridTypewriter:', error);
    if (callback) callback(); // Call callback even if there's an error
  }
}

function updateStatusText(phase = 'initial') {
  console.log('updateStatusText called with phase:', phase);
  const statusText = document.getElementById('status-text');
  console.log('Status text element found:', !!statusText);
  
  if (!window.animationData) {
    console.error('Animation data not found!');
    return;
  }
  
  const { totalPosts, selectedPosts } = window.animationData;
  console.log('Using data:', { totalPosts, selectedPosts });
  
  if (phase === 'initial') {
    statusText.textContent = `Filtered through ${totalPosts} posts`;
  } else if (phase === 'highlighting') {
    statusText.textContent = `Found ${selectedPosts} useful posts`;
  } else if (phase === 'complete') {
    statusText.textContent = ''; // Remove text completely
  }
  

}

function fadeAllBoxes() {

  const boxes = document.querySelectorAll('.grid-box');

  boxes.forEach(box => {
    box.classList.add('fade-low');
  });

}

function highlightSelectedBoxes(numPosts) {

  const boxes = document.querySelectorAll('.grid-box');
  const totalBoxes = boxes.length;

  
  // Create array of random indices for selected boxes
  const selectedIndices = [];
  while (selectedIndices.length < Math.min(numPosts, totalBoxes)) {
    const randomIndex = Math.floor(Math.random() * totalBoxes);
    if (!selectedIndices.includes(randomIndex)) {
      selectedIndices.push(randomIndex);
    }
  }

  
  // Update status text to show highlighting phase
  updateStatusText('highlighting');
  
  // Highlight selected boxes one by one with smooth transitions
  selectedIndices.forEach((index, i) => {
    setTimeout(() => {

      const box = boxes[index];
      if (box) {

        
        // Use CSS class for smooth highlighting
        box.classList.add('highlighted');
        box.dataset.selected = 'true';
        


        
        // Force a style recalculation to ensure the class takes effect
        box.offsetHeight;
        
        // Check computed styles
        const computedStyle = window.getComputedStyle(box);
      } else {
        console.error('Box not found at index', index);
      }
    }, i * 400); // Reduced to 400ms for faster highlighting
  });
  

}

function fadeUnselectedBoxes() {
  const boxes = document.querySelectorAll('.grid-box');
  boxes.forEach(box => {
    if (!box.dataset.selected) {
      box.classList.add('fade-out');
    }
  });
}

function moveSelectedBoxesToCenter(posts) {

  const selectedBoxes = document.querySelectorAll('.grid-box[data-selected="true"]');

  
  if (selectedBoxes.length === 0) {
    console.error('No selected boxes found!');
    // For 0 posts, skip directly to completion screen - no need for empty cards
    setTimeout(() => {
      showDailyComplete();
    }, 1000); // Brief delay to let user see the "Found 0 useful posts" message
    return;
  }
  
  // Use viewport center (works for any screen size) - FIXED COORDINATE SOLUTION
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  

  console.log('=================================');
  
  selectedBoxes.forEach((box, index) => {
    const rect = box.getBoundingClientRect(); // viewport coords
    


    
    // Calculate target position (center the box)
    const targetLeft = centerX - rect.width / 2;
    const targetTop = centerY - rect.height / 2;
    


    
    // No need for complex animation data - we have everything we need
    
    setTimeout(() => {

      
      // Make the box absolutely positioned at its current location (removes from grid flow)
      // But first, create a placeholder to maintain grid layout
      const placeholder = document.createElement('div');
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.height = `${rect.height}px`;
      placeholder.style.visibility = 'hidden'; // invisible but takes up space
      placeholder.classList.add('grid-placeholder');
      
      // Insert placeholder before the box
      box.parentNode.insertBefore(placeholder, box);
      
      // Now make the original box absolutely positioned for animation
      box.style.position = 'fixed';
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.style.margin = '0';
      box.style.zIndex = '1000';
      box.style.transition = 'left 2s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 2s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      
      // Add highlighted styling
      box.classList.add('highlighted');
      

      console.log(`Will animate to: left=${targetLeft}px, top=${targetTop}px`);
      
      // Force a reflow
      box.offsetHeight;
      
      // Next frame: animate to center
      requestAnimationFrame(() => {

        
        box.style.left = `${targetLeft}px`;
        box.style.top = `${targetTop}px`;
        box.style.transform = `scale(1.2)`;
        box.style.background = 'rgba(255, 255, 255, 1)';
        box.style.opacity = '1';
      });
      
    }, index * 200); // Staggered movement
  });
  
  // Keep status text visible until cards appear (removed early clearing)
  
  // Transition to daily cards after 2 second delay
  const transitionDelay = 2000;

  
  setTimeout(() => {

    
    // Clean up: remove animated boxes and placeholders
    const animatedBoxes = document.querySelectorAll('.grid-box.highlighted[style*="position: fixed"]');
    const placeholders = document.querySelectorAll('.grid-placeholder');

    
    animatedBoxes.forEach(box => {

      box.remove();
    });
    
    placeholders.forEach(placeholder => {
      console.log('Removing placeholder');
      placeholder.remove();
    });
    
    // Hide the animation screen and show daily cards
    showDailyCards(posts);
  }, transitionDelay);
}

function showFinalCards(posts) {

  const finalCardsContainer = document.getElementById('final-cards-container');

  finalCardsContainer.innerHTML = '';
  
  // Create card deck container
  const cardDeck = document.createElement('div');
  cardDeck.classList.add('card-deck');

  
  // Store posts data for deck interaction
  window.cardDeckData = {
    posts: posts,
    currentIndex: 0,
    totalCards: posts.length
  };
  
  // Create final cards (stacked)
  posts.forEach((post, index) => {
    const card = document.createElement('div');
    card.classList.add('final-card');
    card.dataset.cardIndex = index;
    // Dynamic z-index so the first card is on top; scales to any length
    card.style.zIndex = String(posts.length - index);
    // Let CSS nth-child handle z-index stacking as before
    
    // Add image if available (Instagram included)
    if (post.image) {
      const image = document.createElement('img');
      image.style.width = '100%';
      image.style.height = '120px';
      image.style.objectFit = 'cover';
      image.style.borderRadius = '8px';
      image.style.marginBottom = '12px';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.alt = `${post.platform || 'Post'} image`;
      image.onerror = function() {
        // Retry via background fetch to bypass CORS
        const failedImg = this;
        chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_AS_DATA_URL', url: post.image }, (resp) => {
          if (resp && resp.ok && resp.dataUrl) {
            failedImg.onerror = null; // avoid loops
            failedImg.src = resp.dataUrl;
          } else {
            const placeholder = document.createElement('div');
            placeholder.style.width = '100%';
            placeholder.style.height = '120px';
            placeholder.style.backgroundColor = '#f0f0f0';
            placeholder.style.borderRadius = '8px';
            placeholder.style.marginBottom = '12px';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.style.color = '#999';
            placeholder.style.fontSize = '12px';
            placeholder.textContent = `${post.platform || 'Post'} Image`;
            failedImg.parentNode.replaceChild(placeholder, failedImg);
          }
        });
      };
      image.src = post.image;
      card.appendChild(image);
    }
    
    // Add platform badge
    if (post.platform) {
      const badge = document.createElement('div');
      badge.textContent = post.platform;
      badge.style.fontSize = '11px';
      badge.style.padding = '3px 6px';
      badge.style.backgroundColor = '#e6f3e6';
      badge.style.borderRadius = '4px';
      badge.style.alignSelf = 'flex-start';
      badge.style.marginBottom = '6px';
      card.appendChild(badge);
    }
    
    // Add author
    const author = document.createElement('div');
    author.textContent = post.author || 'Unknown Author';
    author.style.fontWeight = 'bold';
    author.style.marginBottom = '6px';
    author.style.fontSize = '14px';
    card.appendChild(author);
    
    // Add summary
    const summary = document.createElement('div');
    summary.textContent = post.openaiSummary || 'No summary available';
    summary.style.lineHeight = '1.4';
    summary.style.fontSize = '13px';
    summary.style.marginBottom = '8px';
    summary.style.overflow = 'hidden';
    summary.style.display = '-webkit-box';
    summary.style.webkitLineClamp = '4';
    summary.style.webkitBoxOrient = 'vertical';
    card.appendChild(summary);
    
    // Add original post link
    if (post.originalPostUrl) {
      const link = document.createElement('a');
      link.textContent = '>> original post';
      link.href = post.originalPostUrl;
      link.style.color = '#2ecc71';
      link.style.textDecoration = 'none';
      link.style.fontSize = '12px';
      link.style.marginTop = 'auto';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: post.originalPostUrl });
      });
      card.appendChild(link);
    }
    
    cardDeck.appendChild(card);
  });

  // After all cards are in the DOM, set z-index and interactivity dynamically
  applyZOrderAndInteractivityToDeck(cardDeck);
  
  // Create Next button
  const nextButton = document.createElement('button');
  nextButton.classList.add('next-button');
  nextButton.textContent = 'Next';
  nextButton.addEventListener('click', handleNextCard);
  
  // Create completion message
  const completionMessage = document.createElement('div');
  completionMessage.classList.add('completion-message');
  completionMessage.textContent = 'Enjoy your bullshit free day!';
  
  // Add elements to container
  finalCardsContainer.appendChild(cardDeck);
  finalCardsContainer.appendChild(nextButton);
  finalCardsContainer.appendChild(completionMessage);
  
  // Show final cards container
  finalCardsContainer.style.opacity = '1';
  finalCardsContainer.style.pointerEvents = 'auto';
  
  // Animate cards appearing with stacked effect
  posts.forEach((_, index) => {
    setTimeout(() => {
      const card = cardDeck.children[index];
      card.classList.add('stacked');
    }, index * 100);
  });
  
  // Show Next button after all cards are stacked
  setTimeout(() => {
    nextButton.classList.add('show');
  }, posts.length * 100 + 300);
}

// Handle Next button click
function handleNextCard() {
  const { posts, currentIndex, totalCards } = window.cardDeckData;
  
  if (currentIndex >= totalCards) return;
  
  const cardDeck = document.querySelector('.card-deck');
  const nextButton = document.querySelector('.next-button');
  
  // Find the top card (highest z-index visible card)
  const topCard = cardDeck.children[currentIndex];
  
  if (topCard) {
    // Animate card sliding away
    topCard.classList.add('slide-away');
    
    // After animation, hide the current card and reveal the next card
    setTimeout(() => {
      topCard.style.opacity = '0';
      topCard.style.pointerEvents = 'none';
      const nextIndex = window.cardDeckData.currentIndex + 1;
      const all = Array.from(cardDeck.children);
      if (all[nextIndex]) {
        all[nextIndex].style.opacity = '1';
        all[nextIndex].style.pointerEvents = 'auto';
      }
    }, 800);
    
    // Update current index
    window.cardDeckData.currentIndex++;
    
    // Check if all cards are done
    if (window.cardDeckData.currentIndex >= totalCards) {
      // Hide Next button
      setTimeout(() => {
        nextButton.classList.remove('show');
      }, 400);
      
      // Show completion message
      setTimeout(() => {
        const completionMessage = document.querySelector('.completion-message');
        completionMessage.classList.add('show');
      }, 1200);
    }
  }
}

// Old scroll button event listener removed - now using new daily flow

// Test animation button event listener - handled in initializeEventListeners now

// Helper function to wait for tab to fully load
async function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

// Helper function to send start message with retry logic
async function sendStartMessage(tabId, payload, siteName) {
  try {
    await chrome.tabs.sendMessage(tabId, payload);
    console.log(`Successfully sent scrape message to ${siteName} tab`);
  } catch (e) {
    console.warn(`First attempt failed for ${siteName}, retrying with injection:`, e);
    try {
      // Inject again and retry once
      await chrome.scripting.executeScript({ 
        target: { tabId }, 
        files: ['content.js'] 
      });
      await new Promise(r => setTimeout(r, 150));
      await chrome.tabs.sendMessage(tabId, payload);
      console.log(`Successfully sent scrape message to ${siteName} tab (retry)`);
    } catch (retryError) {
      console.error(`Error sending message to ${siteName} tab (after retry):`, retryError);
    }
  }
}

// Function to handle sequential scraping of multiple sites
function scrapeSequentially(sites, positiveInput, negativeInput, scrollDuration) {
  if (sites.length === 0) {
    // All sites scraped, combine results and filter
    const allPosts = [
      ...window.scrapeResults.linkedin,
      ...window.scrapeResults.instagram
    ];
    console.log('Combined scrape results:', allPosts);
    
    filterWithChatGPT(allPosts, positiveInput, negativeInput)
      .then(filteredResult => {
        console.log('Filtered result from ChatGPT:', filteredResult);
        
        const summaries = filteredResult.relevant_posts 
          ? filteredResult.relevant_posts
          : [{ text: 'No relevant posts found.' }];
        
        // Complete the scraping progress indicator
        completeScrapingProgress();
        
        setTimeout(async () => {
          // Decrement trial counter once per successful session
          if (window.__trialSessionStarted) {
            await decrementTrialIfUsed();
            window.__trialSessionStarted = false;
          }
          startFilterAnimation(summaries);
        }, 1000);
      })
      .catch(error => {
        console.error('Error in filtering:', error);
        completeScrapingProgress();
        setTimeout(() => {
          startFilterAnimation([{ text: 'Error processing posts.' }]);
        }, 1000);
      });
    return;
  }
  
  const currentSite = sites[0];
  const remainingSites = sites.slice(1);
  
  console.log(`Starting scraping for: ${currentSite}`);
  
    // Get current active tab to restore later
  chrome.tabs.query({ active: true, currentWindow: true }, (prevTabs) => {
    const prevTab = prevTabs[0];
    
    // Create an ACTIVE tab for scraping (required for feed loading)
    chrome.tabs.create({ 
      url: urls[currentSite], 
      active: true // Must be visible for feed to load properly
    }, (newTab) => {
      console.log(`Created active scraping tab for ${currentSite}: ${newTab.id}`);
      
            // Wait for tab to fully load
      waitForTabLoad(newTab.id).then(async () => {
        console.log(`Tab ${newTab.id} loaded, starting scraping for ${currentSite}`);
        
        // Guarantee content script injection (especially for Instagram)
        try {
          await chrome.scripting.executeScript({
            target: { tabId: newTab.id, allFrames: false },
            files: ['content.js']
          });
          console.log(`Content script injected into ${currentSite} tab ${newTab.id}`);
          
          // Small settle time
          await new Promise(r => setTimeout(r, 100));
          
          // Ping test to confirm content script is alive
          try {
            const ack = await chrome.tabs.sendMessage(newTab.id, { action: 'ping' });
            console.log(`${currentSite} content script ack:`, ack);
          } catch (e) {
            console.warn(`${currentSite} ping failed, but continuing:`, e);
          }
          
        } catch (e) {
          console.warn(`Content script injection warning for ${currentSite}:`, e);
        }
        
        // Send scraping message for current site with retry logic
        await sendStartMessage(newTab.id, {
          type: 'SCROLL_AND_SCRAPE', 
                  site: currentSite,
          totalScrolls: scrollDuration * 5, // Convert duration to scroll count (5 scrolls per second)
          scrollDelay: currentSite === 'instagram' ? 200 : 150,
                  positiveInput,
                  negativeInput,
          remainingSites: remainingSites.length > 0 ? remainingSites : null,
          prevTabId: prevTab?.id, // Pass previous tab ID for restoration
          scrapeTabId: newTab.id, // Pass current tab ID for rendering
          // Enable multi-pass short scroll for Instagram specifically
          multiPass: currentSite === 'instagram' ? { passes: 7, passDurationSeconds: 10, coolDownMs: 600 } : undefined
        }, currentSite);
      });
    });
  });
}

// Render results in gallery format
function renderResults(posts) {
  const resultsGrid = document.getElementById('results-grid');
  resultsGrid.innerHTML = ''; // Clear previous results

  // Log the posts to see what data we have
  // Silence extraneous logs
  
  // Display privacy summary if available
  displayPrivacySummary(posts);

  // Distinctive placeholder image
  const placeholderImage = 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80';

  posts.forEach((post, index) => {
    const card = document.createElement('div');
    card.classList.add('card');

    // Determine image source with explicit priority
    const imageSrc = 
      post.image || 
      placeholderImage;

    // Add image with loading state
    const image = document.createElement('img');
    image.classList.add('card-image', 'loading');
    
    // Add error handling for Instagram images
    image.onerror = function() {
      // Silence extraneous logs
      this.classList.remove('loading');
      
      // If it's an Instagram image that failed, try alternative approaches
      if (imageSrc && imageSrc.includes('cdninstagram.com')) {
        // Silence extraneous logs
        this.src = placeholderImage;
      } else if (imageSrc !== placeholderImage) {
        // If not already placeholder, use placeholder
        this.src = placeholderImage;
      }
    };
    
    // Add loading success handler
    image.onload = function() {
      // Silence extraneous logs
      this.classList.remove('loading');
    };
    
    // Set source after handlers are attached
    image.src = imageSrc;
    
    card.appendChild(image);

    // Create card content container
    const contentContainer = document.createElement('div');
    contentContainer.classList.add('card-content');
    
    // Add platform badge if available
    if (post.platform) {
      const platformBadge = document.createElement('div');
      platformBadge.classList.add('platform-badge');
      
      // Add special styling for Instagram
      if (post.platform.toLowerCase() === 'instagram') {
        platformBadge.classList.add('instagram');
        platformBadge.textContent = post.platform;
      } else {
        platformBadge.textContent = post.platform;
      }
      
      platformBadge.style.fontSize = '11px';
      platformBadge.style.fontWeight = '500';
      platformBadge.style.color = '#4a5f4a';
      platformBadge.style.backgroundColor = '#e6f3e6';
      platformBadge.style.padding = '2px 6px';
      platformBadge.style.borderRadius = '4px';
      platformBadge.style.marginBottom = '8px';
      platformBadge.style.alignSelf = 'flex-start';
      contentContainer.appendChild(platformBadge);
    }
    
    // Add author name
    const authorText = document.createElement('div');
    authorText.classList.add('card-title');
    authorText.textContent = post.author || 'Unknown Author';
    authorText.style.fontWeight = 'bold';
    authorText.style.marginBottom = '10px';
    contentContainer.appendChild(authorText);

    // Add summary text
    const summaryText = document.createElement('div');
    summaryText.classList.add('card-summary-text');
    summaryText.textContent = post.openaiSummary || 'No summary available';
    contentContainer.appendChild(summaryText);

    // Log the post details for debugging (silenced)

    // Add original post link if URL exists
    if (post.originalPostUrl) {
      // Silence extraneous logs
      const openPostLink = document.createElement('a');
      openPostLink.textContent = '>> original post';
      openPostLink.href = post.originalPostUrl;
      openPostLink.classList.add('open-post-link');
      openPostLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: post.originalPostUrl });
      });
      contentContainer.appendChild(openPostLink);
    } else {
      // Silence extraneous logs
    }

    card.appendChild(contentContainer);
    resultsGrid.appendChild(card);
  });

  // Transition to results screen
  showScreen('results-screen');
}

// Listen for scrape results and display them
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  // Debug channel removed
  
  if (msg.action === 'showScrapeResult') {
    if (msg.site === 'linkedin') {
      console.log('LinkedIn scrape results:', msg.data);
    } else if (msg.site === 'instagram') {
      console.log('Instagram scrape results:', msg.data);
    }
    
    // Store results by site
    if (msg.site) {
      window.scrapeResults[msg.site] = msg.data;
      window.scrapeResults.completedSites++;
      
      // Store scrapeTabId for rendering
      if (msg.scrapeTabId) {
        window.scrapeResults[`${msg.site}TabId`] = msg.scrapeTabId;
      }
      
      console.log(`Completed ${msg.site}, ${window.scrapeResults.completedSites}/${window.scrapeResults.totalSites} sites done`);
      
      // Check if we have remaining sites to scrape
      if (msg.remainingSites && msg.remainingSites.length > 0) {
        console.log('Moving to next site:', msg.remainingSites[0]);
          // Continue with remaining sites using focus profile
          const focusProfile = await getFocusProfile();
          const positiveInput = focusProfile.dailyTags;
          const negativeInput = '';
          const scrollDuration = getScrollDurationSeconds(); // Use centralized duration
        
        scrapeSequentially(msg.remainingSites, positiveInput, negativeInput, scrollDuration);
      } else if (window.scrapeResults.completedSites >= window.scrapeResults.totalSites) {
        // All sites completed, combine and filter results
        const allPosts = [
      ...window.scrapeResults.linkedin,
      ...window.scrapeResults.instagram
    ];
        console.log('All sites completed! Combined posts:', allPosts);
        
        // Use focus profile data instead of input fields
        const focusProfile = await getFocusProfile();
        const positiveInput = focusProfile.dailyTags;
        const negativeInput = '';
        
        filterWithChatGPT(allPosts, positiveInput, negativeInput)
          .then(async (filteredResult) => {
            console.log('OpenAI result:', filteredResult);
            
            const summaries = filteredResult.relevant_posts 
              ? filteredResult.relevant_posts
              : [{ text: 'No relevant posts found.' }];
            
            // Complete the scraping progress indicator
            completeScrapingProgress();
            
            // Start filter animation, which will automatically transition to daily cards
            setTimeout(async () => {
              if (window.__trialSessionStarted) {
                await decrementTrialIfUsed();
                window.__trialSessionStarted = false;
              }
              startFilterAnimation(summaries);
            }, 1000); // Small delay to show completion
          })
          .catch(error => {
            console.error('Error in filtering:', error);
            showDailyCards([{ text: 'Error processing posts.' }]);
          });
      }
    } else {
      // Fallback for backward compatibility (single site)
      console.log('Combined scrape results:', msg.data);
      
      // Use focus profile data instead of input fields
      const focusProfile = await getFocusProfile();
      const positiveInput = focusProfile.dailyTags;
      const negativeInput = '';
      
              filterWithChatGPT(msg.data, positiveInput, negativeInput)
          .then(filteredResult => {
            console.log('OpenAI result:', filteredResult);
            
            const summaries = filteredResult.relevant_posts 
              ? filteredResult.relevant_posts
              : [{ text: 'No relevant posts found.' }];
            
            // Complete the scraping progress indicator
            completeScrapingProgress();
            
            setTimeout(async () => {
              if (window.__trialSessionStarted) {
                await decrementTrialIfUsed();
                window.__trialSessionStarted = false;
              }
              startFilterAnimation(summaries);
            }, 1000);
          })
          .catch(error => {
            console.error('Error in filtering:', error);
            completeScrapingProgress();
            setTimeout(() => {
            startFilterAnimation([{ text: 'Error processing posts.' }]);
            }, 1000);
          });
    }
  }
});

// Removed testFilterAnimation (debug)

// Test function with different post counts
// Removed testFilterAnimationWithCount (debug)

// Privacy summary display function
function displayPrivacySummary(posts) {
  // Check if we have privacy information
  const postsWithPrivacyInfo = posts.filter(post => post.privacyInfo);
  
  if (postsWithPrivacyInfo.length === 0) {
    return; // No privacy info available
  }
  
  const publicPosts = postsWithPrivacyInfo.filter(post => post.isPublic);
  const privatePosts = postsWithPrivacyInfo.filter(post => !post.isPublic);
  
  console.log(`Privacy Summary: ${publicPosts.length} public, ${privatePosts.length} private posts analyzed`);
  
  // Add privacy info to the loading progress if still visible
  const progressInfo = document.getElementById('progress-info');
  if (progressInfo && progressInfo.style.display !== 'none') {
    progressInfo.innerHTML += `<br><small>Privacy: ${publicPosts.length} public posts analyzed, ${privatePosts.length} private posts excluded</small>`;
  }
}

// Make functions globally available for console testing
// Removed global debug bindings

// Daily Flow Functions
function generateRandomActivities() {
  const allActivities = [
    '🥛 Drink a glass of water',
    '🙆 Stand up and stretch your arms and back',
    '🔄 Do a few shoulder rolls or neck circles',
    '🌳 Look out the window and notice 3 things you see',
    '🌬️ Take 5 slow, deep breaths',
    '🚶 Walk to another room and back',
    '🪴 Water a plant or touch something green',
    '☕ Make yourself a cup of tea or coffee',
    '✋ Massage your hands or temples',
    '👂 Close your eyes and listen to the sounds around you',
    '✍️ Write down one thing you\'re grateful for today',
    '📸 Look at a photo that makes you smile',
    '🏋️ Do 10 squats, wall pushups, or calf raises',
    '🌤️ Step outside for a minute of fresh air'
  ];

  // Shuffle array and pick first 3
  const shuffled = allActivities.sort(() => 0.5 - Math.random());
  const selectedActivities = shuffled.slice(0, 3);
  
  // Populate the activity list
  const activityList = document.getElementById('activity-list');
  if (activityList) {
    activityList.innerHTML = '';
    selectedActivities.forEach(activity => {
      const activityItem = document.createElement('div');
      activityItem.className = 'activity-item';
      activityItem.textContent = activity;
      activityList.appendChild(activityItem);
    });
  }
  
  console.log('Generated random activities:', selectedActivities);
}

async function startDailyScroll() {
  console.log('Starting daily scroll with focus profile');
  
  // Show waiting screen
  showScreen('daily-waiting');
  
  // DEMO MODE: bypass scraping and AI, render curated posts
  if (DEMO_MODE) {
    const progressInfo = document.getElementById('progress-info');
    if (progressInfo) {
      progressInfo.style.display = 'block';
      progressInfo.textContent = 'Filtered through 123 posts; found 10 interesting posts.';
    }
    setTimeout(async () => {
      // Enrich LinkedIn posts with og:image
      const demoPosts = getDemoPosts();
      const enriched = await Promise.all(demoPosts.map(p => {
        if (p.platform === 'LinkedIn' && !p.image && p.originalPostUrl) {
          return new Promise(resolve => {
            chrome.runtime.sendMessage({ type: 'FETCH_OG_IMAGE', url: p.originalPostUrl }, (resp) => {
              if (resp && resp.ok && resp.imageUrl) {
                resolve({ ...p, image: resp.imageUrl });
              } else {
                resolve(p);
              }
            });
          });
        }
        return Promise.resolve(p);
      }));
      // Provide fake totals so animation status text shows 123 → 10
      window.scrapeResults = {
        linkedin: Array(115).fill({}),
        instagram: Array(8).fill({}),
        completedSites: 2,
        totalSites: 2
      };
      // Run the full filter animation; it will transition to cards afterward
      startFilterAnimation(enriched);
    }, 800);
    return;
  }

  // Generate random activities for the waiting screen
  generateRandomActivities();
  
  // Set scroll duration but don't start independent timer
  const scrollDuration = getScrollDurationSeconds(); // Centralized duration
  
  // Start a progress indicator that shows scraping progress instead of fixed time
  startScrapingProgressIndicator();
  
  // Get focus profile to use as input
  const focusProfile = await getFocusProfile();
  console.log('Focus profile for filtering:', focusProfile);
  
  if (!focusProfile || !focusProfile.selectedPlatforms || focusProfile.selectedPlatforms.length === 0) {
    console.error('No focus profile or platforms found');
    // Clear progress timer
    if (window.progressInterval) {
      clearInterval(window.progressInterval);
    }
    // Show error or fallback
    showDailyComplete();
    return;
  }
  
  // Initialize scrape results storage
  window.scrapeResults = {
    linkedin: [],
    instagram: [],
    completedSites: 0,
    totalSites: focusProfile.selectedPlatforms.length
  };
  // Set a realistic estimated duration: per-platform seconds × number of platforms
  try {
    const perPlatformMs = getScrollDurationSeconds() * 1000;
    window.estimatedDuration = perPlatformMs * (window.scrapeResults.totalSites || 1);
  } catch (e) {
    window.estimatedDuration = 120000; // fallback to 2 minutes
  }
  
  console.log(`Starting to scrape ${focusProfile.selectedPlatforms.length} platforms:`, focusProfile.selectedPlatforms);
  
  // Start scraping the first platform (sequential scraping)
  const sitesToScrape = focusProfile.selectedPlatforms.filter(p => p === 'linkedin' || p === 'instagram');
  if (sitesToScrape.length > 0) {
    // Use focus profile data for filtering
    const positiveInput = focusProfile.dailyTags;
    const negativeInput = '';
    // Mark that a session is starting; after successful AI processing we'll decrement trial
    window.__trialSessionStarted = true;
    scrapeSequentially(sitesToScrape, positiveInput, negativeInput, scrollDuration);
  } else {
    console.warn('No supported platforms found in focus profile');
    // Clear progress timer and show completion
    if (window.progressInterval) {
      clearInterval(window.progressInterval);
    }
    showDailyComplete();
  }
}

function startProgressTimer(duration) {
  const progressFill = document.getElementById('progress-fill');
  const timeRemaining = document.getElementById('time-remaining');
  
  let timeLeft = duration;
  let progress = 0;
  
  console.log('Starting progress timer for', duration, 'seconds');
  
  const interval = setInterval(() => {
    progress += (100 / duration);
    timeLeft -= 1;
    
    console.log('Progress:', Math.min(progress, 100).toFixed(1) + '%', 'Time left:', timeLeft);
    
    if (progressFill) {
      progressFill.style.width = `${Math.min(progress, 100)}%`;
    }
    
    if (timeRemaining) {
      if (timeLeft > 60) {
        const minutes = Math.ceil(timeLeft / 60);
        timeRemaining.textContent = `${minutes} minute${minutes > 1 ? 's' : ''} left`;
      } else if (timeLeft > 30) {
        timeRemaining.textContent = '1 minute left';
      } else if (timeLeft > 0) {
        timeRemaining.textContent = '30 seconds left';
      } else {
        timeRemaining.textContent = 'Processing results...';
        clearInterval(interval);
      }
    }
    
    if (timeLeft <= 0) {
      clearInterval(interval);
    }
  }, 1000);
  
  // Store interval for cleanup
  window.progressInterval = interval;
}

function startScrapingProgressIndicator() {
  const progressFill = document.getElementById('progress-fill');
  const progressStatus = document.getElementById('progress-status');
  const timeRemaining = document.getElementById('time-remaining');
  
  if (!progressFill || !progressStatus || !timeRemaining) {
    console.error('Progress elements not found');
    return;
  }
  
  // Initialize progress display and timing
  progressFill.style.width = '0%';
  progressStatus.textContent = 'Starting to scroll...';
  timeRemaining.textContent = '';
  
  // Track start time for time estimates; duration will be set after platforms are known
  window.scrapingStartTime = Date.now();
  if (!window.estimatedDuration) {
    const perPlatformMs = getScrollDurationSeconds() * 1000;
    const sites = (window.scrapeResults && window.scrapeResults.totalSites) ? window.scrapeResults.totalSites : 2;
    window.estimatedDuration = perPlatformMs * sites;
  }
  
  // Set up interval to check scraping progress
  if (window.progressInterval) {
    clearInterval(window.progressInterval);
  }
  
  window.progressInterval = setInterval(() => {
    updateScrapingProgress();
  }, 1000); // Update every second
}

function updateScrapingProgress() {
  const progressFill = document.getElementById('progress-fill');
  const progressStatus = document.getElementById('progress-status');
  const timeRemaining = document.getElementById('time-remaining');
  
  if (!progressFill || !progressStatus || !timeRemaining || !window.scrapeResults) {
    return;
  }
  
  const completed = window.scrapeResults.completedSites;
  const total = window.scrapeResults.totalSites;
  
  if (total === 0) {
    progressFill.style.width = '0%';
    progressStatus.textContent = 'Preparing to scroll...';
    timeRemaining.textContent = '';
    return;
  }
  
  // Calculate time-based estimates
  const elapsed = Date.now() - (window.scrapingStartTime || Date.now());
  const estimatedTotal = window.estimatedDuration || 30000; // 30 seconds default
  
  let timeLeft = Math.max(0, estimatedTotal - elapsed);
  let timeText = '';
  
  if (timeLeft > 210000) {
    timeText = '4 minutes left';
  } else if (timeLeft > 150000) {
    timeText = '3 minutes left';
  } else if (timeLeft > 90000) {
    timeText = '2 minutes left';
  } else if (timeLeft > 30000) {
    timeText = '1 minute left';
  } else if (timeLeft > 0) {
    timeText = 'half a minute left';
  } else {
    timeText = 'Almost done...';
  }
  
  const progressPercent = Math.min((completed / total) * 90, 90); // Max 90% until OpenAI completes
  progressFill.style.width = `${progressPercent}%`;
  
  if (completed === 0) {
    progressStatus.textContent = 'Scrolling through your feeds...';
    timeRemaining.textContent = timeText;
  } else if (completed < total) {
    progressStatus.textContent = `Scrolled ${completed} of ${total} platforms...`;
    timeRemaining.textContent = timeText;
  } else if (completed === total && progressPercent < 100) {
    progressStatus.textContent = 'Analyzing posts with AI...';
    timeRemaining.textContent = '';
    progressFill.style.width = '95%'; // Show we're in AI phase
  }
}

function completeScrapingProgress() {
  const progressFill = document.getElementById('progress-fill');
  const progressStatus = document.getElementById('progress-status');
  const timeRemaining = document.getElementById('time-remaining');
  
  if (progressFill && progressStatus && timeRemaining) {
    progressFill.style.width = '100%';
    progressStatus.textContent = 'Analysis complete!';
    timeRemaining.textContent = '';
  }
  
  // Clear the progress interval
  if (window.progressInterval) {
    clearInterval(window.progressInterval);
    window.progressInterval = null;
  }
  
  // Wait a moment then transition will happen via filterWithChatGPT completion

}

function showDailyCards(posts) {

  
  // Clear the status text now that cards are appearing
  updateStatusText('complete');
  
  // Render posts in the scraping tabs for image display
  console.log('About to render in scraping tabs:', posts.length, 'posts');
  renderInScrapingTabs(posts);
  
  // Clear any existing progress timer
  if (window.progressInterval) {
    clearInterval(window.progressInterval);
  }
  
  // Show cards screen
  showScreen('daily-cards');
  
  // Get the center position where rectangles ended up
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  
  const cardsContainer = document.getElementById('daily-cards-container');
  if (!cardsContainer) return;
  
  cardsContainer.innerHTML = '';
  
  // Start the card container at the center (where rectangles are) and scale it small

  cardsContainer.style.position = 'fixed';
  cardsContainer.style.left = `${centerX}px`;
  cardsContainer.style.top = `${centerY}px`;
  cardsContainer.style.transform = 'translate(-50%, -50%) scale(0.2)'; // Start small like rectangles
  cardsContainer.style.transition = 'all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  cardsContainer.style.opacity = '0';
  
  // Create card deck container
  const cardDeck = document.createElement('div');
  cardDeck.classList.add('card-deck');
  
  // Store posts data for deck interaction
  window.cardDeckData = {
    posts: posts,
    currentIndex: 0,
    totalCards: posts.length
  };
  
  // Create final cards (stacked)
  posts.forEach((post, index) => {
    const card = document.createElement('div');
    card.classList.add('final-card');
    card.dataset.cardIndex = index;
    
    // Create header row with platform logo and focus tag
    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.marginBottom = '8px';
    
    // Add focus tag (left side), hide generic fallbacks like "Best Available"
    const shouldShowFocusTag = post.focusTag && !/best\s*(available|match)/i.test(post.focusTag);
    if (shouldShowFocusTag) {
      const focusTag = document.createElement('div');
      focusTag.textContent = `🎯 ${post.focusTag}`;
      focusTag.style.fontSize = '12px';
      focusTag.style.padding = '4px 8px';
      focusTag.style.backgroundColor = '#f0f0f0';
      focusTag.style.borderRadius = '6px';
      focusTag.style.color = '#666';
      headerRow.appendChild(focusTag);
    } else {
      // Empty div to maintain spacing
      headerRow.appendChild(document.createElement('div'));
    }
    
    // Add platform badge (right side)
    if (post.platform) {
      const badge = document.createElement('div');
      
      if (post.platform.toLowerCase() === 'linkedin') {
        // LinkedIn logo SVG
        badge.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="#0077B5">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>`;
      } else if (post.platform.toLowerCase() === 'instagram') {
        // Instagram logo SVG
        badge.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="#E4405F">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.40z"/>
        </svg>`;
      } else {
        // Fallback for other platforms
        badge.textContent = post.platform;
        badge.style.fontSize = '11px';
        badge.style.padding = '3px 6px';
        badge.style.backgroundColor = '#e6f3e6';
        badge.style.borderRadius = '4px';
      }
      
      headerRow.appendChild(badge);
    }
    
    card.appendChild(headerRow);
    
    // Add image if available (square like social media)
    // Silence extraneous logs
    if (post.platform && post.platform.toLowerCase() === 'linkedin' && !post.image) {
      // LinkedIn post without image: show placeholder
      const placeholder = document.createElement('div');
      placeholder.style.width = '100%';
      placeholder.style.height = '200px';
      placeholder.style.backgroundColor = '#f0f0f0';
      placeholder.style.borderRadius = '8px';
      placeholder.style.marginBottom = '12px';
      placeholder.style.display = 'flex';
      placeholder.style.alignItems = 'center';
      placeholder.style.justifyContent = 'center';
      placeholder.style.color = '#666';
      placeholder.style.fontSize = '14px';
      placeholder.style.textAlign = 'center';
      placeholder.style.padding = '12px';
      placeholder.style.border = '1px solid #e9ecef';
      placeholder.innerHTML = "This post doesn't have an image...<br/>☁️";
      card.appendChild(placeholder);
    } else if (post.image && post.platform && post.platform.toLowerCase() !== 'instagram') {
      // Only try to load images for non-Instagram platforms
      // Silence extraneous logs
      const image = document.createElement('img');
      image.style.width = '100%';
      image.style.height = '200px';
      image.style.objectFit = 'cover';
      image.style.borderRadius = '8px';
      image.style.marginBottom = '12px';
      
      // Add safer attributes
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.alt = `${post.platform} post image`;
      
      // Add error handling for broken images
      image.onerror = function() {
        const failedImg = this;
        chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_AS_DATA_URL', url: post.image }, (resp) => {
          if (resp && resp.ok && resp.dataUrl) {
            failedImg.onerror = null;
            failedImg.src = resp.dataUrl;
          } else {
            const placeholder = document.createElement('div');
            placeholder.style.width = '100%';
            placeholder.style.height = '200px';
            placeholder.style.backgroundColor = '#f0f0f0';
            placeholder.style.borderRadius = '8px';
            placeholder.style.marginBottom = '12px';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.style.color = '#999';
            placeholder.style.fontSize = '14px';
            placeholder.textContent = `${post.platform || 'Post'} Image`;
            failedImg.parentNode.replaceChild(placeholder, failedImg);
          }
        });
      };
      
      image.src = post.image;
      card.appendChild(image);
    } else if (post.platform && post.platform.toLowerCase() === 'instagram') {
      // Prefer Instagram embed iframe using the original post URL
      const originalUrl = String(post.originalPostUrl || '').split('?')[0].replace(/\/$/, '');
      if (originalUrl) {
        const embedUrl = `${originalUrl}/embed/captioned`;
        const iframe = document.createElement('iframe');
        iframe.src = embedUrl;
        iframe.allowTransparency = 'true';
        iframe.allowFullscreen = true;
        iframe.frameBorder = '0';
        iframe.scrolling = 'no';
        iframe.style.background = 'white';
        iframe.style.width = '100%';
        iframe.style.height = '640px';
        iframe.style.borderRadius = '8px';
        iframe.style.marginBottom = '12px';
        iframe.style.border = '1px solid #e9ecef';
        card.appendChild(iframe);
      } else if (post.image) {
        // Fallback to image if embed URL not available
        const image = document.createElement('img');
        image.style.width = '100%';
        image.style.height = '200px';
        image.style.objectFit = 'cover';
        image.style.borderRadius = '8px';
        image.style.marginBottom = '12px';
        image.onerror = function() {
          const failedImg = this;
          chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_AS_DATA_URL', url: post.image }, (resp) => {
            if (resp && resp.ok && resp.dataUrl) {
              failedImg.onerror = null;
              failedImg.src = resp.dataUrl;
            } else {
              const placeholder = document.createElement('div');
              placeholder.style.width = '100%';
              placeholder.style.height = '200px';
              placeholder.style.backgroundColor = '#f8f9fa';
              placeholder.style.borderRadius = '8px';
              placeholder.style.marginBottom = '12px';
              placeholder.style.display = 'flex';
              placeholder.style.flexDirection = 'column';
              placeholder.style.alignItems = 'center';
              placeholder.style.justifyContent = 'center';
              placeholder.style.color = '#666';
              placeholder.style.fontSize = '14px';
              placeholder.style.border = '1px solid #e9ecef';
              const iconText = document.createElement('div');
              iconText.textContent = '📷';
              iconText.style.fontSize = '32px';
              iconText.style.marginBottom = '8px';
              const labelText = document.createElement('div');
              labelText.textContent = 'Instagram Image';
              labelText.style.fontSize = '12px';
              labelText.style.color = '#999';
              placeholder.appendChild(iconText);
              placeholder.appendChild(labelText);
              failedImg.parentNode.replaceChild(placeholder, failedImg);
            }
          });
        };
        image.src = post.image;
        card.appendChild(image);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.width = '100%';
        placeholder.style.height = '200px';
        placeholder.style.backgroundColor = '#f8f9fa';
        placeholder.style.borderRadius = '8px';
        placeholder.style.marginBottom = '12px';
        placeholder.style.display = 'flex';
        placeholder.style.flexDirection = 'column';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = '#666';
        placeholder.style.fontSize = '14px';
        placeholder.style.border = '1px solid #e9ecef';
        const iconText = document.createElement('div');
        iconText.textContent = '📷';
        iconText.style.fontSize = '32px';
        iconText.style.marginBottom = '8px';
        const labelText = document.createElement('div');
        labelText.textContent = 'Instagram Image';
        labelText.style.fontSize = '12px';
        labelText.style.color = '#999';
        placeholder.appendChild(iconText);
        placeholder.appendChild(labelText);
        card.appendChild(placeholder);
      }
    }
    
    // For Instagram: embed already contains caption and link, so skip author/summary/link
    const isInstagram = post.platform && post.platform.toLowerCase() === 'instagram';
    if (!isInstagram) {
      // Add author (left-aligned title)
      const author = document.createElement('div');
      const cleanAuthor = (post.author || '').split('\n')[0] || '(Unknown Author)';
      author.textContent = cleanAuthor;
      author.style.fontWeight = 'bold';
      author.style.marginBottom = '0px'; // Removed spacing to make room for link
      author.style.fontSize = '18px';
      author.style.textAlign = 'left';
      card.appendChild(author);
      
      // Add summary (1-2 lines of text)
      const summary = document.createElement('div');
      let summaryText = post.openaiSummary || post.text;
      if (summaryText && /suggested post/i.test(summaryText)) {
        summaryText = post.text || '';
      }
      summary.textContent = summaryText || 'No summary available';
      summary.style.lineHeight = '1.4';
      summary.style.fontSize = '14px';
      summary.style.marginBottom = '0px'; // Removed spacing to make room for link
      summary.style.textAlign = 'left';
      summary.style.color = '#666';
      summary.style.display = '-webkit-box';
      summary.style.webkitBoxOrient = 'vertical';
      summary.style.webkitLineClamp = '3';
      summary.style.overflow = 'hidden';
      summary.style.maxHeight = '4.2em'; // approx 3 lines at 1.4 line-height
      card.appendChild(summary);
      
      // Add original post link (right-aligned, styled like other links)
      if (post.originalPostUrl) {
        const link = document.createElement('a');
        const postUrl = String(post.originalPostUrl || '').replace(/^@+/, '');
        link.textContent = 'View original post';
        link.href = postUrl;
        link.style.color = '#888';
        link.style.textDecoration = 'underline';
        link.style.fontSize = '14px';
        link.style.fontStyle = 'italic';
        link.style.textAlign = 'right';
        link.style.alignSelf = 'flex-end';
        link.style.marginTop = 'auto';
        link.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: postUrl });
        });
        card.appendChild(link);
      }
    }
    
    cardDeck.appendChild(card);
  });
  
  // Create controls container
  const controlsContainer = document.createElement('div');
  controlsContainer.classList.add('card-controls');
  controlsContainer.style.display = 'flex';
  controlsContainer.style.flexDirection = 'column';
  controlsContainer.style.alignItems = 'center';
  controlsContainer.style.marginTop = '40px';
  
  // Create Next button
  const nextButton = document.createElement('button');
  nextButton.classList.add('next-button');
  nextButton.textContent = 'Next';
  nextButton.addEventListener('click', handleDailyCardNext);
  
  // Create step indicator
  const stepIndicator = document.createElement('div');
  stepIndicator.classList.add('card-step-indicator');
  stepIndicator.id = 'card-step-indicator';
  stepIndicator.textContent = `1/${posts.length}`;
  stepIndicator.style.marginTop = '16px';
  
  // Add button and indicator to controls
  controlsContainer.appendChild(nextButton);
  controlsContainer.appendChild(stepIndicator);
  
  // Add elements to container
  cardsContainer.appendChild(cardDeck);
  cardsContainer.appendChild(controlsContainer);
  
  // Immediately make the container visible and animate to final position
  cardsContainer.style.opacity = '1';

  
  // Animate to final position immediately
  requestAnimationFrame(() => {
    cardsContainer.style.position = 'absolute'; // Back to original positioning
    cardsContainer.style.left = '50%';
    cardsContainer.style.top = '50%';
    cardsContainer.style.transform = 'translate(-50%, -50%) scale(1)'; // Full size, centered
  });
  
  // Animate cards appearing with stacked effect (no delay)
  posts.forEach((_, index) => {
    setTimeout(() => {
      const card = cardDeck.children[index];
      if (card) {
        card.classList.add('stacked');
        // Re-apply z-index after stacked class to ensure it takes priority
        card.style.zIndex = String(posts.length - index);
        console.log(`Card ${index}: z-index set to ${posts.length - index}`);
      }
    }, index * 100); // No additional delay
  });

  // Show Next button after all cards are stacked (reduced delay)
  setTimeout(() => {
    nextButton.classList.add('show');
    // Re-apply after animations settle
    applyZOrderAndInteractivityToDeck(cardDeck);
  }, posts.length * 100 + 200);
}

function handleDailyCardNext() {
  const { posts, totalCards } = window.cardDeckData || { posts: [], currentIndex: 0, totalCards: 0 };
  
  // If no posts, go directly to completion screen
  if (totalCards === 0) {
    showDailyComplete();
    return;
  }
  
  // Prevent rapid double clicks during transition
  if (window._cardAdvancing) return;
  
  const cardDeck = document.querySelector('#daily-cards .card-deck');
  const nextButton = document.querySelector('#daily-cards .next-button');
  const stepIndicator = document.getElementById('card-step-indicator');
  
  // Determine currentIndex from first visible card to avoid desync
  const visibleCards = Array.from(cardDeck.children).filter(el => el.style.display !== 'none');
  const topCard = visibleCards[0];
  const currentIndex = topCard ? Number(topCard.dataset.cardIndex || 0) : window.cardDeckData.currentIndex || 0;
  if (topCard) {
    window._cardAdvancing = true;
    topCard.classList.add('slide-away');
    setTimeout(() => {
      topCard.style.display = 'none';
      window.cardDeckData.currentIndex = currentIndex + 1;
      if (stepIndicator && window.cardDeckData.currentIndex < totalCards) {
        stepIndicator.textContent = `${window.cardDeckData.currentIndex + 1}/${totalCards}`;
      }
      // Re-apply z-order so the new card is interactable and on top
      const remaining = Array.from(cardDeck.children).filter(el => el.style.display !== 'none');
      const total = remaining.length;
      remaining.forEach((c, i) => {
        c.style.zIndex = String(total - i);
        c.style.pointerEvents = i === 0 ? 'auto' : 'none';
      });
      if (window.cardDeckData.currentIndex >= totalCards) {
        if (stepIndicator) stepIndicator.style.display = 'none';
        setTimeout(() => { nextButton.classList.remove('show'); }, 400);
        setTimeout(() => { showDailyComplete(); }, 1200);
      }
      window._cardAdvancing = false;
    }, 800);
  }
}

async function renderInScrapingTabs(posts) {
  try {
    // Get stored tab IDs for rendering
    const linkedinTabId = window.scrapeResults?.linkedinTabId;
    const instagramTabId = window.scrapeResults?.instagramTabId;
    
    // Separate posts by platform and render to appropriate tabs
    const linkedinPosts = posts.filter(p => p.platform?.toLowerCase() === 'linkedin');
    const instagramPosts = posts.filter(p => p.platform?.toLowerCase() === 'instagram');
    
    if (linkedinPosts.length > 0 && linkedinTabId) {
      console.log(`Rendering ${linkedinPosts.length} LinkedIn posts to tab ${linkedinTabId}`);
      try {
        await chrome.tabs.sendMessage(linkedinTabId, { type: 'S4M_RENDER_IN_PAGE', posts: linkedinPosts });
      } catch (error) {
        console.log('LinkedIn tab may have been closed already:', error);
      }
    }
    
    if (instagramPosts.length > 0 && instagramTabId) {
      console.log(`Rendering ${instagramPosts.length} Instagram posts to tab ${instagramTabId}`);
      try {
        await chrome.tabs.sendMessage(instagramTabId, { type: 'S4M_RENDER_IN_PAGE', posts: instagramPosts });
      } catch (error) {
        console.log('Instagram tab may have been closed already:', error);
      }
    }
  } catch (error) {
    console.error('Error rendering in scraping tabs:', error);
  }
}

function showDailyComplete() {
  // Calculate and update time saved
  updateTimeSavedStats();
  
  // Show completion screen
  showScreen('daily-complete');
}

async function updateTimeSavedStats() {
  // Get user's original scroll time from focus profile
  const focusProfile = await chrome.storage.local.get(['focusProfile']);
  const originalScrollTime = focusProfile.focusProfile?.dailyScrollTime || 45;
  
  // Calculate daily savings (original time - 5 minutes app usage)
  const dailySavings = Math.max(0, originalScrollTime - 5);
  
  // Get or initialize total saved time
  const savedData = await chrome.storage.local.get(['totalTimeSaved', 'sessionsCompleted']);
  const currentTotalSaved = savedData.totalTimeSaved || 0;
  const currentSessions = savedData.sessionsCompleted || 0;
  
  // Update totals
  const newTotalSaved = currentTotalSaved + dailySavings;
  const newSessions = currentSessions + 1;
  
  // Save updated stats
  chrome.storage.local.set({
    totalTimeSaved: newTotalSaved,
    sessionsCompleted: newSessions
  });
  
  // Update display
  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.round(minutes / 60 * 10) / 10;
    return `${hours} hours`;
  };
  
  document.getElementById('daily-time-saved').textContent = formatTime(dailySavings);
  document.getElementById('total-time-saved').textContent = formatTime(newTotalSaved);
  
  // Update profile screen stats
  document.getElementById('profile-total-saved').textContent = formatTime(newTotalSaved);
  document.getElementById('profile-sessions').textContent = newSessions;
}

function closeExtension() {
  // Close the Chrome extension popup
  window.close();
}

function editFocusProfileFlow() {
  // This would redirect to the onboarding flow to edit the focus profile
  // For now, just show an alert
  alert('Focus profile editing will be implemented - this would show the onboarding screens to edit your preferences');
}

// ----------------------
// Free Trial Management
// ----------------------
async function initializeTrialCounter() {
  const result = await chrome.storage.local.get(['trialScrollsLeft']);
  if (typeof result.trialScrollsLeft !== 'number') {
    await chrome.storage.local.set({ trialScrollsLeft: 5 });
  }
  updateTrialCounterDisplay();
}

async function updateTrialCounterDisplay() {
  const counterEl = document.getElementById('free-trial-counter');
  if (!counterEl) return;
  const result = await chrome.storage.local.get(['trialScrollsLeft', 'openaiApiKey']);
  const userHasKey = !!(result.openaiApiKey && result.openaiApiKey.trim());
  const left = typeof result.trialScrollsLeft === 'number' ? result.trialScrollsLeft : 5;
  if (userHasKey) {
    counterEl.textContent = '';
  } else {
    counterEl.textContent = `${left} free scroll${left === 1 ? '' : 's'} left`;
  }
}

async function decrementTrialIfUsed() {
  const result = await chrome.storage.local.get(['openaiApiKey', 'trialScrollsLeft']);
  const userHasKey = !!(result.openaiApiKey && result.openaiApiKey.trim());
  let left = typeof result.trialScrollsLeft === 'number' ? result.trialScrollsLeft : 5;
  if (!userHasKey && left > 0) {
    left = left - 1;
    await chrome.storage.local.set({ trialScrollsLeft: left });
  }
  updateTrialCounterDisplay();
}

async function guardedStartDailyScroll() {
  const result = await chrome.storage.local.get(['openaiApiKey', 'trialScrollsLeft']);
  const userHasKey = !!(result.openaiApiKey && result.openaiApiKey.trim());
  const left = typeof result.trialScrollsLeft === 'number' ? result.trialScrollsLeft : 5;
  if (!userHasKey && left <= 0) {
    alert('You have used all 5 free scrolls. Please add your API key in Profile to continue.');
    showScreen('profile-screen');
    return;
  }
  await startDailyScroll();
}

// Enhanced ChatGPT filtering function with batching and better limits
async function filterWithChatGPT(posts, positiveInput, negativeInput) {
  // No hardcoded keys. We read from chrome.storage.local only.
  
  // posts: raw scraped posts from both platforms
  // Build the privacy-clean set first and ONLY send those
  const publicPosts = posts.filter(p => p?.isPublic === true);
  // Optional: lightweight quality pass
  const qualityPosts = publicPosts.filter(p => (p.text && p.text.trim().length > 0) || p.image);

  // Only log via wrapper below
  updateLoadingProgress(`Analyzing ${qualityPosts.length} public posts with AI...`);
  
  // Get API key from storage
  const stored = await chrome.storage.local.get(['openaiApiKey', 'trialScrollsLeft']);
  let apiKey = (stored.openaiApiKey || '').trim();
  let usingTrial = false;
  if (!apiKey) {
    // Use Ilse's trial key if available and trials remain
    const trialsLeft = typeof stored.trialScrollsLeft === 'number' ? stored.trialScrollsLeft : 5;
    if (trialsLeft > 0) {
      apiKey = TRIAL_OPENAI_KEY;
      usingTrial = true;
    }
  }
  if (!apiKey) {
    console.warn('No OpenAI API key set and no trial left; skipping AI filter.');
    return { relevant_posts: [] };
  }
  
  const privatePostsCount = posts.length - publicPosts.length;
  // Silence extraneous logs
  updateLoadingProgress(`Privacy protection: Excluded ${privatePostsCount} private posts. Analyzing ${qualityPosts.length} public posts...`);
  
  // Process posts in batches to avoid token limits
  const BATCH_SIZE = 8; // Smaller batches to avoid token limits on gpt-5
  const allRelevantPosts = [];
  const totalBatches = Math.ceil(qualityPosts.length / BATCH_SIZE);
  
  for (let i = 0; i < qualityPosts.length; i += BATCH_SIZE) {
    const batch = qualityPosts.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i/BATCH_SIZE) + 1;
    
    // Silence extraneous logs
    updateLoadingProgress(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} posts)...`);
    
    try {
      const batchResults = await processBatchWithChatGPT(batch, positiveInput, negativeInput, apiKey);
      if (batchResults && batchResults.relevant_posts) {
        allRelevantPosts.push(...batchResults.relevant_posts);
        updateLoadingProgress(`Batch ${batchNumber}/${totalBatches} complete. Found ${batchResults.relevant_posts.length} relevant posts.`);
      }
    } catch (error) {
      console.error(`Error processing batch ${batchNumber}:`, error);
      updateLoadingProgress(`Batch ${batchNumber}/${totalBatches} failed. Continuing...`);
      // Continue with next batch even if one fails
    }
    
    // Add a small delay between requests to avoid rate limiting
    if (i + BATCH_SIZE < qualityPosts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Select top ~15% by model-provided relevance score across all batches
  const totalCount = qualityPosts.length;
  const cap = Math.max(1, Math.ceil(totalCount * 0.10));
  const uniqueByUrl = new Map();
  for (const p of allRelevantPosts) {
    const key = p.originalPostUrl || `${p.platform}|${(p.author||'').slice(0,50)}|${(p.openaiSummary||'').slice(0,50)}`;
    if (!uniqueByUrl.has(key)) uniqueByUrl.set(key, p);
  }
  const deduped = Array.from(uniqueByUrl.values());
  const scored = deduped.map(p => ({ post: p, score: typeof p.relevance_score === 'number' ? p.relevance_score : 0 }))
                        .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, cap).map(s => s.post);
  updateLoadingProgress(`Selected ${top.length}/${totalCount} posts (~15%) by model relevance.`);
  return { relevant_posts: top };
}

// Update loading screen with progress information
function updateLoadingProgress(message) {
  const progressInfo = document.getElementById('progress-info');
  const loadingSubtitle = document.getElementById('loading-subtitle');
  
  if (progressInfo && loadingSubtitle) {
    loadingSubtitle.textContent = "Analyzing with AI...";
    progressInfo.style.display = 'block';
    progressInfo.textContent = message;
  }
}

// Process a single batch of posts with ChatGPT
async function processBatchWithChatGPT(posts, positiveInput, negativeInput, apiKey) {
  const systemPrompt = `You are an assistant that helps users filter and prioritize social media content (LinkedIn, Instagram, etc.).
Each day, the user provides their current interests and exclusions. You also have access to their general bio and persistent preferences.

Your task is to determine whether each post is RELEVANT to the user today, using semantic analysis of content, tone, tags, and visual context — regardless of platform.`;

  // Get user's focus profile from storage
  const focusProfile = await getFocusProfile();
  const userProfile = `Focus Profile:
Daily interests: ${focusProfile.dailyTags}
Weekly preferences: ${focusProfile.weeklyRules}
Selected platforms: ${focusProfile.platforms}`;

  const todayInputs = `Today's inputs:
Consider a post RELEVANT if it clearly aligns with any of these: ${positiveInput || 'general professional insights'}
Exclude posts ONLY if explicitly mentioned. (${negativeInput ? 'Today: ' + negativeInput : 'Today: nothing to exclude'})`;

  const requireInstagram = Array.isArray(focusProfile.selectedPlatforms) && focusProfile.selectedPlatforms.includes('instagram');

  // Build simplified payload from posts
  const simplifiedPosts = posts.map(post => ({
    platform: post.platform,
    author: post.author,
    text: (post.text || '').slice(0, 600),
    hasImage: !!post.image,  // Only send boolean, not the actual image URL
    url: post.originalPostUrl
  }));

  // If Instagram is selected, append a short instruction reminding the model of the pool composition
  const platformCompositionHint = (() => {
    if (!requireInstagram) return '';
    const total = posts.length;
    const instaCount = posts.filter(p => (p.platform || '').toLowerCase() === 'instagram').length;
    if (instaCount > 0) {
      return `\nInput pool contains ${instaCount} Instagram posts out of ${total} total.`;
    }
    return '';
  })();

  const prompt = `
${systemPrompt}

---

${userProfile}

${todayInputs}

${requireInstagram ? `\nImportant platform rule:\n- The user has selected Instagram. In your final selection, ensure at least one Instagram post is included among the relevant posts (if any Instagram posts are present in the input and they meet the relevance criteria). If none of the Instagram posts are relevant, you may include the single best available Instagram post that is most semantically aligned with today's interests, but prefer truly relevant posts whenever possible.\n` : ''}

---

### Relevance Matching Guidelines

Match each post to the above profile using semantic meaning, not just exact keywords. Assign a focusTag only if the post clearly aligns with one of the user's interests.

When evaluating relevance, apply semantic expansion:
- Recognize related people, activities, terminology, and cultural references tied to each interest.
- For example:
   - Bouldering includes: climbing gyms, lead climbing, Moonboard, Janja Garnbret, IFSC competitions, indoor climbing events
   - Style includes: fashion inspiration, outfits, wardrobe posts, beauty aesthetics
   - Jobs includes: hiring, vacancies, job tips, career transitions, job offers
   - Events includes: exhibitions, parties, launches, conferences, meetups

Assign focusTag based on the closest matching interest, even if the post uses different wording or focuses on a public figure relevant to the tag.

Provide a numeric relevance_score from 0 to 100 for each candidate you include, where 100 is a perfect match. Use this to help select the strongest posts.

Selection size constraint:
- Return NO MORE THAN 10% of the input posts (round up). If fewer posts are truly relevant, return fewer. If more than 10% seem relevant, choose the strongest subset that best matches today's interests and provides diversity across tags/platforms.

If no post strictly matches the above criteria, return up to 3 "best available" posts selected based on:
- Semantic similarity to focus tags
- Relevance to user's general bio and long-term interests
- Post engagement or recency (if available)

---

For the JSON array of posts below, analyze each against the Focus Profile and Today's inputs.
For RELEVANT posts, return a JSON object with fields:
- author
- openaiSummary (max 15 words)
- hasImage (boolean)
- originalPostUrl
- platform
- focusTag (one of the user's interests)
 - relevance_score (0-100)

Return JSON: {"relevant_posts": [array of relevant posts]}

Posts to analyze:${platformCompositionHint}
${JSON.stringify(simplifiedPosts, null, 1)}
`;

  console.log('OpenAI prompt:', prompt);

  try {
    const bgResp = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'OPENAI_CHAT_COMPLETIONS',
        apiKey,
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }, resolve);
    });

    if (!bgResp || !bgResp.ok) {
      const status = bgResp && typeof bgResp.status !== 'undefined' ? bgResp.status : 'unknown';
      const err = bgResp && (bgResp.error || (bgResp.data && bgResp.data.error && bgResp.data.error.message)) || 'background request failed';
      console.error('OpenAI API Error (background):', { status, err });
      if (status === 401 || err === 'missing_api_key') {
        updateLoadingProgress('Invalid or missing OpenAI API key. Please add your key in Profile.');
      } else {
        updateLoadingProgress(`AI request failed (${status}). Falling back to local scoring...`);
      }
      return { relevant_posts: [] };
    }

    const responseData = bgResp.data;

    if (responseData.error) {
      console.error('OpenAI API Error:', responseData.error);
      updateLoadingProgress('AI error received. Falling back to local scoring...');
      return { relevant_posts: [] };
    }

    const content = responseData.choices[0]?.message?.content;

    const parsedContent = JSON.parse(content);
    
    // Restore full image URLs from original posts
    if (parsedContent.relevant_posts) {
      parsedContent.relevant_posts = parsedContent.relevant_posts.map(relevantPost => {
        const originalPost = posts.find(p => p.originalPostUrl === relevantPost.originalPostUrl);
        if (originalPost) {
          // Restore missing fields from original scrape
          relevantPost.platform = relevantPost.platform || originalPost.platform;
          relevantPost.author = (originalPost.author?.split('\n')[0]) || relevantPost.author;
          relevantPost.image = originalPost.image;
          if (originalPost.imageElementId) relevantPost.imageElementId = originalPost.imageElementId;
          if (!relevantPost.text && originalPost.text) relevantPost.text = originalPost.text;
          if (!relevantPost.openaiSummary && originalPost.text) {
            relevantPost.openaiSummary = originalPost.text.split(/\s+/).slice(0, 15).join(' ');
          }
        }
        return relevantPost;
      });
    }

    // Fallback: if model returned none, pick up to 3 strongest candidates locally
    if (!parsedContent.relevant_posts || parsedContent.relevant_posts.length === 0) {
      const scored = posts.map((p, i) => {
        const text = (p.text || '').toLowerCase();
        const tags = (focusProfile?.dailyTags || '').toLowerCase();
        let score = 0;
        // naive scoring by tag presence and length
        tags.split(',').forEach(tag => {
          const t = tag.trim();
          if (!t) return;
          if (text.includes(t)) score += 3;
        });
        if (p.image) score += 1; // slight bonus for image
        return { p, score, i };
      }).sort((a, b) => b.score - a.score || a.i - b.i);

      const picked = scored.slice(0, Math.min(3, scored.length)).map(s => ({
        author: s.p.author?.split('\n')[0] || '(unknown)',
        openaiSummary: (s.p.text || '').split(/\s+/).slice(0, 15).join(' '),
        hasImage: !!s.p.image,
        originalPostUrl: s.p.originalPostUrl,
        platform: s.p.platform,
        focusTag: 'Best Available'
      }));

      parsedContent.relevant_posts = picked;
    }

    console.log(`Batch processed: ${parsedContent.relevant_posts?.length || 0} relevant posts found`);
    // If we used a trial key, decrement once per overall session (handled outside per-batch).
    return parsedContent;
  } catch (error) {
    console.error('ChatGPT API Error for batch:', error);
    return { relevant_posts: [] };
  }
}

// New function to securely retrieve API key
async function getOpenAIApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['openai_api_key'], (result) => {
      resolve(result.openai_api_key || '');
    });
  });
}

// Function to get focus profile from storage
async function getFocusProfile() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['focusProfile'], (result) => {
      if (result.focusProfile) {
        const profile = result.focusProfile;
        const dailyTags = [...(profile.linkedinTags || []), ...(profile.instagramTags || [])].join(', ') || 'No specific daily interests set';
        const weeklyRules = [...(profile.linkedinWeeklyRules || []), ...(profile.instagramWeeklyRules || [])];
        const weeklyText = weeklyRules.length > 0 ? 
          weeklyRules.map(rule => `${rule.day}: ${rule.text}`).join('; ') : 
          'No weekly preferences set';
        const platforms = profile.selectedPlatforms ? profile.selectedPlatforms.join(', ') : 'LinkedIn, Instagram';
        
        resolve({
          dailyTags,
          weeklyRules: weeklyText,
          platforms,
          selectedPlatforms: profile.selectedPlatforms || ['linkedin', 'instagram'] // Add the actual array
        });
      } else {
        // Default profile if no onboarding completed
        resolve({
          dailyTags: 'General professional insights, AI, design, technology',
          weeklyRules: 'No weekly preferences set',
          platforms: 'LinkedIn, Instagram',
          selectedPlatforms: ['linkedin', 'instagram']
        });
      }
    });
  });
}

async function loadProfileData() {
  console.log('Loading profile data...');
  
  try {
    // Get current focus profile from storage for detailed platform info
    const result = await chrome.storage.local.get(['focusProfile']);
    
    if (result.focusProfile) {
      const profile = result.focusProfile;
      const selectedPlatforms = profile.selectedPlatforms || [];
      
      // Update LinkedIn info
      const linkedinInfoElement = document.getElementById('profile-linkedin-info');
      if (linkedinInfoElement) {
        if (selectedPlatforms.includes('linkedin')) {
          const linkedinTags = profile.linkedinTags || [];
          const linkedinWeekly = profile.linkedinWeeklyRules || [];
          
          let linkedinText = '';
          if (linkedinTags.length > 0) {
            linkedinText += `Daily: ${linkedinTags.join(', ')}`;
          }
          if (linkedinWeekly.length > 0) {
            if (linkedinText) linkedinText += ' | ';
            linkedinText += `Weekly: ${linkedinWeekly.map(rule => `${rule.day}: ${rule.text}`).join(', ')}`;
          }
          if (!linkedinText) {
            linkedinText = 'No specific interests set';
          }
          
          linkedinInfoElement.textContent = linkedinText;
          console.log('Updated LinkedIn info:', linkedinText);
        } else {
          linkedinInfoElement.textContent = 'Not using this platform';
          console.log('LinkedIn not selected');
        }
      }
      
      // Update Instagram info
      const instagramInfoElement = document.getElementById('profile-instagram-info');
      if (instagramInfoElement) {
        if (selectedPlatforms.includes('instagram')) {
          const instagramTags = profile.instagramTags || [];
          const instagramWeekly = profile.instagramWeeklyRules || [];
          
          let instagramText = '';
          if (instagramTags.length > 0) {
            instagramText += `Daily: ${instagramTags.join(', ')}`;
          }
          if (instagramWeekly.length > 0) {
            if (instagramText) instagramText += ' | ';
            instagramText += `Weekly: ${instagramWeekly.map(rule => `${rule.day}: ${rule.text}`).join(', ')}`;
          }
          if (!instagramText) {
            instagramText = 'No specific interests set';
          }
          
          instagramInfoElement.textContent = instagramText;
          console.log('Updated Instagram info:', instagramText);
        } else {
          instagramInfoElement.textContent = 'Not using this platform';
          console.log('Instagram not selected');
        }
      }
    } else {
      // No profile found, show defaults
      const linkedinInfoElement = document.getElementById('profile-linkedin-info');
      const instagramInfoElement = document.getElementById('profile-instagram-info');
      
      if (linkedinInfoElement) linkedinInfoElement.textContent = 'No focus profile found';
      if (instagramInfoElement) instagramInfoElement.textContent = 'No focus profile found';
    }
    
    // Load and update time saved stats
    await updateProfileStats();
    
    // Load saved API key
    await loadApiKey();
    
  } catch (error) {
    console.error('Error loading profile data:', error);
  }
}

async function updateProfileStats() {
  try {
    // Get saved stats
    const result = await chrome.storage.local.get(['totalTimeSaved', 'sessionsCompleted', 'totalSessions']);
    
    // Update total time saved
    const totalSavedElement = document.getElementById('profile-total-saved');
    if (totalSavedElement) {
      const totalMinutes = result.totalTimeSaved || 0;
      const timeText = totalMinutes < 60
        ? `${totalMinutes} minutes`
        : `${Math.round((totalMinutes / 60) * 10) / 10} hours`;
      totalSavedElement.textContent = timeText;
      console.log('Updated total time saved:', timeText);
    }
    
    // Update total sessions
    const totalSessionsElement = document.getElementById('profile-sessions');
    if (totalSessionsElement) {
      // Prefer new key; fall back to legacy key if present
      const sessions = (typeof result.sessionsCompleted === 'number')
        ? result.sessionsCompleted
        : (result.totalSessions || 0);
      totalSessionsElement.textContent = sessions.toString();
      console.log('Updated total sessions:', sessions);
    }
    
  } catch (error) {
    console.error('Error updating profile stats:', error);
  }
}

async function loadApiKey() {
  try {
    // Load saved API key
    const result = await chrome.storage.local.get(['openaiApiKey']);
    const apiKeyInput = document.getElementById('api-key-input');
    
    if (apiKeyInput && result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
      console.log('Loaded saved API key');
    }
    
  } catch (error) {
    console.error('Error loading API key:', error);
  }
}

async function loadCurrentProfileForEditing() {
  console.log('Loading current profile for editing...');
  
  try {
    // Get current focus profile from storage
    const result = await chrome.storage.local.get(['focusProfile']);
    
    if (result.focusProfile) {
      const profile = result.focusProfile;
      console.log('Current profile found:', profile);
      
      // Load current data into onboarding structure
      onboardingData = {
        selectedPlatforms: profile.selectedPlatforms || ['linkedin', 'instagram'],
        linkedinTags: profile.linkedinTags || [],
        instagramTags: profile.instagramTags || [],
        linkedinWeeklyRules: profile.linkedinWeeklyRules || [],
        instagramWeeklyRules: profile.instagramWeeklyRules || [],
        dailyScrollTime: profile.dailyScrollTime || 45
      };
      
      console.log('Loaded current profile into onboarding data:', onboardingData);
    } else {
      console.log('No current profile found, starting with defaults');
      // Initialize with defaults
      onboardingData = {
        selectedPlatforms: ['linkedin', 'instagram'],
        linkedinTags: [],
        instagramTags: [],
        linkedinWeeklyRules: [],
        instagramWeeklyRules: [],
        dailyScrollTime: 45
      };
    }
    
  } catch (error) {
    console.error('Error loading current profile for editing:', error);
    // Fallback to defaults
    onboardingData = {
      selectedPlatforms: ['linkedin', 'instagram'],
      linkedinTags: [],
      instagramTags: [],
      linkedinWeeklyRules: [],
      instagramWeeklyRules: [],
      dailyScrollTime: 45
    };
  }
}

function scrapeContent(site) {
  let posts = [];
  if (site === 'linkedin') {
    // LinkedIn: prioritize full post images over profile images
    document.querySelectorAll('div[data-urn]').forEach(postEl => {
      const text = Array.from(postEl.querySelectorAll('span[dir="ltr"]')).map(e => e.innerText).join('\n');
      
      // Prioritize larger images that are likely post images
      const images = Array.from(postEl.querySelectorAll('img'))
        .filter(img => {
          // Exclude small profile images and icons
          const parentWidth = img.parentElement?.clientWidth || 0;
          const parentHeight = img.parentElement?.clientHeight || 0;
          return (
            parentWidth > 200 && // Likely a full post image
            parentHeight > 100 &&
            !img.alt.includes('profile') && // Exclude profile images
            !img.classList.contains('avatar') // Exclude avatar images
          );
        })
        .map(img => img.src);
      
      // Try to find the link to the original post
      const postLink = postEl.querySelector('a[href*="/posts/"]');
      const originalPostUrl = postLink ? postLink.href : null;
      
      if (text.trim() || images.length) {
        posts.push({ 
          text, 
          image: images.length > 0 ? images[0] : null,
          originalPostUrl
        });
      }
    });
  } else if (site === 'instagram') {
    // Instagram: target full post images
    document.querySelectorAll('article').forEach(postEl => {
      const text = Array.from(postEl.querySelectorAll('h2, h3, span')).map(e => e.innerText).join('\n');
      
      // Prioritize larger images in the post
      const images = Array.from(postEl.querySelectorAll('img'))
        .filter(img => {
          const parentWidth = img.parentElement?.clientWidth || 0;
          const parentHeight = img.parentElement?.clientHeight || 0;
          return (
            parentWidth > 300 && // Larger images likely to be post images
            parentHeight > 200
          );
        })
        .map(img => img.src);
      
      // Try to find the link to the original post
      const postLink = postEl.querySelector('a[href*="/p/"]');
      const originalPostUrl = postLink ? `https://www.instagram.com${postLink.getAttribute('href')}` : null;
      
      if (text.trim() || images.length) {
        posts.push({ 
          text, 
          image: images.length > 0 ? images[0] : null,
          originalPostUrl
        });
      }
    });
  } else if (site === 'news') {
    // News: target article main images
    document.querySelectorAll('article, section').forEach(postEl => {
      const text = Array.from(postEl.querySelectorAll('h1, h2, h3, p')).map(e => e.innerText).join('\n');
      
      // Find main article images
      const images = Array.from(postEl.querySelectorAll('img'))
        .filter(img => {
          const parentWidth = img.parentElement?.clientWidth || 0;
          const parentHeight = img.parentElement?.clientHeight || 0;
          return (
            parentWidth > 300 && // Larger images likely to be main article images
            parentHeight > 200 &&
            !img.alt.includes('logo') // Exclude logos
          );
        })
        .map(img => img.src);
      
      // Try to find the link to the original article
      const postLink = postEl.querySelector('a[href^="http"]');
      const originalPostUrl = postLink ? postLink.href : null;
      
      if (text.trim() || images.length) {
        posts.push({ 
          text, 
          image: images.length > 0 ? images[0] : null,
          originalPostUrl
        });
      }
    });
  }
  return posts;
} 