// js/voting.js
// Load voting data for game master
function loadVotingData(gameData) {
    const votingData = gameData.voting || {
        active: false,
        endTime: 0,
        duration: 60,
        votes: {}
    };
    
    // Update display status
    const votingStatus = document.getElementById('votingStatus');
    const startVotingBtn = document.getElementById('startVotingBtn');
    const endVotingBtn = document.getElementById('endVotingBtn');
    const votingTimer = document.getElementById('votingTimer');
    const votingResults = document.getElementById('votingResults');
    
    // If a voting session is active
    if (votingData.active) {
        votingStatus.textContent = 'Đang diễn ra phiên bỏ phiếu';
        votingStatus.className = 'voting-status active';
        
        startVotingBtn.classList.add('hidden');
        endVotingBtn.classList.remove('hidden');
        votingTimer.classList.remove('hidden');
        
        // Update countdown timer
        updateCountdown(votingData.endTime);
        
    } else {
        votingStatus.textContent = 'Không có phiên bỏ phiếu nào đang diễn ra';
        votingStatus.className = 'voting-status inactive';
        
        startVotingBtn.classList.remove('hidden');
        endVotingBtn.classList.add('hidden');
        votingTimer.classList.add('hidden');
        
        // Cancel countdown if any
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        
        // Show voting results if any
        if (votingData.votes && Object.keys(votingData.votes).length > 0) {
            displayVotingResults(votingData.votes, gameData.players);
        } else {
            votingResults.classList.add('hidden');
        }
    }
    
    // Update voting duration
    document.getElementById('votingDuration').value = votingData.duration || 60;
}

// Start new voting session
async function startVoting() {
    if (!currentGameCode) {
        alert('Vui lòng chọn một phòng trước!');
        return;
    }
    
    // Check player count
    const snapshot = await db.ref('games/' + currentGameCode + '/players').once('value');
    if (!snapshot.exists() || Object.keys(snapshot.val()).length < 2) {
        alert('Cần ít nhất 2 người chơi để bắt đầu bỏ phiếu!');
        return;
    }
    
    // Get duration from input field
    const duration = parseInt(document.getElementById('votingDuration').value) || 60;
    if (isNaN(duration) || duration < 10 || duration > 300) {
        alert('Thời gian bỏ phiếu phải từ 10 đến 300 giây!');
        return;
    }
    
    // Calculate end time
    const now = Date.now();
    const endTime = now + (duration * 1000);
    
    // Update voting data in Firebase
    try {
        await db.ref('games/' + currentGameCode + '/voting').update({
            active: true,
            startTime: now,
            endTime: endTime,
            duration: duration,
            votes: {} // Clear previous votes if any
        });
        
        // Update UI
        document.getElementById('votingStatus').textContent = 'Đang diễn ra phiên bỏ phiếu';
        document.getElementById('votingStatus').className = 'voting-status active';
        document.getElementById('startVotingBtn').classList.add('hidden');
        document.getElementById('endVotingBtn').classList.remove('hidden');
        document.getElementById('votingTimer').classList.remove('hidden');
        document.getElementById('votingResults').classList.add('hidden');
        
        // Start countdown
        updateCountdown(endTime);
        
        // Auto end voting when time is up
        setTimeout(() => {
            if (currentGameCode) {
                db.ref('games/' + currentGameCode + '/voting/active').once('value', (snapshot) => {
                    if (snapshot.exists() && snapshot.val() === true) {
                        endVoting();
                    }
                });
            }
        }, duration * 1000 + 1000); // Add 1 second buffer
        
    } catch (error) {
        console.error('Lỗi khi bắt đầu phiên bỏ phiếu:', error);
        alert('Đã xảy ra lỗi khi bắt đầu phiên bỏ phiếu!');
    }
}

