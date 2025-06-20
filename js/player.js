// js/player.js
// Activate player UI
function activatePlayerUI() {
    isGameMaster = false;
    hideAllContainers();
    
    document.getElementById('playerContainer').classList.remove('hidden');
    
    // Check if player is already logged in
    const savedLogin = localStorage.getItem('playerName');
    const savedGame = localStorage.getItem('currentGame');
    
    if (savedLogin && savedGame) {
        // Already logged in before, check game state
        playerName = savedLogin;
        playerDisplayName = savedLogin;
        
        // Display player name
        document.getElementById('displayName').textContent = playerDisplayName;
        
        // Hide login form
        document.querySelector('.login-form').classList.add('hidden');
        
        // Show role information screen
        document.getElementById('playerRoleView').classList.remove('hidden');
        
        // Listen to role updates and voting sessions
        listenToGameUpdates(savedGame, savedLogin);
        
        // Check game state before displaying role
        checkGameStateForPlayer(savedGame, savedLogin);
    }
}

// Check game state for player
async function checkGameStateForPlayer(gameCode, playerName) {
    try {
        const gameSnapshot = await db.ref('games/' + gameCode).once('value');
        if (!gameSnapshot.exists()) {
            // Game doesn't exist, send player back to login
            playerLogout();
            showLoginStatus('Phòng chơi không tồn tại, vui lòng đăng nhập lại.', 'error');
            return;
        }
        
        const gameData = gameSnapshot.val();
        const gameStarted = gameData.gameStarted || false;
        const gameEnded = gameData.gameEnded || false;
        
        // Get player info
        const playerSnapshot = await db.ref(`games/${gameCode}/players/${playerName}`).once('value');
        if (!playerSnapshot.exists()) {
            // Player no longer in game, send back to login
            playerLogout();
            showLoginStatus('Bạn không còn trong phòng chơi, vui lòng đăng nhập lại.', 'error');
            return;
        }
        
        const playerData = playerSnapshot.val();
        const role = typeof playerData === 'object' ? playerData.role : playerData;
        const status = typeof playerData === 'object' ? (playerData.status || 'alive') : 'alive';
        const roleRevealed = typeof playerData === 'object' ? (playerData.roleRevealed || false) : false;
        
        // Save states
        playerIsDead = status === 'dead';
        localStorage.setItem('playerRole', role);
        localStorage.setItem('playerStatus', status);
        
        // Hide all status screens
        document.getElementById('roleResult').classList.add('hidden');
        document.getElementById('waitingForGameStart').classList.add('hidden');
        document.getElementById('gameEndedNotice').classList.add('hidden');
        document.getElementById('gameInfoForPlayer').classList.add('hidden'); // Ẩn thông tin game mặc định
        
        // Display appropriate screen based on game state
        if (gameEnded) {
            // Game has ended
            document.getElementById('gameEndedNotice').classList.remove('hidden');
            document.getElementById('gameInfoForPlayer').classList.remove('hidden'); // Hiện thông tin game
            
            // Cập nhật thông tin game
            updateGameInfoForPlayer(gameData);
            
        } else if (gameStarted && roleRevealed) {
            // Game has started and role is revealed
            document.getElementById('roleResult').classList.remove('hidden');
            document.getElementById('gameInfoForPlayer').classList.remove('hidden'); // Hiện thông tin game
            document.getElementById('role').textContent = role;
            
            // Cập nhật thông tin game
            updateGameInfoForPlayer(gameData);
            
            // Show dead status if needed
            if (playerIsDead) {
                document.getElementById('roleResult').classList.add('dead');
                document.getElementById('deadNotice').classList.remove('hidden');
            } else {
                document.getElementById('roleResult').classList.remove('dead');
                document.getElementById('deadNotice').classList.add('hidden');
            }
        } else {
            // Game not started or role not revealed yet
            document.getElementById('waitingForGameStart').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Lỗi khi kiểm tra trạng thái game:', error);
        showLoginStatus('Lỗi khi kiểm tra trạng thái game.', 'error');
    }
}

// Player login
async function playerLogin() {
    const password = document.getElementById('playerPassword').value;
    
    if (!password) {
        showLoginStatus('Vui lòng nhập mật khẩu!', 'error');
        return;
    }
    
    try {
        showLoginStatus('Đang đăng nhập...');
        
        // Load data from Google Sheets if not loaded yet
        if (!sheetsData || sheetsData.length === 0) {
            sheetsData = await fetchSheetsData();
        }
        
        // Find player in Google Sheets data
        const playerData = sheetsData.find(player => player.password === password);
        
        if (!playerData) {
            showLoginStatus('Mật khẩu không đúng!', 'error');
            return;
        }
        
        // Get info from found data
        const loginName = playerData.playerName;
        const role = playerData.role;
        
        // Find active game room
        const gamesRef = db.ref('games');
        const gamesSnapshot = await gamesRef.orderByChild('createdAt').limitToLast(1).once('value');
        
        if (!gamesSnapshot.exists()) {
            showLoginStatus('Không có phòng nào đang hoạt động! Vui lòng đợi quản trò tạo phòng.', 'error');
            return;
        }
        
        // Get latest game info
        let gameData = null;
        let gameCode = null;
        
        gamesSnapshot.forEach(childSnapshot => {
            gameData = childSnapshot.val();
            gameCode = childSnapshot.key;
        });
        
        if (!gameData || !gameCode) {
            showLoginStatus('Không tìm thấy phòng hợp lệ!', 'error');
            return;
        }
        
        // Check if player already exists in room
        let playerStatus = 'alive';
        let roleRevealed = false;
        
        if (gameData.players && gameData.players[loginName]) {
            // If player exists, keep their status
            const existingPlayer = gameData.players[loginName];
            if (typeof existingPlayer === 'object') {
                playerStatus = existingPlayer.status || 'alive';
                roleRevealed = existingPlayer.roleRevealed || false;
            }
        }
        
        // Update or add player to room
        await db.ref(`games/${gameCode}/players/${loginName}`).set({
            role: role,
            status: playerStatus,
            roleRevealed: roleRevealed
        });
        
        // Add player to logged in players list
        await db.ref(`games/${gameCode}/loggedPlayers/${loginName}`).set(true);
        
        // Save player info
        playerName = loginName;
        playerDisplayName = loginName;
        playerIsDead = playerStatus === 'dead';
        
        // Save to localStorage
        localStorage.setItem('playerName', loginName);
        localStorage.setItem('playerRole', role);
        localStorage.setItem('playerStatus', playerStatus);
        localStorage.setItem('currentGame', gameCode);
        
        // Display player info
        document.getElementById('displayName').textContent = playerDisplayName;
        
        // Hide login form
        document.querySelector('.login-form').classList.add('hidden');
        
        // Show role info screen
        document.getElementById('playerRoleView').classList.remove('hidden');
        
        // Listen to role updates and voting sessions
        listenToGameUpdates(gameCode, loginName);
        
        // Check game state to display proper UI
        checkGameStateForPlayer(gameCode, loginName);
        
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        showLoginStatus('Đã xảy ra lỗi khi đăng nhập!', 'error');
    }
}

// Player logout
function playerLogout() {
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerRole');
    localStorage.removeItem('playerStatus');
    localStorage.removeItem('currentGame');
    
    // Stop listening for updates
    if (gameRestartListener) {
        gameRestartListener.off();
        gameRestartListener = null;
    }
    
    if (votingListener) {
        votingListener.off();
        votingListener = null;
    }
    
    // Show login form again
    document.querySelector('.login-form').classList.remove('hidden');
    document.getElementById('playerRoleView').classList.add('hidden');
    document.getElementById('playerPassword').value = '';
    document.getElementById('loginStatus').classList.add('hidden');
}

// Listen to game updates for player
function listenToGameUpdates(gameCode, loginName) {
    if (!gameCode || !loginName) return;
    
    // Listen to player updates
    listenToPlayerUpdates(gameCode, loginName);
    
    // Listen to voting sessions
    listenToVotingSession(gameCode);
    
    // Thêm: Lắng nghe cập nhật thông tin game
    db.ref(`games/${gameCode}`).on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        const gameData = snapshot.val();
        
        // Cập nhật thông tin trò chơi cho người chơi
        updateGameInfoForPlayer(gameData);
    });
}

