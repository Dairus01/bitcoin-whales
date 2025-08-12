// Modern WhaleWatch Dashboard JavaScript

// Configuration
const MAX_WHALES = 1000; // Increased to allow more transactions for pagination
const MAX_ACTIVITY_ITEMS = 20;
const MAX_CHART_POINTS = 30;
const TRANSACTIONS_PER_PAGE = 50;

// DOM Elements
const elements = {
    // Stats cards
    totalVolume: document.getElementById('total-volume'),
    volumeChange: document.getElementById('volume-change'),
    whaleCount: document.getElementById('whale-count'),
    whaleChange: document.getElementById('whale-change'),
    avgSize: document.getElementById('avg-size'),
    sizeChange: document.getElementById('size-change'),
    blocksCount: document.getElementById('blocks-count'),
    blocksChange: document.getElementById('blocks-change'),
    
    // Controls
    thresholdInput: document.getElementById('threshold-input'),
    intervalInput: document.getElementById('interval-input'),
    applyBtn: document.getElementById('apply-config'),
    
    // Activity feed
    activityStream: document.getElementById('activity-stream'),
    feedFilters: document.querySelectorAll('.feed-filter'),
    
    // Whale table
    whalesBody: document.getElementById('whales-body'),
    whaleCountDisplay: document.getElementById('whale-count-display'),
    paginationContainer: document.getElementById('pagination-container'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    pageInfo: document.getElementById('page-info'),
    

    
    // Status elements
    connectionStatus: document.getElementById('connection-status'),
    lastUpdate: document.getElementById('last-update'),
    statusDot: document.querySelector('.status-dot'),
    statusText: document.querySelector('.status-text'),
    blockHeight: document.getElementById('block-height'),
    
    // Containers
    bubbleContainer: document.getElementById('bubble-container'),
    notificationContainer: document.getElementById('notification-container'),
    loadingOverlay: document.getElementById('loading-overlay')
};

// State management
const state = {
    currentThreshold: 100,
    currentInterval: 60,
    chartValues: [],
    chartWhales: [],
    activityItems: [],
    whaleTransactions: [],
    blocksMined: 0,
    totalVolume: 0,
    whaleCount: 0,
    avgSize: 0,
    lastUpdateTime: Date.now(),
    connectionStatus: 'connecting',
    currentFilter: 'all',
    currentPage: 1,
    totalPages: 1
};



// Initialize the application
function init() {
    console.log('Initializing WhaleWatch...');
    

    
    setupEventListeners();
    fetchConfig();
    fetchBitcoinPrice();
    fetchCurrentBlockHeight(); // Get current block height
    hideLoadingOverlay();
    updateLastUpdate();
    
    // Update last update time every minute
    setInterval(updateLastUpdate, 60000);
    
    // Update Bitcoin price every 30 seconds
    setInterval(fetchBitcoinPrice, 30000);
    
    // Update block height every 60 seconds
    setInterval(fetchCurrentBlockHeight, 60000);
    
    // Initialize matrix effect
    console.log('Initializing matrix effect...');
    initMatrixEffect();
    
    // Initialize network visualization
    console.log('Initializing network visualization...');
    initNetworkViz();
    
    console.log('WhaleWatch initialization complete!');
}

// Setup event listeners
function setupEventListeners() {
    // Apply configuration button
    elements.applyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        applyConfig();
    });

    // Pagination controls
    if (elements.prevPageBtn) {
        elements.prevPageBtn.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                updateWhaleTable();
            }
        });
    }

    if (elements.nextPageBtn) {
        elements.nextPageBtn.addEventListener('click', () => {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                updateWhaleTable();
            }
        });
    }

    // Download button
    const downloadBtn = document.getElementById('download-whales-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadWhaleTransactions);
    }

    // Feed filters
    elements.feedFilters.forEach(filter => {
        filter.addEventListener('click', () => {
            elements.feedFilters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            state.currentFilter = filter.dataset.filter;
            updateActivityFeed();
        });
    });



    // Input animations
    [elements.thresholdInput, elements.intervalInput].forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', () => {
            input.parentElement.classList.remove('focused');
        });
    });
}