// End current voting session
async function endVoting() {
    if (!currentGameCode) {
        alert('Không có phòng nào được chọn!');
        return;
    }
    
    try {
        // Update voting status
        await db.ref('games/' + currentGameCode + '/voting').update({
            active: false,
            endTime: Date.now()
        });
        
        // Update UI
        document.getElementById('votingStatus').textContent = 'Phiên bỏ phiếu đã kết thúc';
        document.getElementById('votingStatus').className = 'voting-status completed';
        document.getElementById('startVotingBtn').classList.remove('hidden');
        document.getElementById('endVotingBtn').classList.add('hidden');
        document.getElementById('votingTimer').classList.add('hidden');
        
        // Cancel countdown if any
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        
        // Get player and vote info
        const playersSnapshot = await db.ref('games/' + currentGameCode + '/players').once('value');
        const votesSnapshot = await db.ref('games/' + currentGameCode + '/voting/votes').once('value');
        
        const players = playersSnapshot.val() || {};
        const votes = votesSnapshot.val() || {};
        
        // Display voting results
        displayVotingResults(votes, players);
        
    } catch (error) {
        console.error('Lỗi khi kết thúc phiên bỏ phiếu:', error);
        alert('Đã xảy ra lỗi khi kết thúc phiên bỏ phiếu!');
    }
}

// Display voting results
function displayVotingResults(votes, players) {
    const resultsContainer = document.getElementById('votingResults');
    const resultsList = document.getElementById('votingResultsList');
    
    // Count votes for each player
    const voteCounts = {};
    let totalVotes = 0;
    let skippedVotes = 0;
    
    // Initialize vote count for all living players as 0
    Object.entries(players).forEach(([playerName, playerData]) => {
        // Only count living players
        const status = typeof playerData === 'object' ? (playerData.status || 'alive') : 'alive';
        if (status !== 'dead') {
            voteCounts[playerName] = 0;
        }
    });
    
    // Add skip option
    voteCounts[SKIP_VOTE] = 0;
    
    // Count votes and living players
    let alivePlayers = 0;
    Object.entries(players).forEach(([playerName, playerData]) => {
        const status = typeof playerData === 'object' ? (playerData.status || 'alive') : 'alive';
        if (status !== 'dead') {
            alivePlayers++;
        }
    });
    
    // Calculate not voted count
    let hasVoted = new Set(Object.keys(votes));
    let notVotedCount = 0;
    
    // Count living players who didn't vote
    Object.entries(players).forEach(([playerName, playerData]) => {
        const status = typeof playerData === 'object' ? (playerData.status || 'alive') : 'alive';
        if (status !== 'dead' && !hasVoted.has(playerName)) {
            notVotedCount++;
        }
    });
    
    // Count votes
    Object.entries(votes).forEach(([voter, votedFor]) => {
        if (votedFor === SKIP_VOTE) {
            voteCounts[SKIP_VOTE]++;
            skippedVotes++;
            totalVotes++;
        } else if (voteCounts.hasOwnProperty(votedFor)) {
            voteCounts[votedFor]++;
            totalVotes++;
        }
    });
    
    // Sort players by vote count (highest to lowest), excluding SKIP_VOTE
    const sortedPlayers = Object.keys(voteCounts)
        .filter(name => name !== SKIP_VOTE)
        .sort((a, b) => voteCounts[b] - voteCounts[a]);
    
    // Find player(s) with highest vote count (not counting SKIP_VOTE)
    let highestVotes = 0;
    let winners = [];
    
    sortedPlayers.forEach(player => {
        const votes = voteCounts[player];
        if (votes > 0 && votes > highestVotes) {
            highestVotes = votes;
            winners = [player];
        } else if (votes > 0 && votes === highestVotes) {
            winners.push(player);
        }
    });
    
    // Show results
    resultsContainer.classList.remove('hidden');
    resultsList.innerHTML = '';
    
    // Show skipped votes total
    resultsList.innerHTML = `
        <div class="voting-result-item" style="background-color: #f5f5f5;">
            <span>Bỏ qua (đã chọn bỏ qua):</span>
            <span>${skippedVotes} phiếu</span>
        </div>
        <div class="voting-result-item" style="background-color: #f5f5f5;">
            <span>Không bỏ phiếu:</span>
            <span>${notVotedCount} người</span>
        </div>
    `;
    
    // Show each player's result (not showing SKIP_VOTE)
    sortedPlayers.forEach(player => {
        if (voteCounts[player] > 0) {
            const resultItem = document.createElement('div');
            resultItem.className = 'voting-result-item';
            
            // Mark winner
            if (winners.includes(player)) {
                resultItem.classList.add('voting-result-winner');
            }
            
            resultItem.innerHTML = `
                <span>${player}</span>
                <span>${voteCounts[player]} phiếu</span>
            `;
            resultsList.appendChild(resultItem);
        }
    });
    
    // Show conclusion
    let conclusion = document.createElement('p');
    conclusion.style.marginTop = '15px';
    conclusion.style.fontWeight = 'bold';
    
    if (winners.length === 0) {
        conclusion.textContent = 'Không có ai bị loại.';
    } else if (winners.length === 1) {
        conclusion.textContent = `${winners[0]} bị loại với ${highestVotes} phiếu.`;
    } else {
        conclusion.textContent = `Có ${winners.length} người cùng có số phiếu cao nhất (${highestVotes}): ${winners.join(', ')}.`;
    }
    
    resultsList.appendChild(conclusion);
    
    // Add mark dead buttons
    if (winners.length > 0) {
        const markDeadSection = document.createElement('div');
        markDeadSection.style.marginTop = '20px';
        markDeadSection.style.borderTop = '1px solid #ddd';
        markDeadSection.style.paddingTop = '15px';
        
        const heading = document.createElement('h3');
        heading.textContent = 'Đánh dấu người chơi đã chết';
        
        markDeadSection.appendChild(heading);
        
        winners.forEach(player => {
            const markButton = document.createElement('button');
            markButton.className = 'delete';
            markButton.style.marginTop = '10px';
            markButton.textContent = `Đánh dấu "${player}" đã chết`;
            markButton.onclick = function() {
                togglePlayerStatus(player, 'dead');
            };
            markDeadSection.appendChild(markButton);
        });
        
        resultsList.appendChild(markDeadSection);
    }
}