// Listen to player updates
function listenToPlayerUpdates(gameCode, loginName) {
    // Stop previous listener if exists
    if (gameRestartListener) {
        gameRestartListener.off();
    }
    
    // Listen to changes in player info
    gameRestartListener = db.ref(`games/${gameCode}/players/${loginName}`);
    gameRestartListener.on('value', (snapshot) => {
        if (!snapshot.exists()) {
            // Player was removed from room
            alert('Bạn đã bị đuổi khỏi phòng!');
            playerLogout();
            return;
        }
        
        const playerData = snapshot.val();
        
        // Determine role, status, and role revealed status
        let newRole, newStatus, roleRevealed;
        if (typeof playerData === 'object') {
            newRole = playerData.role || 'Không xác định';
            newStatus = playerData.status || 'alive';
            roleRevealed = playerData.roleRevealed || false;
        } else {
            newRole = playerData;
            newStatus = 'alive';
            roleRevealed = false;
        }
        
        // Save new state
        const oldRole = localStorage.getItem('playerRole') || '';
        const oldStatus = playerIsDead ? 'dead' : 'alive';
        
        // Update localStorage
        localStorage.setItem('playerRole', newRole);
        localStorage.setItem('playerStatus', newStatus);
        playerIsDead = newStatus === 'dead';
        
        // Check game state to decide what to display
        db.ref(`games/${gameCode}`).once('value', (gameSnapshot) => {
            if (!gameSnapshot.exists()) return;
            
            const gameData = gameSnapshot.val();
            const gameStarted = gameData.gameStarted || false;
            const gameEnded = gameData.gameEnded || false;
            
            // Update UI based on game and player state
            document.getElementById('roleResult').classList.add('hidden');
            document.getElementById('waitingForGameStart').classList.add('hidden');
            document.getElementById('gameEndedNotice').classList.add('hidden');
            document.getElementById('gameInfoForPlayer').classList.add('hidden'); // Ẩn thông tin game mặc định
            
            if (gameEnded) {
                // Game has ended
                document.getElementById('gameEndedNotice').classList.remove('hidden');
                document.getElementById('gameInfoForPlayer').classList.remove('hidden'); // Hiện thông tin game
                
                // Cập nhật thông tin game
                updateGameInfoForPlayer(gameData);
                
            } else if (gameStarted && roleRevealed) {
                // Game has started and role is revealed
                document.getElementById('role').textContent = newRole;
                document.getElementById('roleResult').classList.remove('hidden');
                document.getElementById('gameInfoForPlayer').classList.remove('hidden'); // Hiện thông tin game
                
                // Cập nhật thông tin game
                updateGameInfoForPlayer(gameData);
                
                if (oldRole !== newRole) {
                    // If role changed, add effect
                    const roleResult = document.getElementById('roleResult');
                    roleResult.classList.add('role-flash');
                    setTimeout(() => {
                        roleResult.classList.remove('role-flash');
                    }, 3000);
                    
                    showLoginStatus('Vai trò của bạn đã được cập nhật thành: ' + newRole, 'success');
                }
                
                // Update dead/alive status display
                if (playerIsDead) {
                    document.getElementById('roleResult').classList.add('dead');
                    document.getElementById('deadNotice').classList.remove('hidden');
                } else {
                    document.getElementById('roleResult').classList.remove('dead');
                    document.getElementById('deadNotice').classList.add('hidden');
                }
                
                // Notify if dead/alive status changed
                if (newStatus !== oldStatus) {
                    if (newStatus === 'dead' && oldStatus === 'alive') {
                        showLoginStatus('Bạn đã bị loại khỏi trò chơi!', 'error');
                    } else if (newStatus === 'alive' && oldStatus === 'dead') {
                        showLoginStatus('Bạn đã được hồi sinh!', 'success');
                    }
                }
            } else {
                // Game not started or role not revealed
                document.getElementById('waitingForGameStart').classList.remove('hidden');
            }
        });
    });
    
    // Listen to game state changes
    db.ref(`games/${gameCode}`).on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        
        const gameData = snapshot.val();
        const gameStarted = gameData.gameStarted || false;
        const gameEnded = gameData.gameEnded || false;
        
        // Update player UI when game state changes
        // To avoid conflicts with player listener, we only update display state
        if (gameEnded) {
            document.getElementById('roleResult').classList.add('hidden');
            document.getElementById('waitingForGameStart').classList.add('hidden');
            document.getElementById('gameEndedNotice').classList.remove('hidden');
            document.getElementById('gameInfoForPlayer').classList.remove('hidden'); // Hiện thông tin game
            showLoginStatus('Trò chơi đã kết thúc!', 'info');
            
            // Cập nhật thông tin game
            updateGameInfoForPlayer(gameData);
        }
    });
}

