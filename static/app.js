document.addEventListener('DOMContentLoaded', () => {
    // State management
    let rawReleaseNotes = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let activeTab = 'feed'; // 'feed', 'tweets', 'bookmarks'
    
    // Cache DOM Elements
    const elements = {
        exportCsvBtn: document.getElementById('export-csv-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        refreshIcon: document.getElementById('refresh-icon'),
        searchInput: document.getElementById('search-input'),
        filterAll: document.getElementById('filter-all'),
        filterFeatures: document.getElementById('filter-features'),
        filterAnnouncements: document.getElementById('filter-announcements'),
        filterIssues: document.getElementById('filter-issues'),
        feedInfo: document.getElementById('feed-info'),
        
        tabFeed: document.getElementById('tab-feed'),
        tabTweets: document.getElementById('tab-tweets'),
        tabBookmarks: document.getElementById('tab-bookmarks'),
        
        feedContent: document.getElementById('feed-content-tab'),
        tweetsContent: document.getElementById('tweets-content-tab'),
        bookmarksContent: document.getElementById('bookmarks-content-tab'),
        
        // Modal elements
        tweetModal: document.getElementById('tweet-modal'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        tweetTextarea: document.getElementById('tweet-textarea'),
        tweetCharCount: document.getElementById('tweet-char-count'),
        previewText: document.getElementById('preview-text'),
        previewLinkTitle: document.getElementById('preview-link-title'),
        publishTweetBtn: document.getElementById('publish-tweet-btn'),
        cancelTweetBtn: document.getElementById('cancel-tweet-btn')
    };

    // Initialize state
    let activeTweetItem = null;

    // Load data initially
    fetchReleaseNotes(false);
    updateTweetLog();
    updateCounts();

    // Event Listeners
    elements.refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    elements.exportCsvBtn.addEventListener('click', exportToCsv);
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderActiveTab();
    });

    // Tab buttons
    elements.tabFeed.addEventListener('click', () => switchTab('feed'));
    elements.tabTweets.addEventListener('click', () => switchTab('tweets'));
    elements.tabBookmarks.addEventListener('click', () => switchTab('bookmarks'));

    // Filters
    const filterButtons = [
        { btn: elements.filterAll, category: 'all' },
        { btn: elements.filterFeatures, category: 'Feature' },
        { btn: elements.filterAnnouncements, category: 'Announcement' },
        { btn: elements.filterIssues, category: 'Issue' }
    ];

    filterButtons.forEach(({ btn, category }) => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(f => f.btn.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = category;
            renderActiveTab();
        });
    });

    // Modal behavior
    elements.closeModalBtn.addEventListener('click', hideTweetModal);
    elements.cancelTweetBtn.addEventListener('click', hideTweetModal);
    elements.tweetTextarea.addEventListener('input', handleTweetInput);
    elements.publishTweetBtn.addEventListener('click', publishTweet);

    // Close modal on click outside
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) {
            hideTweetModal();
        }
    });

    // --- Core Functions ---

    async function fetchReleaseNotes(refresh = false) {
        setLoadingState(true);
        try {
            const response = await fetch(`/api/release-notes?refresh=${refresh}`);
            const result = await response.json();
            
            if (result.status === 'success' || result.status === 'warning') {
                rawReleaseNotes = result.data || [];
                
                // Show warning message if stale data was returned
                if (result.status === 'warning') {
                    showToast(result.message, 'warning');
                } else if (refresh) {
                    showToast('Release notes successfully refreshed!', 'success');
                }
                
                renderActiveTab();
                updateCounts();
            } else {
                showToast(result.message || 'Error fetching release notes.', 'error');
                renderEmptyState(elements.feedContent, 'Error', 'Failed to retrieve release notes.');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('Network error fetching release notes.', 'error');
            renderEmptyState(elements.feedContent, 'Connection Error', 'Check your connection and try again.');
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            elements.refreshIcon.classList.add('spinner');
            elements.refreshBtn.disabled = true;
            if (rawReleaseNotes.length === 0) {
                elements.feedContent.innerHTML = `
                    <div class="state-container">
                        <div class="state-icon"><span class="spinner">⏳</span></div>
                        <h3 class="state-title">Fetching Release Notes</h3>
                        <p class="state-desc">Retrieving live updates from BigQuery feed...</p>
                    </div>
                `;
            }
        } else {
            elements.refreshIcon.classList.remove('spinner');
            elements.refreshBtn.disabled = false;
        }
    }

    function switchTab(tab) {
        activeTab = tab;
        [elements.tabFeed, elements.tabTweets, elements.tabBookmarks].forEach(btn => btn.classList.remove('active'));
        [elements.feedContent, elements.tweetsContent, elements.bookmarksContent].forEach(content => content.classList.remove('active'));

        if (tab === 'feed') {
            elements.tabFeed.classList.add('active');
            elements.feedContent.classList.add('active');
        } else if (tab === 'tweets') {
            elements.tabTweets.classList.add('active');
            elements.tweetsContent.classList.add('active');
            updateTweetLog();
        } else if (tab === 'bookmarks') {
            elements.tabBookmarks.classList.add('active');
            elements.bookmarksContent.classList.add('active');
        }
        renderActiveTab();
    }

    function renderActiveTab() {
        if (activeTab === 'feed') {
            renderFeed();
        } else if (activeTab === 'bookmarks') {
            renderBookmarks();
        } else if (activeTab === 'tweets') {
            renderTweetLog();
        }
    }

    // --- Rendering logic ---

    function getFilteredData() {
        let processedData = [];
        
        rawReleaseNotes.forEach(entry => {
            const filteredItems = entry.items.filter(item => {
                const matchesCategory = currentFilter === 'all' || item.type === currentFilter;
                const matchesSearch = searchQuery === '' || 
                                     item.type.toLowerCase().includes(searchQuery) || 
                                     item.text.toLowerCase().includes(searchQuery) ||
                                     entry.date.toLowerCase().includes(searchQuery);
                return matchesCategory && matchesSearch;
            });

            if (filteredItems.length > 0) {
                processedData.push({
                    ...entry,
                    items: filteredItems
                });
            }
        });

        return processedData;
    }

    function renderFeed() {
        const data = getFilteredData();
        
        if (data.length === 0) {
            renderEmptyState(
                elements.feedContent, 
                'No updates found', 
                searchQuery ? `No release notes match "${searchQuery}".` : 'No release notes match the current filters.'
            );
            elements.feedInfo.textContent = 'Showing 0 updates';
            return;
        }

        let totalItemsCount = 0;
        let html = '';

        data.forEach((group, groupIndex) => {
            const dateId = group.date.replace(/[^a-zA-Z0-9]/g, '_');
            html += `
                <section class="release-group-card" id="card-${dateId}">
                    <div class="release-date-header">
                        <h2 class="release-date">${group.date}</h2>
                        ${group.link ? `
                            <a href="${group.link}" target="_blank" rel="noopener noreferrer" class="release-link" title="Open official documentation">
                                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6m0 0v6m0-6L10 14" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </a>
                        ` : ''}
                    </div>
                    <div class="release-items">
            `;

            group.items.forEach((item, itemIndex) => {
                totalItemsCount++;
                const isBookmarked = checkIsBookmarked(group.date, itemIndex);
                const itemId = `${groupIndex}-${itemIndex}`;
                
                html += `
                    <div class="release-item" data-type="${item.type}" id="item-${itemId}">
                        <div class="item-meta">
                            <span class="category-badge ${item.type.toLowerCase()}">${item.type}</span>
                        </div>
                        <div class="item-content">
                            ${item.html}
                        </div>
                        <div class="item-actions">
                            <button class="item-action-btn tweet-btn-direct" data-group-index="${groupIndex}" data-item-index="${itemIndex}">
                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                Share on X
                            </button>
                            <button class="item-action-btn copy-btn" data-group-index="${groupIndex}" data-item-index="${itemIndex}">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m-2 4h5m-3-3l3 3-3 3"/>
                                </svg>
                                Copy
                            </button>
                            <button class="item-action-btn bookmark-btn" data-group-index="${groupIndex}" data-item-index="${itemIndex}">
                                <svg width="14" height="14" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${isBookmarked ? 'Saved' : 'Save'}
                            </button>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </section>
            `;
        });

        elements.feedContent.innerHTML = html;
        elements.feedInfo.textContent = `Showing ${totalItemsCount} update${totalItemsCount !== 1 ? 's' : ''}`;
        attachItemEventListeners();
    }

    function renderBookmarks() {
        const bookmarks = getBookmarks();
        
        if (bookmarks.length === 0) {
            renderEmptyState(
                elements.bookmarksContent,
                'No saved updates',
                'Bookmark release notes from the feed tab to see them here.'
            );
            return;
        }

        // Filter bookmarks
        const filteredBookmarks = bookmarks.filter(bookmark => {
            const matchesCategory = currentFilter === 'all' || bookmark.item.type === currentFilter;
            const matchesSearch = searchQuery === '' || 
                                 bookmark.item.type.toLowerCase().includes(searchQuery) || 
                                 bookmark.item.text.toLowerCase().includes(searchQuery) ||
                                 bookmark.date.toLowerCase().includes(searchQuery);
            return matchesCategory && matchesSearch;
        });

        if (filteredBookmarks.length === 0) {
            renderEmptyState(
                elements.bookmarksContent,
                'No matching bookmarks',
                `No bookmarked release notes match "${searchQuery}".`
            );
            return;
        }

        // Group bookmarks by date for visual consistency
        const grouped = {};
        filteredBookmarks.forEach(bookmark => {
            if (!grouped[bookmark.date]) {
                grouped[bookmark.date] = {
                    date: bookmark.date,
                    link: bookmark.link,
                    items: []
                };
            }
            grouped[bookmark.date].items.push(bookmark);
        });

        let html = '';
        Object.values(grouped).forEach((group) => {
            const dateId = group.date.replace(/[^a-zA-Z0-9]/g, '_');
            html += `
                <section class="release-group-card" id="bookmark-card-${dateId}">
                    <div class="release-date-header">
                        <h2 class="release-date">${group.date}</h2>
                        ${group.link ? `
                            <a href="${group.link}" target="_blank" rel="noopener noreferrer" class="release-link">
                                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6m0 0v6m0-6L10 14" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            </a>
                        ` : ''}
                    </div>
                    <div class="release-items">
            `;

            group.items.forEach((bookmark) => {
                html += `
                    <div class="release-item" data-type="${bookmark.item.type}">
                        <div class="item-meta">
                            <span class="category-badge ${bookmark.item.type.toLowerCase()}">${bookmark.item.type}</span>
                        </div>
                        <div class="item-content">
                            ${bookmark.item.html}
                        </div>
                        <div class="item-actions">
                            <button class="item-action-btn tweet-btn-bookmark" data-raw-data="${encodeURIComponent(JSON.stringify(bookmark))}">
                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                Share on X
                            </button>
                            <button class="item-action-btn copy-btn-bookmark" data-raw-data="${encodeURIComponent(JSON.stringify(bookmark))}">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m-2 4h5m-3-3l3 3-3 3"/>
                                </svg>
                                Copy
                            </button>
                            <button class="item-action-btn remove-bookmark-btn" data-date="${encodeURIComponent(bookmark.date)}" data-index="${bookmark.originalIndex}">
                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z"/>
                                </svg>
                                Remove
                            </button>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </section>
            `;
        });

        elements.bookmarksContent.innerHTML = html;
        attachBookmarkEventListeners();
    }

    function renderTweetLog() {
        const tweets = getTweetLog();
        
        if (tweets.length === 0) {
            renderEmptyState(
                elements.tweetsContent,
                'No tweets shared yet',
                'Share updates on X/Twitter to see your shared history here.'
            );
            return;
        }

        let html = '<div class="tweets-grid">';
        
        tweets.forEach((tweet, index) => {
            const date = new Date(tweet.timestamp).toLocaleString();
            html += `
                <div class="x-preview-card" style="border-color: var(--border-color); background: var(--bg-card);">
                    <div class="x-preview-header" style="justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div class="x-avatar">BQ</div>
                            <div class="x-user-info">
                                <div class="x-display-name">BigQuery Release Bot</div>
                                <div class="x-username">@bq_updates · ${date}</div>
                            </div>
                        </div>
                        <button class="close-modal delete-tweet-btn" data-index="${index}" title="Remove from log" style="width: 28px; height: 28px; font-size: 0.8rem;">×</button>
                    </div>
                    <div class="x-preview-body" style="font-size: 0.9rem;">${escapeHtml(tweet.text)}</div>
                    ${tweet.sourceDate ? `
                        <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
                            Source: BigQuery update from ${tweet.sourceDate}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += '</div>';
        elements.tweetsContent.innerHTML = html;
        attachTweetLogEventListeners();
    }

    function renderEmptyState(container, title, description) {
        container.innerHTML = `
            <div class="state-container">
                <div class="state-icon">📁</div>
                <h3 class="state-title">${title}</h3>
                <p class="state-desc">${description}</p>
            </div>
        `;
    }

    // --- Interaction listeners ---

    function attachItemEventListeners() {
        // Share on X click
        document.querySelectorAll('.tweet-btn-direct').forEach(button => {
            button.addEventListener('click', (e) => {
                const groupIdx = parseInt(e.currentTarget.getAttribute('data-group-index'));
                const itemIdx = parseInt(e.currentTarget.getAttribute('data-item-index'));
                const group = rawReleaseNotes[groupIdx];
                const item = group.items[itemIdx];
                
                openTweetModal({
                    date: group.date,
                    link: group.link,
                    item: item,
                    originalIndex: itemIdx
                });
            });
        });

        // Copy to clipboard
        document.querySelectorAll('.copy-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const groupIdx = parseInt(e.currentTarget.getAttribute('data-group-index'));
                const itemIdx = parseInt(e.currentTarget.getAttribute('data-item-index'));
                const group = rawReleaseNotes[groupIdx];
                const item = group.items[itemIdx];
                copyItemToClipboard(e.currentTarget, item.text);
            });
        });

        // Bookmark toggle
        document.querySelectorAll('.bookmark-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const groupIdx = parseInt(e.currentTarget.getAttribute('data-group-index'));
                const itemIdx = parseInt(e.currentTarget.getAttribute('data-item-index'));
                const group = rawReleaseNotes[groupIdx];
                const item = group.items[itemIdx];
                
                toggleBookmark({
                    date: group.date,
                    link: group.link,
                    item: item,
                    originalIndex: itemIdx
                });
            });
        });
    }

    function attachBookmarkEventListeners() {
        // Share on X click for bookmark
        document.querySelectorAll('.tweet-btn-bookmark').forEach(button => {
            button.addEventListener('click', (e) => {
                const rawData = decodeURIComponent(e.currentTarget.getAttribute('data-raw-data'));
                const bookmark = JSON.parse(rawData);
                openTweetModal(bookmark);
            });
        });

        // Copy to clipboard bookmark
        document.querySelectorAll('.copy-btn-bookmark').forEach(button => {
            button.addEventListener('click', (e) => {
                const rawData = decodeURIComponent(e.currentTarget.getAttribute('data-raw-data'));
                const bookmark = JSON.parse(rawData);
                copyItemToClipboard(e.currentTarget, bookmark.item.text);
            });
        });

        // Remove bookmark
        document.querySelectorAll('.remove-bookmark-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const date = decodeURIComponent(e.currentTarget.getAttribute('data-date'));
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                removeBookmark(date, index);
            });
        });
    }

    function attachTweetLogEventListeners() {
        document.querySelectorAll('.delete-tweet-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                deleteTweetFromLog(index);
            });
        });
    }

    // --- Tweet Compose Logic ---

    function openTweetModal(data) {
        activeTweetItem = data;
        
        // Construct template tweet text
        const maxTextLen = 170; // buffer to ensure room for tags, date, and link
        let cleanText = data.item.text;
        
        if (cleanText.length > maxTextLen) {
            cleanText = cleanText.substring(0, maxTextLen) + '...';
        }
        
        const hashTagMap = {
            'Feature': '#BigQuery #Feature #GoogleCloud',
            'Announcement': '#BigQuery #GCP #Cloud',
            'Issue': '#BigQuery #CloudAlert',
            'Update': '#BigQuery #GCP'
        };
        const hashtags = hashTagMap[data.item.type] || '#BigQuery #GoogleCloud';
        
        const defaultTweetText = `📢 BQ ${data.item.type} (${data.date}):\n"${cleanText}"\n\nRead details: ${data.link || 'https://cloud.google.com/bigquery'}\n${hashtags}`;
        
        elements.tweetTextarea.value = defaultTweetText;
        elements.previewLinkTitle.textContent = `BigQuery Release notes - ${data.date}`;
        
        handleTweetInput(); // calculate length and update preview
        
        elements.tweetModal.classList.add('active');
        elements.tweetTextarea.focus();
    }

    function hideTweetModal() {
        elements.tweetModal.classList.remove('active');
        activeTweetItem = null;
    }

    function handleTweetInput() {
        const text = elements.tweetTextarea.value;
        const length = text.length;
        const remaining = 280 - length;
        
        elements.tweetCharCount.textContent = remaining;
        
        // styling char count
        elements.tweetCharCount.className = 'tweet-char-count';
        if (remaining <= 20 && remaining >= 0) {
            elements.tweetCharCount.classList.add('warning');
        } else if (remaining < 0) {
            elements.tweetCharCount.classList.add('error');
        }
        
        // enable/disable button
        elements.publishTweetBtn.disabled = (remaining < 0 || length === 0);
        
        // update live preview
        elements.previewText.textContent = text;
    }

    function publishTweet() {
        if (!activeTweetItem) return;
        
        const text = elements.tweetTextarea.value;
        
        // 1. Open twitter intent
        const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(intentUrl, '_blank', 'noopener,noreferrer');
        
        // 2. Save to simulated log
        saveTweetToLog({
            text: text,
            timestamp: new Date().toISOString(),
            sourceDate: activeTweetItem.date,
            sourceCategory: activeTweetItem.item.type
        });
        
        // 3. Success state
        showToast('Tweet draft generated and opened in new window!', 'success');
        hideTweetModal();
        
        // Switch to tweets log to see simulated post
        setTimeout(() => {
            switchTab('tweets');
        }, 600);
    }

    // --- LocalStorage Persistence Layer ---

    // Bookmarks
    function getBookmarks() {
        return JSON.parse(localStorage.getItem('bq_bookmarks') || '[]');
    }

    function checkIsBookmarked(date, originalIndex) {
        const bookmarks = getBookmarks();
        return bookmarks.some(b => b.date === date && b.originalIndex === originalIndex);
    }

    function toggleBookmark(data) {
        let bookmarks = getBookmarks();
        const existsIndex = bookmarks.findIndex(b => b.date === data.date && b.originalIndex === data.originalIndex);
        
        if (existsIndex > -1) {
            bookmarks.splice(existsIndex, 1);
            showToast('Note removed from bookmarks.', 'info');
        } else {
            bookmarks.push(data);
            showToast('Note saved to bookmarks!', 'success');
        }
        
        localStorage.setItem('bq_bookmarks', JSON.stringify(bookmarks));
        updateCounts();
        renderActiveTab();
    }

    function removeBookmark(date, originalIndex) {
        let bookmarks = getBookmarks();
        bookmarks = bookmarks.filter(b => !(b.date === date && b.originalIndex === originalIndex));
        localStorage.setItem('bq_bookmarks', JSON.stringify(bookmarks));
        updateCounts();
        renderActiveTab();
        showToast('Bookmark removed.', 'info');
    }

    // Tweet Logs
    function getTweetLog() {
        return JSON.parse(localStorage.getItem('bq_tweet_log') || '[]');
    }

    function saveTweetToLog(tweet) {
        const tweets = getTweetLog();
        tweets.unshift(tweet); // add to start of list
        localStorage.setItem('bq_tweet_log', JSON.stringify(tweets));
        updateCounts();
    }

    function deleteTweetFromLog(index) {
        const tweets = getTweetLog();
        tweets.splice(index, 1);
        localStorage.setItem('bq_tweet_log', JSON.stringify(tweets));
        updateCounts();
        renderActiveTab();
        showToast('Tweet log deleted.', 'info');
    }

    // UI Utilities
    function updateCounts() {
        const bookmarksCount = getBookmarks().length;
        const tweetsCount = getTweetLog().length;
        
        // Show counts in navigation badges or logs
        const bookmarksBadge = document.getElementById('bookmarks-badge');
        const tweetsBadge = document.getElementById('tweets-badge');
        
        if (bookmarksBadge) bookmarksBadge.textContent = bookmarksCount;
        if (tweetsBadge) tweetsBadge.textContent = tweetsCount;
    }

    function updateTweetLog() {
        // Just triggers update count
        updateCounts();
    }

    function showToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '2rem';
        toast.style.padding = '0.75rem 1.5rem';
        toast.style.borderRadius = '12px';
        toast.style.zIndex = '2000';
        toast.style.fontWeight = '600';
        toast.style.fontSize = '0.9rem';
        toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        
        if (type === 'success') {
            toast.style.background = '#059669';
            toast.style.color = 'white';
        } else if (type === 'error') {
            toast.style.background = '#dc2626';
            toast.style.color = 'white';
        } else if (type === 'warning') {
            toast.style.background = '#d97706';
            toast.style.color = 'white';
        } else {
            toast.style.background = '#3b82f6';
            toast.style.color = 'white';
        }
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Trigger reflow
        toast.offsetHeight;
        
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Copy item plain text to clipboard
    function copyItemToClipboard(button, text) {
        navigator.clipboard.writeText(text).then(() => {
            const origHTML = button.innerHTML;
            button.innerHTML = `
                <svg width="14" height="14" fill="none" stroke="#10b981" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                <span style="color: #10b981;">Copied!</span>
            `;
            button.disabled = true;
            showToast('Copied release notes to clipboard!', 'success');
            setTimeout(() => {
                button.innerHTML = origHTML;
                button.disabled = false;
            }, 2000);
        }).catch(err => {
            console.error('Clipboard copy failed: ', err);
            showToast('Failed to copy to clipboard.', 'error');
        });
    }

    // Export current filtered release notes to CSV
    function exportToCsv() {
        const data = getFilteredData();
        if (data.length === 0) {
            showToast('No data available to export.', 'warning');
            return;
        }

        let csvContent = '\uFEFFDate,Category,Doc Link,Plain Text Description\n'; // UTF-8 BOM
        
        data.forEach(group => {
            const date = group.date;
            const link = group.link || '';
            group.items.forEach(item => {
                const category = item.type;
                const text = item.text.replace(/"/g, '""'); // escape double quotes
                csvContent += `"${date}","${category}","${link}","${text}"\n`;
            });
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Formulate filename based on current filter/search
        let filename = 'bq_release_notes';
        if (currentFilter !== 'all') {
            filename += `_${currentFilter.toLowerCase()}`;
        }
        if (searchQuery) {
            filename += `_search`;
        }
        filename += '.csv';

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Successfully exported ${filename}!`, 'success');
    }

    // Helper functions
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }
});