// Update countdown timer
function updateCountdown(endTime) {
    // Cancel previous interval if any
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    // Function to update time remaining display
    function updateTimer() {
        const now = Date.now();
        const timeLeft = Math.max(0, endTime - now);
        
        if (timeLeft <= 0) {
            // Time is up
            document.getElementById('countdown').textContent = '00:00';
            if (!isGameMaster) {
                document.getElementById('playerCountdown').textContent = '00:00';
            }
            
            clearInterval(countdownInterval);
            return;
        }
        
        // Format time as mm:ss
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        const formattedTime = 
            (minutes < 10 ? '0' : '') + minutes + ':' + 
            (seconds < 10 ? '0' : '') + seconds;
        
        // Update display
        document.getElementById('countdown').textContent = formattedTime;
        if (!isGameMaster) {
            document.getElementById('playerCountdown').textContent = formattedTime;
        }
    }
    
    // Update immediately
    updateTimer();
    
    // Update every second
    countdownInterval = setInterval(updateTimer, 1000);
}

// Listen for voting session (player)
function listenToVotingSession(gameCode) {
    if (!gameCode || !playerName) return;
    
    // Stop previous listener if any
    if (votingListener) {
        votingListener.off();
    }
    
    // Listen for voting state changes
    votingListener = db.ref('games/' + gameCode + '/voting');
    votingListener.on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        
        const votingData = snapshot.val();
        const votingStatus = document.getElementById('playerVotingStatus');
        const votingTimer = document.getElementById('playerVotingTimer');
        const votingOptions = document.getElementById('playerVotingOptions');
        const voteConfirmation = document.getElementById('playerVoteConfirmation');
        
        // If voting is active and player is alive
        if (votingData.active && !playerIsDead) {
            // Update status
            votingStatus.textContent = 'Phiên bỏ phiếu đang diễn ra!';
            votingStatus.className = 'voting-status active';
            votingTimer.classList.remove('hidden');
            
            // Update countdown
            updateCountdown(votingData.endTime);
            
            // Load player list for voting
            loadVotingOptions(gameCode, votingData.votes || {});
            
        } else if (votingData.active && playerIsDead) {
            // Player is dead but voting is active
            votingStatus.textContent = 'Bạn không thể bỏ phiếu vì đã bị loại khỏi trò chơi';
            votingStatus.className = 'voting-status inactive';
            votingTimer.classList.add('hidden');
            votingOptions.innerHTML = '';
            voteConfirmation.classList.add('hidden');
            
        } else {
            // Voting has ended or hasn't started
            votingStatus.textContent = 'Hiện không có phiên bỏ phiếu nào đang diễn ra';
            votingStatus.className = 'voting-status inactive';
            votingTimer.classList.add('hidden');
            votingOptions.innerHTML = '';
            voteConfirmation.classList.add('hidden');
            
            // Cancel countdown if any
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
        }
    });
}

