// js/app.js
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Global variables
let currentGameCode = '';
let playersListener = null;
let votingListener = null;
let gameRestartListener = null;
let countdownInterval = null;
let playerName = '';
let playerDisplayName = '';
let isGameMaster = false;
let currentNightTab = 1;
let deviceId = '';
let confirmCallback = null;
let playerIsDead = false;
let sheetsData = []; // Store data from Google Sheets

// When the page has loaded
document.addEventListener('DOMContentLoaded', initApp);

// Initialize the application
async function initApp() {
    // Create or get deviceId
    deviceId = getOrCreateDeviceId();
    
    // Restore collapsed section states from localStorage
    restoreSectionStates();
    
    // Check if there's a saved role in localStorage
    const savedRole = localStorage.getItem('userRole');
    
    if (savedRole === 'gameMaster') {
        // If already a game master, check if authenticated
        const isAuthenticated = localStorage.getItem('authenticated') === 'true';
        
        if (isAuthenticated) {
            activateGameMasterUI();
        } else {
            showRoleSelection();
        }
    } else if (savedRole === 'player') {
        activatePlayerUI();
    } else {
        showRoleSelection();
    }
    
    // Show role switch link
    document.getElementById('switchRole').classList.remove('hidden');
    
    // Load Google Sheets data if game master
    if (isGameMaster) {
        await fetchSheetsData();
    }
}

// Switch user role
function switchUserRole() {
    // Clear user states
    localStorage.removeItem('userRole');
    localStorage.removeItem('authenticated');
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerRole');
    localStorage.removeItem('playerStatus');
    localStorage.removeItem('currentGame');
    
    // Stop Firebase listeners if any
    if (playersListener) {
        playersListener.off();
        playersListener = null;
    }
    
    if (votingListener) {
        votingListener.off();
        votingListener = null;
    }
    
    if (gameRestartListener) {
        gameRestartListener.off();
        gameRestartListener = null;
    }
    
    // Cancel countdown if any
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // Show role selection screen
    showRoleSelection();
}