// Fetch configuration from server
function fetchConfig() {
    fetch("/config")
        .then((res) => res.json())
        .then((data) => {
            if (data.threshold !== null && data.threshold !== undefined) {
                state.currentThreshold = data.threshold;
                elements.thresholdInput.value = state.currentThreshold;
            }
            if (data.interval !== null && data.interval !== undefined) {
                state.currentInterval = data.interval;
                elements.intervalInput.value = state.currentInterval;
            }
        })
        .catch((err) => {
            console.error("Failed to fetch config:", err);
            showNotification('Error', 'Failed to load configuration', 'error');
        });
}

// Apply configuration
function applyConfig() {
    const threshold = parseFloat(elements.thresholdInput.value);
    const interval = parseInt(elements.intervalInput.value);
    
    const body = {};
    if (!isNaN(threshold)) {
        body.threshold = threshold;
    }
    if (!isNaN(interval)) {
        body.interval = interval;
    }
    
    // Show loading state
    elements.applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
    elements.applyBtn.disabled = true;
    
    fetch("/config", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.threshold !== undefined) {
                state.currentThreshold = data.threshold;
                elements.thresholdInput.value = state.currentThreshold;
            }
            if (data.interval !== undefined) {
                state.currentInterval = data.interval;
                elements.intervalInput.value = state.currentInterval;
            }
            
            showNotification('Success', 'Settings updated successfully', 'success');
            animateStatCard('whale-count-card');
        })
        .catch((err) => {
            console.error("Failed to update config:", err);
            showNotification('Error', 'Failed to update settings', 'error');
        })
        .finally(() => {
            elements.applyBtn.innerHTML = '<i class="fas fa-save"></i> Apply Settings';
            elements.applyBtn.disabled = false;
        });
}

// Update stats cards
function updateStats(data) {
    // Animate value changes
    animateValueChange(elements.totalVolume, state.totalVolume, data.total_btc, 'BTC');
    animateValueChange(elements.whaleCount, state.whaleCount, data.whales, '');
    animateValueChange(elements.avgSize, state.avgSize, data.avg_btc, 'BTC');
    
    // Update state
    state.totalVolume = data.total_btc;
    state.whaleCount = data.whales;
    state.avgSize = data.avg_btc;
    
    // Update change indicators
    updateChangeIndicator(elements.volumeChange, data.total_btc, state.totalVolume);
    updateChangeIndicator(elements.whaleChange, data.whales, state.whaleCount);
    updateChangeIndicator(elements.sizeChange, data.avg_btc, state.avgSize);
    
    // Animate cards
    animateStatCard('total-volume-card');
    animateStatCard('whale-count-card');
    animateStatCard('avg-size-card');
}