// Load voting options for player
async function loadVotingOptions(gameCode, currentVotes) {
    if (!gameCode || !playerName || playerIsDead) return;
    
    try {
        // Get player list
        const snapshot = await db.ref('games/' + gameCode + '/players').once('value');
        if (!snapshot.exists()) return;
        
        const allPlayers = snapshot.val();
        const votingOptions = document.getElementById('playerVotingOptions');
        votingOptions.innerHTML = '';
        
        // Check if current player has already voted
        const myVote = currentVotes[playerName];
        
        // If already voted, show confirmation
        if (myVote) {
            document.getElementById('playerVoteChoice').textContent = myVote === SKIP_VOTE ? 'Bỏ qua' : myVote;
            document.getElementById('playerVoteConfirmation').classList.remove('hidden');
        } else {
            document.getElementById('playerVoteConfirmation').classList.add('hidden');
        }
        
        // Add skip option
        const skipOption = document.createElement('div');
        skipOption.className = 'vote-option skip-option';
        if (myVote === SKIP_VOTE) {
            skipOption.classList.add('selected');
        }
        skipOption.innerHTML = `<span>⊘ Bỏ qua</span>`;
        skipOption.onclick = function() {
            submitVote(gameCode, SKIP_VOTE);
        };
        votingOptions.appendChild(skipOption);
        
        // Create list of living players to vote for (excluding self)
        Object.entries(allPlayers).forEach(([name, playerData]) => {
            // Determine player status
            let status = 'alive';
            if (typeof playerData === 'object' && playerData.status) {
                status = playerData.status;
            }
            
            // Only show living players and not self
            if (name !== playerName && status !== 'dead') {
                const option = document.createElement('div');
                option.className = 'vote-option';
                
                // Mark selected option
                if (name === myVote) {
                    option.classList.add('selected');
                }
                
                option.innerHTML = `<span>${name}</span>`;
                option.onclick = function() {
                    submitVote(gameCode, name);
                };
                
                votingOptions.appendChild(option);
            }
        });
        
        // Show message if no one to vote for except skip
        if (votingOptions.children.length === 1) {
            const message = document.createElement('p');
            message.style.margin = '15px 0';
            message.textContent = 'Không có người chơi nào để bỏ phiếu.';
            votingOptions.appendChild(message);
        }
        
    } catch (error) {
        console.error('Lỗi khi tải lựa chọn bỏ phiếu:', error);
    }
}

// Submit vote
async function submitVote(gameCode, votedFor) {
    if (!gameCode || !playerName || playerIsDead) return;
    
    try {
        // Check if voting session is still active
        const snapshot = await db.ref('games/' + gameCode + '/voting/active').once('value');
        if (!snapshot.exists() || snapshot.val() !== true) {
            alert('Phiên bỏ phiếu đã kết thúc!');
            return;
        }
        
        // Update vote in database
        await db.ref('games/' + gameCode + '/voting/votes/' + playerName).set(votedFor);
        
        // Update UI
        document.getElementById('playerVoteChoice').textContent = votedFor === SKIP_VOTE ? 'Bỏ qua' : votedFor;
        document.getElementById('playerVoteConfirmation').classList.remove('hidden');
        
        // Update option selection state
        const options = document.querySelectorAll('.vote-option');
        options.forEach(option => {
            const isSkipOption = option.classList.contains('skip-option');
            
            if (isSkipOption && votedFor === SKIP_VOTE) {
                option.classList.add('selected');
            } else if (!isSkipOption) {
                const name = option.querySelector('span').textContent;
                if (name === votedFor) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            } else if (isSkipOption && votedFor !== SKIP_VOTE) {
                option.classList.remove('selected');
            }
        });
        
    } catch (error) {
        console.error('Lỗi khi bỏ phiếu:', error);
        alert('Đã xảy ra lỗi khi bỏ phiếu. Vui lòng thử lại!');
    }
}