// Cập nhật thông tin trò chơi cho người chơi
function updateGameInfoForPlayer(gameData) {
    if (!gameData || !gameData.players) return;
    
    const players = gameData.players;
    const totalPlayers = Object.keys(players).length;
    let alivePlayers = 0;
    
    // Đếm số người chơi còn sống
    Object.values(players).forEach(playerData => {
        const status = typeof playerData === 'object' ? (playerData.status || 'alive') : 'alive';
        if (status === 'alive') {
            alivePlayers++;
        }
    });
    
    // Cập nhật số lượng người chơi
    document.getElementById('playerAliveCount').textContent = alivePlayers;
    document.getElementById('playerTotalCount').textContent = totalPlayers;
    
    // Tạo danh sách vai trò
    const roleFrequency = {};
    
    Object.values(players).forEach(playerData => {
        const role = typeof playerData === 'object' ? playerData.role : playerData;
        
        if (!roleFrequency[role]) {
            roleFrequency[role] = 1;
        } else {
            roleFrequency[role]++;
        }
    });
    
    // Hiển thị danh sách vai trò
    const roleListElement = document.getElementById('roleListForPlayer');
    roleListElement.innerHTML = '';
    
    Object.entries(roleFrequency).sort((a, b) => b[1] - a[1]).forEach(([role, count]) => {
        const roleItem = document.createElement('li');
        // Chỉ hiển thị tên vai trò và số lượng, không hiển thị số lượng sống/chết
        roleItem.innerHTML = `${role} (${count})`;
        roleListElement.appendChild(roleItem);
    });
}