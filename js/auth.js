// js/auth.js
// Select user role
function selectUserRole(role) {
    if (role === 'player') {
        localStorage.setItem('userRole', 'player');
        activatePlayerUI();
    } else if (role === 'gameMaster') {
        showPasswordModal();
    }
}

// Show password modal
function showPasswordModal() {
    document.getElementById('passwordModal').classList.remove('hidden');
    document.getElementById('masterPassword').value = '';
    document.getElementById('passwordError').classList.add('hidden');
    
    // Auto focus on password field
    setTimeout(() => {
        document.getElementById('masterPassword').focus();
    }, 100);
    
    // Add enter key listener
    document.getElementById('masterPassword').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            verifyPassword();
        }
    });
}

// Cancel password modal
function cancelPasswordModal() {
    document.getElementById('passwordModal').classList.add('hidden');
}

// Verify game master password
function verifyPassword() {
    const password = document.getElementById('masterPassword').value;
    
    if (password === MASTER_PASSWORD) {
        // Password correct
        localStorage.setItem('userRole', 'gameMaster');
        localStorage.setItem('authenticated', 'true');
        
        document.getElementById('passwordModal').classList.add('hidden');
        activateGameMasterUI();
    } else {
        // Password incorrect
        document.getElementById('passwordError').classList.remove('hidden');
        document.getElementById('masterPassword').focus();
    }
}

// Activate game master UI
async function activateGameMasterUI() {
    isGameMaster = true;
    hideAllContainers();
    
    document.getElementById('setupContainer').classList.remove('hidden');
    document.getElementById('adminRoomsContainer').classList.remove('hidden');
    document.getElementById('adminContainer').classList.remove('hidden');
    
    // Load room list for game master
    loadRooms(true);
    
    // Load data from Google Sheets
    await fetchSheetsData();
}