const room = new WebsimSocket();

// Move refreshFeed declaration to global scope
let refreshFeed; // Will be initialized by initializeCommunityFeatures

async function generateArticle() {
  const inputText = document.getElementById('inputText').value;
  const itemNumber = document.getElementById('itemNumber').value || 'SCP-XXXX';
  const objectClassSelect = document.getElementById('objectClass');
  const disruptionClass = document.getElementById('disruptionClass').value;
  const riskClass = document.getElementById('riskClass').value;
  const clearanceLevel = document.getElementById('clearanceLevel').value;
  let objectClass = objectClassSelect.value;
  
  // Handle esoteric object class
  if (objectClass === 'Esoteric') {
    const customName = document.getElementById('customObjectClassName').value;
    const customDesc = document.getElementById('customObjectClassDescription').value;
    if (!customName || !customDesc) {
      alert('Please provide both name and description for esoteric object class.');
      return;
    }
    objectClass = `${customName}\n\nObject Class Description: ${customDesc}`;
  }

  const articleLengthSelect = document.getElementById('articleLength');
  let articleLength;
  if (articleLengthSelect.value === 'custom') {
    const customWordCount = document.getElementById('customWordCount');
    articleLength = parseInt(customWordCount.value);
  } else {
    articleLength = parseInt(articleLengthSelect.value);
  }

  // Validate inputs
  if (!inputText) {
    alert('Please provide a description of the anomalous entity/object.');
    return;
  }

  if (!articleLength || isNaN(articleLength)) {
    alert('Please select a valid article length.');
    return;
  }

  // Show loading indicator
  document.getElementById('loadingIndicator').classList.remove('hidden');
  document.getElementById('articleOutput').textContent = '';

  // First, analyze the classifications if needed
  let finalDisruptionClass = disruptionClass;
  let finalRiskClass = riskClass;
  let finalClearanceLevel = clearanceLevel;

  try {
    // Get classifications if any are missing
    if (!disruptionClass || !riskClass || !clearanceLevel) {
      const analysisResponse = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Given the following anomalous entity description, determine appropriate classifications.
          
          Description: ${inputText}
          
          Format your response as:
          {
            "disruptionClass": "Dark" | "Vlam" | "Keneq" | "Ehki" | "Amidia",
            "riskClass": "Notice" | "Caution" | "Warning" | "Danger" | "Critical",
            "clearanceLevel": "Level 1" | "Level 2" | "Level 3" | "Level 4" | "Level 5" | "Level 6"
          }
          
          Base your analysis on:
          - Disruption: scale of effect (individual to universal)
          - Risk: severity of effects (minimal to extreme)
          - Clearance: required security level (unrestricted to cosmic top secret)`,
          data: inputText
        }),
      });
      
      if (!analysisResponse.ok) {
        throw new Error('Failed to analyze classifications');
      }
      
      const analysisData = await analysisResponse.json();
      finalDisruptionClass = disruptionClass || analysisData.disruptionClass;
      finalRiskClass = riskClass || analysisData.riskClass;
      finalClearanceLevel = clearanceLevel || analysisData.clearanceLevel;
    }

    // Split the article generation into sections
    const detailSelections = Array.from(document.querySelectorAll('.toggle-button.active'))
      .map(button => button.dataset.detail);
    const sections = ['containment', 'description', ...detailSelections];
    let finalArticle = '';

    // Generate the header first
    const header = `CLEARANCE LEVEL ${finalClearanceLevel}
ITEM #: ${itemNumber}
OBJECT CLASS: ${objectClass || '[PENDING CLASSIFICATION]'}
DISRUPTION CLASS: ${finalDisruptionClass}
RISK CLASS: ${finalRiskClass}

`;
    finalArticle = header;
    
    // Generate each section
    for (const section of sections) {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Generate the "${section}" section of an SCP article with these parameters:
          
          Entity Description: ${inputText}
          Section: ${section}
          Target Length: ${Math.floor(articleLength / sections.length)} words
          
          Article Parameters:
          - Item #: ${itemNumber}
          - Object Class: ${objectClass || '[PENDING]'}
          - Disruption Class: ${finalDisruptionClass}
          - Risk Class: ${finalRiskClass}
          - Clearance Level: ${finalClearanceLevel}
          
          Format Response as:
          {
            "content": "Your generated section text here..."
          }
          
          Use proper SCP documentation style. Be specific and detailed.
          For containment, focus on practical procedures.
          For description, be clinical and objective.
          For additional sections, maintain consistent tone and relevance.`,
          temperature: 0.8,
          max_tokens: Math.min(2000, Math.floor(articleLength * 2))
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate ${section} section`);
      }

      const data = await response.json();
      
      if (!data || !data.content) {
        throw new Error(`Invalid response for ${section} section`);
      }

      const sectionHeader = section.charAt(0).toUpperCase() + section.slice(1);
      finalArticle += `${sectionHeader}:\n${data.content}\n\n`;

      // Update output in real-time
      const articleOutput = document.getElementById('articleOutput');
      articleOutput.textContent = finalArticle;
      
      // Add classified styling
      articleOutput.innerHTML = articleOutput.textContent.replace(
        /(SCP-[\d]+|Object Class:|Special Containment Procedures:|Description:|Recovery Log:|Incident Report:|Test Log:|Interview Log:|Addendum:|Personnel:|Analysis:|Document History:|Related Anomalies:|Associated Media:)/g,
        '<span class="classified">$1</span>'
      );
    }

  } catch (error) {
    console.error('Error generating article:', error);
    document.getElementById('articleOutput').textContent = 
      'An error occurred while generating the SCP article. Please try again. If the problem persists, try refreshing the page.';
  } finally {
    document.getElementById('loadingIndicator').classList.add('hidden');
  }
}

async function generateRandomPrompt() {
  try {
    const response = await fetch('/api/ai_completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        prompt: `Generate a random, creative prompt for an SCP article. This should be a brief description that could inspire an interesting SCP entry. Make it unique and unexpected, combining different elements in novel ways. The prompt should be 2-3 sentences long.

        interface Response {
          prompt: string;
        }
        
        Example response:
        {
          "prompt": "A perfectly normal household toaster that, when used, creates toast with images of future disasters burned into them. The images always predict real events that will occur within the next 24 hours, but the toast must be eaten to prevent the disaster from happening."
        }`,
        data: "random_prompt"
      }),
    });

    const data = await response.json();
    document.getElementById('inputText').value = data.prompt;
  } catch (error) {
    console.error('Error generating random prompt:', error);
    document.getElementById('inputText').value = 'Error generating random prompt. Please try again.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const generateButton = document.getElementById('generateButton');
  const randomPromptButton = document.getElementById('randomPromptButton');
  const bunnyImage = document.getElementById('headerBunny');
  const logoImage = document.querySelector('.header-logo');
  const squeakSound = new Audio('squeak.wav');
  const defconAlarm = new Audio('DEFCON alarm sound effect. 4.wav');
  const bgMusic = document.getElementById('bgMusic');
  
  // Add music controls
  let musicStarted = false;
  let musicEnabled = true;
  const musicToggleBtn = document.getElementById('musicToggleBtn');

  function updateMusicButtonState() {
    musicToggleBtn.textContent = musicEnabled ? " Disable Music" : " Enable Music";
    musicToggleBtn.classList.toggle('active', musicEnabled);
  }

  function toggleMusic() {
    musicEnabled = !musicEnabled;
    if (musicEnabled) {
      bgMusic.play();
    } else {
      bgMusic.pause();
    }
    updateMusicButtonState();
  }

  function startMusic() {
    if (!musicStarted && musicEnabled) {
      bgMusic.volume = 0.3; // Set a comfortable volume
      bgMusic.play();
      musicStarted = true;
    }
  }

  // Start music on first user interaction
  document.body.addEventListener('click', startMusic, { once: true });
  musicToggleBtn.addEventListener('click', toggleMusic);

  generateButton.addEventListener('click', generateArticle);
  randomPromptButton.addEventListener('click', generateRandomPrompt);

  logoImage.addEventListener('click', () => {
    defconAlarm.volume = 0.3; // Set a comfortable volume
    defconAlarm.currentTime = 0;
    defconAlarm.play();
  });

  bunnyImage.addEventListener('click', () => {
    squeakSound.volume = 0.2; 
    squeakSound.currentTime = 0;
    squeakSound.play();
  });

  document.querySelectorAll('.toggle-button').forEach(button => {
    button.addEventListener('click', () => {
      button.classList.toggle('active');
    });
  });

  const itemNumberInput = document.getElementById('itemNumber');
  itemNumberInput.addEventListener('input', (e) => {
    const value = e.target.value.toUpperCase();
    if (value && !value.match(/^SCP-\d*$/)) {
      itemNumberInput.setCustomValidity('Format must be SCP-#### (numbers only)');
    } else {
      itemNumberInput.setCustomValidity('');
    }
  });

  // Add custom object class handling
  const objectClassSelect = document.getElementById('objectClass');
  const customObjectClassFields = document.getElementById('customObjectClassFields');

  objectClassSelect.addEventListener('change', (e) => {
    if (e.target.value === 'Esoteric') {
      customObjectClassFields.classList.remove('hidden');
    } else {
      customObjectClassFields.classList.add('hidden');
    }
  });

  // Add custom article length handling
  const articleLengthSelect = document.getElementById('articleLength');
  const customLengthField = document.getElementById('customLengthField');
  const customWordCount = document.getElementById('customWordCount');

  articleLengthSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      customLengthField.classList.remove('hidden');
    } else {
      customLengthField.classList.add('hidden');
    }
  });

  customWordCount.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    if (value < 1) {
      e.target.value = 1;
    } else if (value > 100000000) {
      e.target.value = 100000000;
    }
  });

  // Add save functionality
  const saveButton = document.getElementById('saveButton');
  const viewSavedButton = document.getElementById('viewSavedButton');
  const savedArticlesModal = document.getElementById('savedArticlesModal');
  const closeModalButton = document.querySelector('.close-button');
  const savedArticlesList = document.getElementById('savedArticlesList');

  function formatDate(date) {
    return new Date(date).toLocaleString();
  }

  function getSavedArticles() {
    const saved = localStorage.getItem('savedArticles');
    return saved ? JSON.parse(saved) : [];
  }

  function saveArticle(article) {
    const savedArticles = getSavedArticles();
    const newArticle = {
      id: Date.now(),
      content: article,
      date: new Date().toISOString(),
      itemNumber: document.getElementById('itemNumber').value || 'SCP-XXXX'
    };
    savedArticles.push(newArticle);
    localStorage.setItem('savedArticles', JSON.stringify(savedArticles));
  }

  function deleteArticle(id) {
    const savedArticles = getSavedArticles();
    const updatedArticles = savedArticles.filter(article => article.id !== id);
    localStorage.setItem('savedArticles', JSON.stringify(updatedArticles));
    displaySavedArticles();
  }

  function displaySavedArticles() {
    const savedArticles = getSavedArticles();
    savedArticlesList.innerHTML = '';

    if (savedArticles.length === 0) {
      savedArticlesList.innerHTML = '<p>No saved articles found.</p>';
      return;
    }

    savedArticles.reverse().forEach(article => {
      const articleElement = document.createElement('div');
      articleElement.className = 'saved-article';
      articleElement.innerHTML = `
        <div class="saved-article-header">
          <h3 class="saved-article-title">${article.itemNumber}</h3>
          <span class="saved-article-date">${formatDate(article.date)}</span>
          <div class="article-actions">
            <button class="delete-article" data-id="${article.id}">Delete</button>
          </div>
        </div>
        <div class="saved-article-content">${article.content}</div>
      `;
      savedArticlesList.appendChild(articleElement);
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-article').forEach(button => {
      button.addEventListener('click', (e) => {
        if (confirm('Are you sure you want to delete this article?')) {
          deleteArticle(Number(e.target.dataset.id));
        }
      });
    });
  }

  // Enable save button only when there's generated content
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.id === 'articleOutput') {
        const hasContent = !!mutation.target.textContent.trim();
        saveButton.disabled = !hasContent;
        document.getElementById('shareButton').disabled = !hasContent;
      }
    });
  });

  observer.observe(document.getElementById('articleOutput'), {
    childList: true,
    characterData: true,
    subtree: true
  });

  // Event listeners for save functionality
  saveButton.addEventListener('click', () => {
    const content = document.getElementById('articleOutput').innerHTML;
    if (content.trim()) {
      saveArticle(content);
      alert('Article saved successfully!');
    }
  });

  viewSavedButton.addEventListener('click', () => {
    displaySavedArticles();
    savedArticlesModal.classList.add('show');
  });

  closeModalButton.addEventListener('click', () => {
    savedArticlesModal.classList.remove('show');
  });

  // Close modal when clicking outside
  savedArticlesModal.addEventListener('click', (e) => {
    if (e.target === savedArticlesModal) {
      savedArticlesModal.classList.remove('show');
    }
  });
  
  // Add VFX controls
  let vfxEnabled = true;
  const vfxToggleBtn = document.getElementById('vfxToggleBtn');
  const crtEffect = document.querySelector('.crt');
  const scanlinesEffect = document.querySelector('.scanlines');
  const vignetteEffect = document.querySelector('.vignette');
  const announcement = document.querySelector('.announcement');

  function updateVFXButtonState() {
    vfxToggleBtn.textContent = vfxEnabled ? " Disable VFX" : " Enable VFX";
    vfxToggleBtn.classList.toggle('active', vfxEnabled);
  }

  function toggleVFX() {
    vfxEnabled = !vfxEnabled;
    document.body.classList.toggle('vfx-disabled', !vfxEnabled);
    crtEffect.classList.toggle('disabled', !vfxEnabled);
    scanlinesEffect.classList.toggle('disabled', !vfxEnabled);
    vignetteEffect.classList.toggle('disabled', !vfxEnabled);
    announcement.classList.toggle('vfx-disabled', !vfxEnabled);
    
    // Disable animations on all buttons when VFX are disabled
    document.querySelectorAll('button').forEach(button => {
      button.classList.toggle('vfx-disabled', !vfxEnabled);
    });
    
    updateVFXButtonState();
  }

  vfxToggleBtn.addEventListener('click', toggleVFX);

  initializeCommunityFeatures();

  const infoToggle = document.getElementById('infoToggle');
  const infoBox = document.getElementById('infoBox');
  const infoClose = document.querySelector('.info-close');

  infoToggle.addEventListener('click', () => {
    infoBox.classList.toggle('hidden');
    infoToggle.textContent = infoBox.classList.contains('hidden') ? 'Show Information' : 'Hide Information';
  });

  infoClose.addEventListener('click', () => {
    infoBox.classList.add('hidden');
    infoToggle.textContent = 'Show Information';
  });

  // Close info box when clicking outside
  document.addEventListener('click', (e) => {
    if (!infoBox.classList.contains('hidden') && 
        !infoBox.contains(e.target) && 
        e.target !== infoToggle) {
      infoBox.classList.add('hidden');
      infoToggle.textContent = 'Show Information';
    }
  });

  const changelogToggle = document.getElementById('changelogToggle');
  const changelogBox = document.getElementById('changelogBox');
  const changelogClose = document.querySelector('.changelog-close');

  changelogToggle.addEventListener('click', () => {
    changelogBox.classList.toggle('hidden');
    changelogToggle.textContent = changelogBox.classList.contains('hidden') ? 'Show Changelog' : 'Hide Changelog';
  });

  changelogClose.addEventListener('click', () => {
    changelogBox.classList.add('hidden');
    changelogToggle.textContent = 'Show Changelog';
  });

  // Close changelog box when clicking outside
  document.addEventListener('click', (e) => {
    if (!changelogBox.classList.contains('hidden') && 
        !changelogBox.contains(e.target) && 
        e.target !== changelogToggle) {
      changelogBox.classList.add('hidden');
      changelogToggle.textContent = 'Show Changelog';
    }
  });

  // Prevent scrolling issues when both info box and changelog are open
  document.querySelectorAll('.changelog-box, .info-box').forEach(box => {
    box.addEventListener('wheel', (e) => {
      if (box.scrollHeight > box.clientHeight) {
        e.stopPropagation();
      }
    });
  });
  
  // Add smooth scroll behavior
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelector(this.getAttribute('href')).scrollIntoView({
        behavior: 'smooth'
      });
    });
  });

  // Add loading state to buttons
  document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', function() {
      if (!this.disabled) {
        this.classList.add('loading');
        setTimeout(() => this.classList.remove('loading'), 500);
      }
    });
  });

  // Improve modal transitions
  const modal = document.getElementById('savedArticlesModal');
  modal.addEventListener('transitionend', function(e) {
    if (!this.classList.contains('show')) {
      this.classList.add('hidden');
    }
  });

  // Add hover effect to header
  const header = document.querySelector('.header');
  header.addEventListener('mousemove', (e) => {
    const rect = header.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
  
    header.style.setProperty('--mouse-x', `${x}px`);
    header.style.setProperty('--mouse-y', `${y}px`);
  });

  // Improve scroll performance
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (!scrollTimeout) {
      scrollTimeout = setTimeout(() => {
        scrollTimeout = null;
        requestAnimationFrame(() => {
          // Update dynamic elements based on scroll position
          const scrolled = window.scrollY > 100;
          document.body.classList.toggle('scrolled', scrolled);
        });
      }, 10);
    }
  });

  // Add error boundary
  window.addEventListener('error', function(e) {
    console.error('Runtime error:', e);
    // Show user-friendly error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = 'An error occurred. Please try again.';
    document.body.appendChild(errorMessage);
    setTimeout(() => errorMessage.remove(), 3000);
  });

  // Improve form validation feedback
  document.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('invalid', function(e) {
      e.preventDefault();
      this.classList.add('invalid');
    
      const feedback = document.createElement('div');
      feedback.className = 'validation-feedback';
      feedback.textContent = this.validationMessage;
      this.parentNode.appendChild(feedback);
    
      setTimeout(() => {
        feedback.remove();
        this.classList.remove('invalid');
      }, 3000);
    });
  });

  // Add debounce to intensive operations
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Optimize performance for community feed
  const optimizedRefreshFeed = debounce(refreshFeed, 250);
  room.collection('scp_posts').subscribe(optimizedRefreshFeed);

  // Improve button loading states
  function setButtonLoading(button, isLoading) {
    button.disabled = isLoading;
    if (isLoading) {
      button.dataset.originalText = button.textContent;
      button.textContent = 'Processing...';
      button.classList.add('loading');
    } else {
      button.textContent = button.dataset.originalText;
      button.classList.remove('loading');
    }
  }

  // Add transition end cleanup
  document.addEventListener('transitionend', function(e) {
    if (e.target.classList.contains('hidden')) {
      e.target.style.display = 'none';
    }
  });

  // Improve audio handling
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sounds = {
    squeak: new Audio('squeak.wav'),
    defcon: new Audio('DEFCON alarm sound effect. 4.wav'),
    bgMusic: document.getElementById('bgMusic')
  };

  Object.values(sounds).forEach(sound => {
    sound.addEventListener('error', () => {
      console.error(`Error loading sound: ${sound.src}`);
    });
  });

  // Add passive event listeners for better scroll performance
  document.addEventListener('scroll', () => {}, { passive: true });
  document.addEventListener('touchstart', () => {}, { passive: true });

  // Improve error handling for WebSocket
  room.onclose = () => {
    console.warn('WebSocket connection closed. Attempting to reconnect...');
    setTimeout(() => {
      window.location.reload();
    }, 5000);
  };

  // Add connection status indicator
  const connectionStatus = document.createElement('div');
  connectionStatus.className = 'connection-status';
  document.body.appendChild(connectionStatus);

  room.onopen = () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.add('connected');
  };

  room.onclose = () => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.classList.remove('connected');
  };
});

// Utility function at global scope
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function initializeCommunityFeatures() {
  const shareButton = document.getElementById('shareButton');
  const toggleFeedButton = document.getElementById('toggleFeedButton');
  const feedContent = document.getElementById('feedContent');
  const communityFeed = document.getElementById('communityFeed');
  const feedSort = document.getElementById('feedSort');

  let showingFeed = false;

  toggleFeedButton.addEventListener('click', () => {
    showingFeed = !showingFeed;
    communityFeed.classList.toggle('hidden', !showingFeed);
    toggleFeedButton.textContent = showingFeed ? 'Hide Community Feed' : 'Show Community Feed';
    if (showingFeed) {
      refreshFeed();
    }
  });

  feedSort.addEventListener('change', refreshFeed);

  async function shareSCP() {
    const content = document.getElementById('articleOutput').innerHTML;
    const itemNumber = document.getElementById('itemNumber').value || 'SCP-XXXX';
    
    try {
      const creatorUsername = (await window.websim.getCreatedBy()).username;
      
      await room.collection('scp_posts').create({
        content: content,
        itemNumber: itemNumber,
        created_at: new Date().toISOString(),
        likes: 0,
      });

      alert('Your SCP has been shared to the community!');
      refreshFeed();
    } catch (error) {
      console.error('Error sharing SCP:', error);
      alert('Failed to share SCP. Please try again.');
    }
  }

  function togglePostExpansion(contentDiv, button) {
    const isExpanded = contentDiv.classList.toggle('expanded');
    button.textContent = isExpanded ? 'Collapse SCP' : 'Expand SCP';
  }

  // Define refreshFeed function and assign it to the global variable
  refreshFeed = async function() {
    feedContent.innerHTML = '<div class="spinner"></div>';
    
    try {
      const currentUser = (await window.websim.getCreatedBy()).username;
      let posts = room.collection('scp_posts').getList();
      if (feedSort.value === 'popular') {
        posts.sort((a, b) => b.likes - a.likes);
      } else {
        posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }

      feedContent.innerHTML = '';
      
      for (const post of posts) {
        const postElement = document.createElement('div');
        postElement.className = 'scp-post';
        const avatarUrl = `https://images.websim.ai/avatar/${post.username}`;
        
        const contentElement = document.createElement('div');
        contentElement.className = 'post-content';
        contentElement.innerHTML = post.content;

        const collapseButton = document.createElement('button');
        collapseButton.className = 'collapse-button';
        collapseButton.textContent = 'Expand SCP';
        collapseButton.onclick = () => togglePostExpansion(contentElement, collapseButton);

        postElement.innerHTML = `
          <div class="post-header">
            <img src="${avatarUrl}" alt="Avatar" class="author-avatar">
            <div class="post-info">
              <a href="https://websim.ai/@${post.username}" target="_blank" class="author-name">@${post.username}</a>
              <div class="post-date">${new Date(post.created_at).toLocaleString()}</div>
            </div>
            ${post.username === currentUser ? `
              <button class="delete-post-button">Delete SCP</button>
            ` : ''}
          </div>
        `;

        // Add content and collapse button
        postElement.appendChild(contentElement);
        contentElement.appendChild(collapseButton);

        // Add like button section
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'post-actions';
        actionsDiv.innerHTML = `
          <button class="like-button ${post.liked ? 'liked' : ''}" data-post-id="${post.id}">
            ♥ ${post.likes || 0}
          </button>
        `;

        postElement.appendChild(actionsDiv);

        // Add delete functionality if post belongs to current user
        if (post.username === currentUser) {
          const deleteButton = postElement.querySelector('.delete-post-button');
          deleteButton.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this SCP?')) {
              try {
                await room.collection('scp_posts').delete(post.id);
                refreshFeed();
              } catch (error) {
                console.error('Error deleting post:', error);
                alert('Failed to delete SCP. Please try again.');
              }
            }
          });
        }

        const likeButton = actionsDiv.querySelector('.like-button');
        likeButton.addEventListener('click', async () => {
          try {
            if (!post.liked) {
              await room.collection('scp_likes').create({
                post_id: post.id
              });
              await room.collection('scp_posts').update(post.id, {
                likes: (post.likes || 0) + 1
              });
              likeButton.classList.add('liked');
              refreshFeed();
            }
          } catch (error) {
            console.error('Error liking post:', error);
          }
        });

        feedContent.appendChild(postElement);

        // Check if content needs collapse button
        if (contentElement.scrollHeight <= 200) {
          collapseButton.classList.add('hidden');
        }
      }
    } catch (error) {
      console.error('Error refreshing feed:', error);
      feedContent.innerHTML = 'Error loading community feed. Please try again.';
    }
  };

  // Subscribe to real-time updates
  const optimizedRefreshFeed = debounce(refreshFeed, 250);
  room.collection('scp_posts').subscribe(optimizedRefreshFeed);

  shareButton.addEventListener('click', shareSCP);
}