// Animate value changes
function animateValueChange(element, oldValue, newValue, suffix) {
    if (!element) return;
    
    const startValue = oldValue;
    const endValue = newValue;
    const duration = 1000;
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentValue = startValue + (endValue - startValue) * progress;
        
        if (suffix === 'BTC') {
            element.textContent = `${currentValue.toFixed(4)} ${suffix}`;
        } else {
            element.textContent = Math.round(currentValue).toString() + suffix;
        }
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

// Update change indicators
function updateChangeIndicator(element, newValue, oldValue) {
    if (!element) return;
    
    const change = newValue - oldValue;
    const changePercent = oldValue > 0 ? (change / oldValue) * 100 : 0;
    
    if (change > 0) {
        element.textContent = `+${changePercent.toFixed(2)}%`;
        element.style.color = 'var(--success-color)';
    } else if (change < 0) {
        element.textContent = `${changePercent.toFixed(2)}%`;
        element.style.color = 'var(--danger-color)';
    } else {
        element.textContent = '0.00%';
        element.style.color = 'var(--text-muted)';
    }
}

// Animate stat cards
function animateStatCard(cardId) {
    const card = document.getElementById(cardId);
    if (card) {
        card.style.transform = 'scale(1.05)';
        setTimeout(() => {
            card.style.transform = 'scale(1)';
        }, 200);
    }
}

// Update activity feed
function updateActivityFeed() {
    const filteredItems = state.activityItems.filter(item => {
        if (state.currentFilter === 'all') return true;
        return item.type === state.currentFilter;
    });
    
    elements.activityStream.innerHTML = '';
    
    if (filteredItems.length === 0) {
        elements.activityStream.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-satellite-dish"></i>
                <p>No ${state.currentFilter} activity yet...</p>
            </div>
        `;
        return;
    }
    
    filteredItems.forEach(item => {
        const activityItem = createActivityItem(item);
        elements.activityStream.appendChild(activityItem);
    });
}

// Create activity item
function createActivityItem(item) {
    const div = document.createElement('div');
    div.className = 'activity-item';
    
    const icon = getActivityIcon(item.type);
    const title = getActivityTitle(item);
    const time = new Date(item.timestamp * 1000).toLocaleTimeString();
    
    div.innerHTML = `
        <div class="activity-icon">
            <i class="${icon}"></i>
        </div>
        <div class="activity-content">
            <div class="activity-title">${title}</div>
            <div class="activity-time">${time}</div>
        </div>
    `;
    
    return div;
}

// Get activity icon
function getActivityIcon(type) {
    switch (type) {
        case 'whale': return 'fas fa-whale';
        case 'block': return 'fas fa-cube';
        case 'summary': return 'fas fa-chart-line';
        default: return 'fas fa-info-circle';
    }
}

// Get activity title
function getActivityTitle(item) {
    switch (item.type) {
        case 'whale':
            return `Whale transaction detected: ${item.data.value_btc.toFixed(2)} BTC ($${item.data.value_usd.toLocaleString()})`;
        case 'block':
            return `New block mined${item.data.height ? ` at height ${item.data.height}` : ''}`;
        case 'summary':
            return `Summary: ${item.data.whales} whales, ${item.data.total_btc.toFixed(2)} BTC total`;
        default:
            return 'Activity detected';
    }
}

// Add whale transaction
function addWhaleTransaction(data) {
    const transaction = {
        ...data,
        id: Date.now(),
        timestamp: data.timestamp
    };
    
    state.whaleTransactions.unshift(transaction);
    
    // Keep only the latest transactions
    if (state.whaleTransactions.length > MAX_WHALES) {
        state.whaleTransactions = state.whaleTransactions.slice(0, MAX_WHALES);
    }
    
    // Reset to first page when new transactions arrive
    state.currentPage = 1;
    
    updateWhaleTable();
    createBubble(data);
    
    // Enhanced notification with transaction details
    const usdValue = data.value_usd.toLocaleString(undefined, { maximumFractionDigits: 2 });
    showNotification('🐋 Whale Detected!', `${data.value_btc.toFixed(2)} BTC ($${usdValue})`, 'whale');
    
    // Show enhanced whale alert
    showWhaleAlert(data);
    
    // Add to activity feed
    addActivityItem('whale', data);
    
    // Animate the whale count card
    animateStatCard('whale-count-card');
    
    // Play a subtle sound effect (if supported)
    playWhaleSound(data.value_btc);
    
    // Trigger screen flash effect for large transactions
    if (data.value_btc > state.currentThreshold * 5) {
        triggerScreenFlash();
    }
}

// Update whale table with pagination
function updateWhaleTable() {
    if (!elements.whalesBody) return;
    
    // Calculate pagination
    const startIndex = (state.currentPage - 1) * TRANSACTIONS_PER_PAGE;
    const endIndex = startIndex + TRANSACTIONS_PER_PAGE;
    const currentPageTransactions = state.whaleTransactions.slice(startIndex, endIndex);
    
    // Update total pages
    state.totalPages = Math.ceil(state.whaleTransactions.length / TRANSACTIONS_PER_PAGE);
    

    
    // Clear table
    elements.whalesBody.innerHTML = '';
    
    // Add transactions for current page
    currentPageTransactions.forEach((tx, index) => {
        const row = createWhaleRow(tx, index === 0);
        elements.whalesBody.appendChild(row);
    });
    
    // Update whale count display
    if (elements.whaleCountDisplay) {
        const startIndex = (state.currentPage - 1) * TRANSACTIONS_PER_PAGE + 1;
        const endIndex = Math.min(state.currentPage * TRANSACTIONS_PER_PAGE, state.whaleTransactions.length);
        elements.whaleCountDisplay.textContent = `${startIndex}-${endIndex} of ${state.whaleTransactions.length}`;
    }
    
    // Update pagination controls
    updatePaginationControls();
}

// Update pagination controls
function updatePaginationControls() {
    if (!elements.paginationContainer) return;
    
    // Update page info
    if (elements.pageInfo) {
        elements.pageInfo.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
    }
    
    // Update button states
    if (elements.prevPageBtn) {
        elements.prevPageBtn.disabled = state.currentPage <= 1;
        elements.prevPageBtn.classList.toggle('disabled', state.currentPage <= 1);
    }
    
    if (elements.nextPageBtn) {
        elements.nextPageBtn.disabled = state.currentPage >= state.totalPages;
        elements.nextPageBtn.classList.toggle('disabled', state.currentPage >= state.totalPages);
    }
    
    // Show/hide pagination container
    elements.paginationContainer.style.display = state.totalPages > 1 ? 'flex' : 'none';
    

}

// Download whale transactions as CSV
function downloadWhaleTransactions() {
    if (state.whaleTransactions.length === 0) {
        showNotification('No Data', 'No transactions to download', 'warning');
        return;
    }
    
    // Create CSV content
    const headers = ['Time', 'Value (BTC)', 'Value (USD)', 'Transaction Hash', 'Address'];
    const csvContent = [
        headers.join(','),
        ...state.whaleTransactions.map(tx => {
            const date = new Date(tx.timestamp * 1000);
            const timeString = date.toLocaleString();
            return [
                `"${timeString}"`,
                tx.value_btc.toFixed(8),
                tx.value_usd.toFixed(2),
                tx.hash,
                `"${tx.address || ''}"`
            ].join(',');
        })
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `whale_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Download Complete', `Downloaded ${state.whaleTransactions.length} transactions`, 'success');
}

// Create whale table row
function createWhaleRow(data, isNew = false) {
    const row = document.createElement('tr');
    if (isNew) row.classList.add('new-whale');
    
    const date = new Date(data.timestamp * 1000);
    const timeString = date.toLocaleTimeString();
    
    row.innerHTML = `
        <td>${timeString}</td>
        <td><span class="btc-value">${data.value_btc.toFixed(2)}</span></td>
        <td><span class="usd-value">$${data.value_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></td>
        <td>
            <a href="https://www.blockchain.com/btc/tx/${data.hash}" target="_blank" rel="noopener" class="hash-link">
                ${data.hash.slice(0, 12)}…
            </a>
        </td>
        <td>${data.address || "(none)"}</td>
    `;
    
    // Add animation for new rows
    if (isNew) {
        row.style.opacity = '0';
        row.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            row.style.transition = 'all 0.5s ease';
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, 100);
    }
    
    return row;
}

// Create floating bubble
function createBubble(data) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    // Size proportional to value relative to threshold
    const baseSize = 30;
    const threshold = state.currentThreshold || 1;
    const scale = Math.min(data.value_btc / threshold, 8);
    const size = baseSize + scale * 20;
    
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.random() * 100}%`;
    
    // Color based on value - larger transactions get more vibrant colors
    let hue, saturation, lightness;
    if (data.value_btc > threshold * 5) {
        // Mega whale - bright colors
        hue = 280 + Math.floor(Math.random() * 40);
        saturation = 80 + Math.floor(Math.random() * 20);
        lightness = 60 + Math.floor(Math.random() * 20);
    } else if (data.value_btc > threshold * 2) {
        // Large whale - blue to purple
        hue = 210 + Math.floor(Math.random() * 60);
        saturation = 70 + Math.floor(Math.random() * 20);
        lightness = 55 + Math.floor(Math.random() * 20);
    } else {
        // Regular whale - blue tones
        hue = 210 + Math.floor(Math.random() * 30);
        saturation = 60 + Math.floor(Math.random() * 20);
        lightness = 50 + Math.floor(Math.random() * 20);
    }
    
    bubble.style.backgroundColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.9)`;
    bubble.style.boxShadow = `0 0 ${size}px hsla(${hue}, ${saturation}%, ${lightness}%, 0.6)`;
    
    // Animation duration based on size
    const duration = 6 + (scale * 2) + Math.random() * 4;
    bubble.style.animationDuration = `${duration}s`;
    
    // Add whale emoji for large transactions
    if (data.value_btc > state.currentThreshold * 2) {
        bubble.innerHTML = '🐋';
        bubble.style.fontSize = `${size * 0.4}px`;
        bubble.style.display = 'flex';
        bubble.style.alignItems = 'center';
        bubble.style.justifyContent = 'center';
        bubble.style.color = 'white';
        bubble.style.textShadow = '0 0 10px rgba(0,0,0,0.5)';
    }
    
    // Add ripple effect
    const ripple = document.createElement('div');
    ripple.className = 'bubble-ripple';
    ripple.style.width = `${size * 2}px`;
    ripple.style.height = `${size * 2}px`;
    ripple.style.left = `calc(${Math.random() * 100}% - ${size}px)`;
    ripple.style.top = `calc(100vh - ${size}px)`;
    ripple.style.animationDuration = `${duration * 0.5}s`;
    elements.bubbleContainer.appendChild(ripple);
    
    // Remove bubble and ripple after animation
    bubble.addEventListener('animationend', () => {
        bubble.remove();
    });
    
    setTimeout(() => {
        ripple.remove();
    }, duration * 500);
    
    elements.bubbleContainer.appendChild(bubble);
}

