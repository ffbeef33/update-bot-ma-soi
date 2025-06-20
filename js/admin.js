// js/admin.js
// Load room list
async function loadRooms(isAdmin) {
    const roomsContainer = isAdmin ? 
        document.getElementById('adminRoomsList') : 
        document.getElementById('playerRoomsList');
    
    roomsContainer.innerHTML = '<p>Đang tải danh sách phòng...</p>';
    
    try {
        const gamesRef = db.ref('games');
        const snapshot = await gamesRef.once('value');
        
        if (!snapshot.exists()) {
            roomsContainer.innerHTML = '<p>Không có phòng nào.</p>';
            return;
        }
        
        let games = snapshot.val();
        let roomCount = 0;
        
        // Sort rooms by creation time (newest first)
        const sortedRooms = Object.entries(games)
            .sort(([,a], [,b]) => (b.createdAt || 0) - (a.createdAt || 0));
        
        roomsContainer.innerHTML = '';
        
        for (let [code, game] of sortedRooms) {
            roomCount++;
            let playerCount = game.playerCount || 0;
            let currentCount = game.players ? Object.keys(game.players).length : 0;
            let loggedCount = game.loggedPlayers ? Object.keys(game.loggedPlayers).length : 0;
            
            let roomItem = document.createElement('div');
            roomItem.className = 'room-item';
            
            // Add voting status if available
            let votingStatus = '';
            if (game.voting && game.voting.active) {
                votingStatus = ' <span style="color: var(--voting-color);">[Đang bỏ phiếu]</span>';
            }

            // Add game status info
            let gameStatus = '';
            if (game.gameEnded) {
                gameStatus = ' <span style="color: var(--danger-color);">[Đã kết thúc]</span>';
            } else if (game.gameStarted) {
                gameStatus = ' <span style="color: var(--primary-color);">[Đã bắt đầu]</span>';
            } else {
                gameStatus = ' <span style="color: var(--warning-color);">[Chờ bắt đầu]</span>';
            }
            
            let roomInfo = document.createElement('div');
            roomInfo.className = 'room-info';
            roomInfo.innerHTML = `
                <div>Phòng: <span class="room-code">${code}</span>${gameStatus}${votingStatus}</div>
                <div>Người chơi: ${currentCount}/${playerCount} (Đăng nhập: ${loggedCount})</div>
                <div>Tạo lúc: ${new Date(game.createdAt).toLocaleString()}</div>
            `;
            
            let roomActions = document.createElement('div');
            roomActions.className = 'room-actions';
            
            if (isAdmin) {
                // Actions for game master
                let viewButton = document.createElement('button');
                viewButton.innerText = 'Xem';
                viewButton.onclick = function() { viewRoles(code); };
                
                let deleteButton = document.createElement('button');
                deleteButton.innerText = 'Xóa';
                deleteButton.className = 'delete';
                deleteButton.onclick = function() { deleteRoom(code); };
                
                roomActions.appendChild(viewButton);
                roomActions.appendChild(deleteButton);
            }
            
            roomItem.appendChild(roomInfo);
            roomItem.appendChild(roomActions);
            roomsContainer.appendChild(roomItem);
        }
        
    } catch (error) {
        console.error('Lỗi khi tải danh sách phòng:', error);
        roomsContainer.innerHTML = '<p>Đã xảy ra lỗi khi tải danh sách phòng. Vui lòng thử lại.</p>';
    }
}

// View roles (game master)
function viewRoles(code) {
    let gameCode = code || document.getElementById('adminGameCode').value.toUpperCase();
    
    if (!gameCode) {
        alert('Vui lòng nhập hoặc chọn một phòng!');
        return;
    }
    
    currentGameCode = gameCode;
    document.getElementById('adminCurrentRoom').textContent = gameCode;
    document.getElementById('adminGameInfo').classList.remove('hidden');
    
    // Stop previous listener if exists
    if (playersListener) {
        playersListener.off();
    }
    
    // Start listening to changes in the room
    playersListener = db.ref('games/' + gameCode);
    playersListener.on('value', (snapshot) => {
        if (snapshot.exists()) {
            let gameData = snapshot.val();
            updateAdminView(gameData);
            loadNightNotes(gameData);
            loadVotingData(gameData);
        } else {
            alert('Phòng không tồn tại hoặc đã bị xóa!');
            document.getElementById('adminGameInfo').classList.add('hidden');
        }
    });
}

