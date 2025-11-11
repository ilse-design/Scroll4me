chrome.storage.local.get('scrapeData', (data) => {
  if (!data.scrapeData) {
    document.getElementById('results').textContent = 'No data found.';
    return;
  }

  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = ''; // Clear previous content

  data.scrapeData.forEach(item => {
    const card = document.createElement('div');
    card.classList.add('result-card');
    
    // Only use the OpenAI summary, ensuring no original text is shown
    card.innerHTML = `
      <h3>${item.category || 'Uncategorized'}</h3>
      <p>${item.openaiSummary || 'No summary available'}</p>
    `;
    
    resultsContainer.appendChild(card);
  });
}); 