// Play whale sound effect
function playWhaleSound(btcValue) {
    try {
        // Create audio context for sound effects
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Set frequency based on transaction size
        const frequency = 200 + (btcValue / state.currentThreshold) * 100;
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        // Set volume (very low to be subtle)
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        // Play sound
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        // Silently fail if audio is not supported
        console.log('Audio not supported');
    }
}

// Trigger screen flash effect for mega whales
function triggerScreenFlash() {
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(247, 147, 26, 0.3) 0%, transparent 70%);
        z-index: 9998;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(flash);
    
    // Flash in
    setTimeout(() => {
        flash.style.opacity = '1';
    }, 100);
    
    // Flash out
    setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => {
            flash.remove();
        }, 300);
    }, 400);
}

// Enhanced bubble creation with particle effects
function createBubble(data) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    // Size proportional to value relative to threshold
    const baseSize = 30;
    const threshold = state.currentThreshold || 1;
    const scale = Math.min(data.value_btc / threshold, 8);
    const size = baseSize + scale * 20;
    
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.random() * 100}%`;
    
    // Color based on value - larger transactions get more vibrant colors
    let hue, saturation, lightness;
    if (data.value_btc > threshold * 5) {
        // Mega whale - bright colors
        hue = 280 + Math.floor(Math.random() * 40);
        saturation = 80 + Math.floor(Math.random() * 20);
        lightness = 60 + Math.floor(Math.random() * 20);
    } else if (data.value_btc > threshold * 2) {
        // Large whale - blue to purple
        hue = 210 + Math.floor(Math.random() * 60);
        saturation = 70 + Math.floor(Math.random() * 20);
        lightness = 55 + Math.floor(Math.random() * 20);
    } else {
        // Regular whale - blue tones
        hue = 210 + Math.floor(Math.random() * 30);
        saturation = 60 + Math.floor(Math.random() * 20);
        lightness = 50 + Math.floor(Math.random() * 20);
    }
    
    bubble.style.backgroundColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.9)`;
    bubble.style.boxShadow = `0 0 ${size}px hsla(${hue}, ${saturation}%, ${lightness}%, 0.6)`;
    
    // Animation duration based on size
    const duration = 6 + (scale * 2) + Math.random() * 4;
    bubble.style.animationDuration = `${duration}s`;
    
    // Add whale emoji for large transactions
    if (data.value_btc > state.currentThreshold * 2) {
        bubble.innerHTML = '🐋';
        bubble.style.fontSize = `${size * 0.4}px`;
        bubble.style.display = 'flex';
        bubble.style.alignItems = 'center';
        bubble.style.justifyContent = 'center';
        bubble.style.color = 'white';
        bubble.style.textShadow = '0 0 10px rgba(0,0,0,0.5)';
    }
    
    // Add ripple effect
    const ripple = document.createElement('div');
    ripple.className = 'bubble-ripple';
    ripple.style.width = `${size * 2}px`;
    ripple.style.height = `${size * 2}px`;
    ripple.style.left = `calc(${Math.random() * 100}% - ${size}px)`;
    ripple.style.top = `calc(100vh - ${size}px)`;
    ripple.style.animationDuration = `${duration * 0.5}s`;
    elements.bubbleContainer.appendChild(ripple);
    
    // Add particle trail for mega whales
    if (data.value_btc > threshold * 5) {
        createParticleTrail(bubble, size);
    }
    
    // Remove bubble and ripple after animation
    bubble.addEventListener('animationend', () => {
        bubble.remove();
    });
    
    setTimeout(() => {
        ripple.remove();
    }, duration * 500);
    
    elements.bubbleContainer.appendChild(bubble);
}