// Update admin UI
function updateAdminView(game) {
    let playerCount = game.playerCount || 0;
    let currentCount = game.players ? Object.keys(game.players).length : 0;
    let loggedPlayersCount = game.loggedPlayers ? Object.keys(game.loggedPlayers).length : 0;
    
    document.getElementById('adminCurrentPlayers').textContent = currentCount;
    document.getElementById('adminTotalPlayers').textContent = playerCount;
    document.getElementById('loggedPlayersCount').textContent = loggedPlayersCount;
    
    // Update button states
    const startGameButton = document.getElementById('startGameButton');
    const endGameButton = document.getElementById('endGameButton');
    const gameStarted = game.gameStarted || false;
    const gameEnded = game.gameEnded || false;
    
    if (gameStarted && !gameEnded) {
        // Game is in progress
        startGameButton.textContent = 'Trò chơi đã bắt đầu';
        startGameButton.disabled = true;
        endGameButton.textContent = 'Kết Thúc Trò Chơi';
        endGameButton.disabled = false;
    } else if (gameEnded) {
        // Game has ended
        startGameButton.textContent = 'Bắt Đầu Lại';
        startGameButton.disabled = false;
        endGameButton.textContent = 'Trò chơi đã kết thúc';
        endGameButton.disabled = true;
    } else {
        // Game has not started
        startGameButton.textContent = 'Bắt Đầu';
        startGameButton.disabled = false;
        endGameButton.textContent = 'Kết Thúc Trò Chơi';
        endGameButton.disabled = true;
    }
    
    // Change color based on ratio
    let statusBar = document.getElementById('adminStatus');
    if (currentCount == playerCount) {
        statusBar.className = 'status-bar full';
    } else if (currentCount == 0) {
        statusBar.className = 'status-bar empty';
    } else {
        statusBar.className = 'status-bar';
    }
    
    // Display roles in a table
    const tableContainer = document.getElementById('roleTableContainer');
    
    if (!game.players || Object.keys(game.players).length === 0) {
        tableContainer.innerHTML = '<p>Chưa có người chơi nào tham gia.</p>';
        return;
    }
    
    // Create HTML table
    let tableHTML = `
        <table class="role-table">
            <thead>
                <tr>
                    <th>Tên người chơi</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add player data
    Object.entries(game.players).forEach(([player, playerData]) => {
        // Get role and status info
        let role, status, roleRevealed;
        if (typeof playerData === 'object') {
            role = playerData.role || 'Không xác định';
            status = playerData.status || 'alive';
            roleRevealed = playerData.roleRevealed || false;
        } else {
            role = playerData;
            status = 'alive';
            roleRevealed = false;
        }
        
        // Check if player is logged in
        const isLoggedIn = game.loggedPlayers && game.loggedPlayers[player];
        
        // Determine CSS classes based on state
        // Sửa lỗi: Đảm bảo class "dead" được áp dụng đúng cách
        const rowClass = status === 'dead' ? 'dead' : '';
        const statusText = status === 'dead' ? 'Đã chết' : 'Còn sống';
        const statusClass = status === 'dead' ? 'dead-status' : '';
        
        // Add login status icon
        const loginStatus = isLoggedIn ? 
            '<span style="color: green; margin-left: 5px;">✓</span>' : 
            '<span style="color: red; margin-left: 5px;">✗</span>';
        
        tableHTML += `
            <tr class="${rowClass}">
                <td>${player} ${loginStatus}</td>
                <td>${role} ${!roleRevealed ? '<span style="color: orange;">(Chưa hiện)</span>' : ''}</td>
                <td>
                    <span class="player-status ${statusClass}">${statusText}</span>
                </td>
                <td>
                    <div class="player-actions">
                        ${status === 'alive' ? 
                            `<button class="icon delete" title="Đánh dấu đã chết" onclick="togglePlayerStatus('${player}', 'dead')">☠️</button>` : 
                            `<button class="icon" title="Đánh dấu còn sống" onclick="togglePlayerStatus('${player}', 'alive')">❤️</button>`
                        }
                        <button class="icon warning" title="Đuổi khỏi phòng" onclick="kickPlayer('${player}')">🚫</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    tableContainer.innerHTML = tableHTML;
}

