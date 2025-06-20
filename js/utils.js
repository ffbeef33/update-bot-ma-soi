// js/utils.js
// Create or get device ID
function getOrCreateDeviceId() {
    // Check if already exists in localStorage
    let id = localStorage.getItem('deviceId');
    if (!id) {
        // Create a new ID if none exists
        id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('deviceId', id);
    }
    return id;
}

// Show role selection screen
function showRoleSelection() {
    hideAllContainers();
    document.getElementById('roleSelectionScreen').classList.remove('hidden');
}

// Hide all containers
function hideAllContainers() {
    document.getElementById('roleSelectionScreen').classList.add('hidden');
    document.getElementById('setupContainer').classList.add('hidden');
    document.getElementById('adminRoomsContainer').classList.add('hidden');
    document.getElementById('playerContainer').classList.add('hidden');
    document.getElementById('adminContainer').classList.add('hidden');
    document.getElementById('playerRoleView').classList.add('hidden');
}

// Toggle section collapse/expand
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    section.classList.toggle('collapsed');
    
    // Save collapsed state to localStorage
    saveSectionState(sectionId, section.classList.contains('collapsed'));
}

// Save section collapsed state to localStorage
function saveSectionState(sectionId, isCollapsed) {
    const sectionStates = JSON.parse(localStorage.getItem('sectionStates') || '{}');
    sectionStates[sectionId] = isCollapsed;
    localStorage.setItem('sectionStates', JSON.stringify(sectionStates));
}

// Restore section collapsed states from localStorage
function restoreSectionStates() {
    const sectionStates = JSON.parse(localStorage.getItem('sectionStates') || '{}');
    
    // Collapsible sections
    const collapsibleSections = ['playerManagementSection', 'votingSection', 'nightNotesSection'];
    
    for (const sectionId of collapsibleSections) {
        const section = document.getElementById(sectionId);
        if (section && sectionStates[sectionId]) {
            section.classList.add('collapsed');
        }
    }
}

// Show confirmation modal
function showConfirmModal(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.remove('hidden');
    confirmCallback = callback;
}

// Close confirmation modal
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
    confirmCallback = null;
}

// Handle confirmation yes button
function handleConfirmYes() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmModal();
}

// Show setup status message
function showSetupStatus(message, type = '') {
    const statusElement = document.getElementById('setupStatus');
    statusElement.textContent = message;
    
    // Reset all classes
    statusElement.className = 'status-bar';
    
    if (type === 'error') {
        statusElement.style.backgroundColor = '#ffebee';
        statusElement.style.color = '#c62828';
    } else if (type === 'success') {
        statusElement.style.backgroundColor = '#e8f5e9';
        statusElement.style.color = '#2e7d32';
    } else {
        statusElement.style.backgroundColor = '#f0f0f0';
        statusElement.style.color = '#333';
    }
    
    statusElement.classList.remove('hidden');
}

// Show login status message
function showLoginStatus(message, type = '') {
    const statusElement = document.getElementById('loginStatus');
    statusElement.textContent = message;
    
    // Reset all classes
    statusElement.className = 'status-bar';
    
    if (type === 'error') {
        statusElement.style.backgroundColor = '#ffebee';
        statusElement.style.color = '#c62828';
    } else if (type === 'success') {
        statusElement.style.backgroundColor = '#e8f5e9';
        statusElement.style.color = '#2e7d32';
    } else if (type === 'info') {
        statusElement.style.backgroundColor = '#e3f2fd';
        statusElement.style.color = '#0d47a1';
    } else {
        statusElement.style.backgroundColor = '#f0f0f0';
        statusElement.style.color = '#333';
    }
    
    statusElement.classList.remove('hidden');
}

// Toggle password visibility
function togglePasswordVisibility(inputId) {
    const passwordInput = document.getElementById(inputId);
    const button = passwordInput.nextElementSibling;
    
    // Toggle the password visibility
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        button.title = 'Ẩn mật khẩu';
        button.querySelector('.show-icon').innerHTML = '🔒';
    } else {
        passwordInput.type = 'password';
        button.title = 'Hiện mật khẩu';
        button.querySelector('.show-icon').innerHTML = '👁️';
    }
}