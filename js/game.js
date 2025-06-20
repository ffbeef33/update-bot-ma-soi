// js/game.js
// Create a new game (game master)
async function setupGame() {
    // Check if there's data from Google Sheets
    if (!sheetsData || sheetsData.length === 0) {
        showSetupStatus('Chưa có dữ liệu người chơi từ Google Sheets!', 'error');
        await fetchSheetsData();
        
        if (!sheetsData || sheetsData.length === 0) {
            return;
        }
    }
    
    showSetupStatus('Đang tạo trò chơi...');
    
    try {
        // Create unique game code with time
        let code = 'R' + Math.random().toString(36).substring(2, 6).toUpperCase() + 
                   new Date().getSeconds();
        
        // Prepare player data from Google Sheets
        const players = {};
        sheetsData.forEach(row => {
            const playerName = row.playerName;
            const role = row.role;
            
            players[playerName] = {
                role: role,
                status: 'alive',
                roleRevealed: false // Add role revealed state as false initially
            };
        });
        
        // Initialize night notes structure with first night
        const initialNotes = {
            night1: {
                content: '',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }
        };
        
        // Initialize voting structure
        const initialVoting = {
            active: false,
            endTime: 0,
            duration: 60,
            votes: {}
        };
        
        await db.ref('games/' + code).set({
            playerCount: sheetsData.length,
            players: players,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            nightNotes: initialNotes,
            voting: initialVoting,
            gameStarted: false,
            gameEnded: false, // Add game ended state as false initially
            loggedPlayers: {}
        });
        
        document.getElementById('code').textContent = code;
        document.getElementById('gameCode').classList.remove('hidden');
        document.getElementById('adminGameCode').value = code;
        currentGameCode = code;
        
        // Automatically view roles after creation
        viewRoles();
        
        // Update room list
        loadRooms(true);
        
        showSetupStatus(`Trò chơi đã được tạo thành công với mã: ${code}`, 'success');
    } catch (error) {
        console.error('Lỗi khi tạo trò chơi:', error);
        showSetupStatus('Lỗi khi tạo trò chơi. Vui lòng thử lại!', 'error');
    }
}

// Update roles from Google Sheet
async function refreshRolesFromSheet() {
    if (!currentGameCode) {
        alert('Vui lòng chọn một phòng trước!');
        return;
    }
    
    try {
        // Reload data from Google Sheets
        const data = await fetchSheetsData();
        
        if (!data || data.length === 0) {
            alert('Không thể tải dữ liệu từ Google Sheets!');
            return;
        }
        
        // Get current room info
        const gameRef = db.ref('games/' + currentGameCode);
        const snapshot = await gameRef.once('value');
        
        if (!snapshot.exists()) {
            alert('Phòng không tồn tại!');
            return;
        }
        
        const gameData = snapshot.val();
        
        // Create new player data map from Google Sheets
        const playersFromSheet = {};
        data.forEach(row => {
            const playerName = row.playerName;
            const role = row.role;
            
            playersFromSheet[playerName] = {
                role: role,
                status: 'alive', // Reset alive status for all players on update
                roleRevealed: false // Role not revealed yet state
            };
        });
        
        // Keep logged in players info
        const loggedPlayers = gameData.loggedPlayers || {};
        
        // Update room info - important: keep game state
        await gameRef.update({
            players: playersFromSheet,
            playerCount: data.length,
            lastUpdate: firebase.database.ServerValue.TIMESTAMP,
            // Keep game state
            gameStarted: gameData.gameStarted || false,
            gameEnded: gameData.gameEnded || false
        });
        
        // Show success message
        if (gameData.gameEnded) {
            alert('Đã cập nhật vai trò mới cho người chơi thành công! Bạn có thể bắt đầu lại trò chơi.');
        } else {
            alert('Đã cập nhật vai trò cho người chơi thành công!');
        }
        
    } catch (error) {
        console.error('Lỗi khi cập nhật từ Google Sheets:', error);
        alert('Đã xảy ra lỗi khi cập nhật từ Google Sheets!');
    }
}