// Mark player as dead/alive
async function togglePlayerStatus(playerName, newStatus) {
    if (!currentGameCode || !playerName) {
        alert('Không có thông tin người chơi!');
        return;
    }
    
    const action = newStatus === 'dead' ? 'đã chết' : 'còn sống';
    
    showConfirmModal(
        'Cập nhật trạng thái người chơi',
        `Bạn có chắc chắn muốn đánh dấu "${playerName}" là ${action}?`,
        async function() {
            try {
                const playerRef = db.ref(`games/${currentGameCode}/players/${playerName}`);
                const snapshot = await playerRef.once('value');
                
                if (!snapshot.exists()) {
                    alert('Không tìm thấy người chơi này!');
                    return;
                }
                
                const playerData = snapshot.val();
                
                // Update player status
                if (typeof playerData === 'object') {
                    // Already using new format, just update status
                    await playerRef.update({ status: newStatus });
                } else {
                    // Old format, update to new structure
                    await playerRef.set({
                        role: playerData,
                        status: newStatus
                    });
                }
                
                alert(`Đã cập nhật trạng thái của "${playerName}" thành ${action}.`);
                
            } catch (error) {
                console.error('Lỗi khi cập nhật trạng thái người chơi:', error);
                alert('Đã xảy ra lỗi khi cập nhật trạng thái người chơi!');
            }
        }
    );
}

// Kick player from room
async function kickPlayer(playerName) {
    if (!currentGameCode || !playerName) {
        alert('Không có thông tin người chơi!');
        return;
    }
    
    showConfirmModal(
        'Đuổi người chơi',
        `Bạn có chắc chắn muốn đuổi "${playerName}" khỏi phòng?`,
        async function() {
            try {
                // Remove player from players list
                await db.ref(`games/${currentGameCode}/players/${playerName}`).remove();
                
                // Remove player from logged in players list
                await db.ref(`games/${currentGameCode}/loggedPlayers/${playerName}`).remove();
                
                alert(`Đã đuổi "${playerName}" khỏi phòng thành công.`);
            } catch (error) {
                console.error('Lỗi khi đuổi người chơi:', error);
                alert('Đã xảy ra lỗi khi đuổi người chơi!');
            }
        }
    );
}

// Delete room
async function deleteRoom(code) {
    if (!code) {
        alert('Không có mã phòng!');
        return;
    }
    
    showConfirmModal(
        'Xóa phòng',
        `Bạn có chắc chắn muốn xóa phòng ${code}?`,
        async function() {
            try {
                // Delete room
                await db.ref('games/' + code).remove();
                
                if (code === currentGameCode) {
                    currentGameCode = '';
                    document.getElementById('adminGameInfo').classList.add('hidden');
                }
                
                loadRooms(true);
                alert('Đã xóa phòng thành công!');
            } catch (error) {
                console.error('Lỗi khi xóa phòng:', error);
                alert('Lỗi khi xóa phòng. Vui lòng thử lại!');
            }
        }
    );
}

// Delete current room
function deleteCurrentRoom() {
    if (currentGameCode) {
        deleteRoom(currentGameCode);
    } else {
        alert('Không có phòng nào được chọn!');
    }
}

// Load sheets data
async function fetchSheetsData() {
    try {
        document.getElementById('sheetsStatus').innerHTML = `
            <div class="loader"></div>
            <p>Đang tải dữ liệu từ Google Sheets...</p>
        `;
        
        // Load data from Google Sheets
        const response = await fetch(SHEET_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const csvData = await response.text();
        
        // Parse CSV using PapaParse
        const parsed = Papa.parse(csvData, { header: false });
        
        if (parsed.errors.length > 0) {
            throw new Error('Lỗi parse CSV: ' + parsed.errors[0].message);
        }
        
        // Filter valid data - starting from row 2 (index 1)
        const validData = [];
        
        for (let i = 1; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            
            // Ensure data exists in column A (password), column L (name) and column D (role)
            if (row[0] && row[11] && row[3]) {
                validData.push({
                    password: row[0],     // Column A - password
                    playerName: row[11],  // Column L - player name
                    role: row[3]          // Column D - role
                });
            }
        }
        
        sheetsData = validData;
        
        document.getElementById('sheetsStatus').innerHTML = `
            <p style="color: green;">✅ Dữ liệu đã được tải thành công!</p>
            <p>Số người chơi: ${sheetsData.length}</p>
            <p>Cập nhật lần cuối: ${new Date().toLocaleString()}</p>
        `;
        
        console.log('Sheet data loaded:', sheetsData);
        
        // Enable game creation button if there's data
        if (sheetsData.length > 0) {
            document.getElementById('createGameBtn').disabled = false;
        }
        
        return sheetsData;
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu từ Google Sheets:', error);
        document.getElementById('sheetsStatus').innerHTML = `
            <p style="color: red;">❌ Lỗi khi tải dữ liệu!</p>
            <p>${error.message}</p>
            <p>Vui lòng kiểm tra cấu hình và thử lại.</p>
        `;
        return [];
    }
}

// Refresh Google Sheets data
async function refreshSheetsData() {
    const data = await fetchSheetsData();
    if (data && data.length > 0) {
        alert(`Đã tải lại dữ liệu thành công! Số người chơi: ${data.length}`);
    }
}