// Create particle trail for mega whales
function createParticleTrail(bubble, size) {
    const particleCount = 10;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 4px;
            height: 4px;
            background: rgba(247, 147, 26, 0.8);
            border-radius: 50%;
            pointer-events: none;
            animation: particleTrail 2s linear infinite;
            animation-delay: ${i * 0.1}s;
        `;
        
        elements.bubbleContainer.appendChild(particle);
        
        setTimeout(() => {
            particle.remove();
        }, 2000 + i * 100);
    }
}

// Add activity item
function addActivityItem(type, data) {
    const item = {
        type,
        data,
        timestamp: data.timestamp || Date.now() / 1000
    };
    
    state.activityItems.unshift(item);
    
    // Keep only the latest items
    if (state.activityItems.length > MAX_ACTIVITY_ITEMS) {
        state.activityItems = state.activityItems.slice(0, MAX_ACTIVITY_ITEMS);
    }
    
    updateActivityFeed();
}



// Show notification
function showNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const icon = getNotificationIcon(type);
    
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="${icon}"></i>
        </div>
        <div class="notification-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    
    elements.notificationContainer.appendChild(notification);
    
    // Add sci-fi entrance animation
    notification.style.transform = 'translateX(100%) scale(0.8)';
    notification.style.opacity = '0';
    
    setTimeout(() => {
        notification.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        notification.style.transform = 'translateX(0) scale(1)';
        notification.style.opacity = '1';
    }, 100);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%) scale(0.8)';
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 5000);
}

// Enhanced whale alert system
function showWhaleAlert(data) {
    const alertContainer = document.querySelector('.whale-alerts-container');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = 'whale-alert';
    
    const btcValue = data.value_btc.toFixed(2);
    const usdValue = data.value_usd.toLocaleString(undefined, { maximumFractionDigits: 2 });
    
    alert.innerHTML = `
        <div class="whale-alert-content">
            <i class="fas fa-whale"></i>
            <div>
                <div class="whale-amount">${btcValue} BTC</div>
                <div class="whale-usd">$${usdValue}</div>
            </div>
        </div>
    `;
    
    alertContainer.appendChild(alert);
    
    // Trigger entrance animation
    setTimeout(() => {
        alert.classList.add('show');
    }, 100);
    
    // Remove alert after 8 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => {
            alert.remove();
        }, 300);
    }, 8000);
}

// Get notification icon
function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        case 'whale': return 'fas fa-whale';
        default: return 'fas fa-info-circle';
    }
}

// Update connection status
function updateConnectionStatus(status) {
    state.connectionStatus = status;
    elements.connectionStatus.textContent = status;
    
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    
    switch (status) {
        case 'connected':
            elements.statusDot.style.background = 'var(--success-color)';
            statusText.textContent = 'Connected to Bitcoin Network';
            statusIndicator.style.background = 'rgba(16, 185, 129, 0.2)';
            statusIndicator.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            break;
        case 'connecting':
            elements.statusDot.style.background = 'var(--warning-color)';
            statusText.textContent = 'Connecting to Bitcoin Network...';
            statusIndicator.style.background = 'rgba(245, 158, 11, 0.2)';
            statusIndicator.style.borderColor = 'rgba(245, 158, 11, 0.3)';
            break;
        case 'disconnected':
            elements.statusDot.style.background = 'var(--danger-color)';
            statusText.textContent = 'Disconnected from Bitcoin Network';
            statusIndicator.style.background = 'rgba(239, 68, 68, 0.2)';
            statusIndicator.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            break;
    }
}

// Update last update time
function updateLastUpdate() {
    const now = Date.now();
    const diff = now - state.lastUpdateTime;
    
    if (diff < 60000) {
        elements.lastUpdate.textContent = 'Just now';
    } else if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        elements.lastUpdate.textContent = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        const hours = Math.floor(diff / 3600000);
        elements.lastUpdate.textContent = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
}

// Fetch Bitcoin price
function fetchBitcoinPrice() {
    fetch('/api/bitcoin-price')
        .then(response => response.json())
        .then(data => {
            if (data.price) {
                const priceElement = document.getElementById('btc-price');
                if (priceElement) {
                    priceElement.textContent = `$${data.price.toLocaleString()}`;
                    priceElement.style.animation = 'none';
                    priceElement.offsetHeight; // Trigger reflow
                    priceElement.style.animation = 'pricePulse 0.5s ease-in-out';
                }
            }
        })
        .catch(error => {
            console.error('Failed to fetch Bitcoin price:', error);
        });
}

// Fetch current Bitcoin block height
function fetchCurrentBlockHeight() {
    fetch('/api/block-height')
        .then(response => response.json())
        .then(data => {
            if (data.height && elements.blockHeight) {
                elements.blockHeight.textContent = data.height;
                console.log('Current block height fetched:', data.height, 'from', data.source);
            }
        })
        .catch(error => {
            console.error('Error fetching block height:', error);
        });
}

// Initialize matrix effect
function initMatrixEffect() {
    const matrixDigits = document.querySelectorAll('.matrix-digit');
    matrixDigits.forEach((digit) => {
        const index = parseInt(digit.dataset.i) || 0;
        digit.style.setProperty('--i', index);
        
        // Random interval for each digit
        const interval = 1500 + Math.random() * 2000;
        
        setInterval(() => {
            digit.textContent = Math.random() > 0.5 ? '1' : '0';
            digit.style.animation = 'none';
            digit.offsetHeight; // Trigger reflow
            digit.style.animation = 'matrixFall 0.3s ease-in-out';
        }, interval);
    });
}

// Initialize network visualization
function initNetworkViz() {
    const canvas = document.getElementById('networkCanvas');
    if (!canvas) {
        console.log('Network canvas not found, creating fallback...');
        // Create canvas if it doesn't exist
        const networkViz = document.querySelector('.network-viz');
        if (networkViz) {
            const newCanvas = document.createElement('canvas');
            newCanvas.id = 'networkCanvas';
            newCanvas.width = networkViz.offsetWidth;
            newCanvas.height = networkViz.offsetHeight;
            networkViz.appendChild(newCanvas);
            return initNetworkViz(); // Retry with new canvas
        }
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const nodes = [];
    const connections = [];
    
    // Create initial nodes
    for (let i = 0; i < 25; i++) {
        nodes.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 4 + 2,
            pulse: Math.random() * Math.PI * 2
        });
    }
    
    function animate() {
        // Clear with slight fade effect
        ctx.fillStyle = 'rgba(20, 28, 51, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw nodes
        nodes.forEach(node => {
            node.x += node.vx;
            node.y += node.vy;
            node.pulse += 0.05;
            
            // Bounce off edges
            if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
            if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
            
            // Keep nodes within bounds
            node.x = Math.max(0, Math.min(canvas.width, node.x));
            node.y = Math.max(0, Math.min(canvas.height, node.y));
            
            // Draw node with pulsing effect
            const pulseSize = node.size + Math.sin(node.pulse) * 1;
            ctx.beginPath();
            ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
            
            // Create gradient for node
            const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, pulseSize);
            gradient.addColorStop(0, 'rgba(247, 147, 26, 0.9)');
            gradient.addColorStop(0.7, 'rgba(247, 147, 26, 0.6)');
            gradient.addColorStop(1, 'rgba(247, 147, 26, 0.1)');
            
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Add glow effect
            ctx.shadowColor = 'rgba(247, 147, 26, 0.8)';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        
        // Draw connections
        nodes.forEach((node1, i) => {
            nodes.slice(i + 1).forEach(node2 => {
                const distance = Math.sqrt(
                    Math.pow(node1.x - node2.x, 2) + Math.pow(node1.y - node2.y, 2)
                );
                
                if (distance < 120) {
                    const opacity = 0.4 * (1 - distance / 120);
                    ctx.beginPath();
                    ctx.moveTo(node1.x, node1.y);
                    ctx.lineTo(node2.x, node2.y);
                    ctx.strokeStyle = `rgba(247, 147, 26, ${opacity})`;
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }
            });
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    // Add interaction - nodes respond to mouse
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        nodes.forEach(node => {
            const distance = Math.sqrt(
                Math.pow(mouseX - node.x, 2) + Math.pow(mouseY - node.y, 2)
            );
            
            if (distance < 100) {
                const force = (100 - distance) / 100;
                const dx = (node.x - mouseX) * force * 0.02;
                const dy = (node.y - mouseY) * force * 0.02;
                node.vx += dx;
                node.vy += dy;
            }
        });
    });
}

// Hide loading overlay
function hideLoadingOverlay() {
    setTimeout(() => {
        elements.loadingOverlay.classList.add('hidden');
    }, 2000);
}

// Initialize SSE connection
const evtSource = new EventSource("/stream");

evtSource.addEventListener("hello", () => {
    console.log("Connected to event stream");
    updateConnectionStatus('connected');
    fetchConfig();
});

evtSource.onerror = function (err) {
    console.error("EventSource error:", err);
    updateConnectionStatus('disconnected');
};

// Handle summary events
evtSource.addEventListener("summary", (evt) => {
    const data = JSON.parse(evt.data);
    updateStats(data);
    addActivityItem('summary', data);
    state.lastUpdateTime = Date.now();
    updateLastUpdate();
});

// Handle whale events
evtSource.addEventListener("whale", (evt) => {
    const data = JSON.parse(evt.data);
    addWhaleTransaction(data);
    state.lastUpdateTime = Date.now();
    updateLastUpdate();
});

// Handle block events
evtSource.addEventListener("block", (evt) => {
    const data = JSON.parse(evt.data);
    console.log('Block event received:', data); // Debug log
    state.blocksMined++;
    elements.blocksCount.textContent = state.blocksMined;
    
    // Update block height display if available
    if (data.height && elements.blockHeight) {
        elements.blockHeight.textContent = data.height;
        console.log('Block height updated to:', data.height); // Debug log
    } else {
        console.log('No height data in block event or blockHeight element not found'); // Debug log
    }
    
    animateStatCard('blocks-card');
    addActivityItem('block', data);
    state.lastUpdateTime = Date.now();
    updateLastUpdate();
});

// Handle config events
evtSource.addEventListener("config", (evt) => {
    const data = JSON.parse(evt.data);
    if (data.threshold !== undefined) {
        state.currentThreshold = data.threshold;
        elements.thresholdInput.value = state.currentThreshold;
    }
    if (data.interval !== undefined) {
        state.currentInterval = data.interval;
        elements.intervalInput.value = state.currentInterval;
    }
});

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);