// Start game and reveal roles to players
async function startGameForPlayers() {
    if (!currentGameCode) {
        alert('Vui lòng chọn một phòng trước!');
        return;
    }
    
    // Check if the game was previously ended
    const gameSnapshot = await db.ref('games/' + currentGameCode).once('value');
    const gameData = gameSnapshot.val();
    const isRestart = gameData && gameData.gameEnded === true;
    
    const confirmMessage = isRestart 
        ? 'Bạn có chắc chắn muốn bắt đầu lại trò chơi? Vai trò mới sẽ được hiển thị cho tất cả người chơi.'
        : 'Bạn có chắc chắn muốn bắt đầu trò chơi? Vai trò sẽ được hiển thị cho tất cả người chơi.';
    
    showConfirmModal(
        isRestart ? 'Bắt đầu lại trò chơi' : 'Bắt đầu trò chơi',
        confirmMessage,
        async function() {
            try {
                // If restarting, make sure roles are updated from Google Sheets
                if (isRestart) {
                    // Remind game master to update roles
                    if (!confirm("Bạn đã cập nhật vai trò mới từ Google Sheets chưa?\nNếu chưa, hãy nhấn 'Hủy' và sử dụng nút 'Cập nhật' trước.")) {
                        return;
                    }
                    
                    // Reset role revealed state and alive/dead state for all players
                    const playersRef = db.ref('games/' + currentGameCode + '/players');
                    const playersSnapshot = await playersRef.once('value');
                    const players = playersSnapshot.val() || {};
                    
                    if (players) {
                        const updates = {};
                        Object.keys(players).forEach(playerName => {
                            // Reset alive state for each player and clear role revealed state
                            updates[playerName + '/status'] = 'alive';
                            updates[playerName + '/roleRevealed'] = false;
                        });
                        
                        await playersRef.update(updates);
                    }
                }
                
                // Update game state
                await db.ref('games/' + currentGameCode).update({
                    gameStarted: true,
                    gameEnded: false,
                    startedAt: firebase.database.ServerValue.TIMESTAMP
                });
                
                // Wait a bit before setting roleRevealed to true to ensure above state updates are applied
                setTimeout(async () => {
                    // Update role revealed state for all players
                    const playersRef = db.ref('games/' + currentGameCode + '/players');
                    const playersSnapshot = await playersRef.once('value');
                    const players = playersSnapshot.val() || {};
                    
                    if (players) {
                        const updates = {};
                        Object.keys(players).forEach(playerName => {
                            updates[playerName + '/roleRevealed'] = true;
                        });
                        
                        await playersRef.update(updates);
                    }
                    
                    // Change button content
                    document.getElementById('startGameButton').textContent = 'Trò chơi đã bắt đầu';
                    document.getElementById('startGameButton').disabled = true;
                    document.getElementById('endGameButton').textContent = 'Kết Thúc Trò Chơi';
                    document.getElementById('endGameButton').disabled = false;
                    
                    const message = isRestart ? 'Trò chơi đã bắt đầu lại! Tất cả người chơi đã nhận vai trò mới.' : 'Trò chơi đã bắt đầu! Tất cả người chơi đã nhận vai trò.';
                    alert(message);
                }, 1000); // Wait 1 second
            } catch (error) {
                console.error('Lỗi khi bắt đầu trò chơi:', error);
                alert('Đã xảy ra lỗi khi bắt đầu trò chơi!');
            }
        }
    );
}

// End game
async function endGame() {
    if (!currentGameCode) {
        alert('Vui lòng chọn một phòng trước!');
        return;
    }
    
    showConfirmModal(
        'Kết thúc trò chơi',
        'Bạn có chắc chắn muốn kết thúc trò chơi? Tất cả người chơi sẽ trở về màn hình chờ.',
        async function() {
            try {
                // Update game ended state
                await db.ref('games/' + currentGameCode).update({
                    gameStarted: false,
                    gameEnded: true,
                    endedAt: firebase.database.ServerValue.TIMESTAMP
                });
                
                // Wait 1 second before resetting roleRevealed state for all players
                setTimeout(async () => {
                    // Reset role revealed state for all players
                    const playersRef = db.ref('games/' + currentGameCode + '/players');
                    const playersSnapshot = await playersRef.once('value');
                    const players = playersSnapshot.val() || {};
                    
                    if (players) {
                        const updates = {};
                        Object.keys(players).forEach(playerName => {
                            updates[playerName + '/roleRevealed'] = false;
                            // Do not change alive/dead state here
                        });
                        
                        await playersRef.update(updates);
                    }
                    
                    // Update button content
                    document.getElementById('startGameButton').textContent = 'Bắt Đầu Lại';
                    document.getElementById('startGameButton').disabled = false;
                    document.getElementById('endGameButton').textContent = 'Trò chơi đã kết thúc';
                    document.getElementById('endGameButton').disabled = true;
                    
                    alert('Trò chơi đã kết thúc! Tất cả người chơi đã trở về màn hình chờ.');
                }, 1000);
                
            } catch (error) {
                console.error('Lỗi khi kết thúc trò chơi:', error);
                alert('Đã xảy ra lỗi khi kết thúc trò chơi!');
            }
        }
    );
}