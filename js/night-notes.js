// js/night-notes.js
// Load night notes
function loadNightNotes(gameData) {
    // Initialize nightNotes if doesn't exist
    if (!gameData.nightNotes) {
        // Create first night note
        db.ref('games/' + currentGameCode + '/nightNotes').set({
            night1: {
                content: '',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }
        });
        
        currentNightTab = 1;
        renderNightTabs(1);
        renderNightContent(1, '');
    } else {
        // Show existing notes
        const nightNotes = gameData.nightNotes;
        const nightNumbers = Object.keys(nightNotes)
            .map(key => parseInt(key.replace('night', '')))
            .sort((a, b) => a - b);
        
        // Default to last night
        currentNightTab = nightNumbers[nightNumbers.length - 1] || 1;
        
        renderNightTabs(nightNumbers.length);
        
        // Show current night content
        const currentNightKey = 'night' + currentNightTab;
        const currentNoteContent = nightNotes[currentNightKey] ? nightNotes[currentNightKey].content : '';
        renderNightContent(currentNightTab, currentNoteContent);
    }
}

// Render night tabs
function renderNightTabs(numNights) {
    const tabsContainer = document.getElementById('nightTabs');
    
    // Remove old tabs except add night button
    const addNightBtn = tabsContainer.querySelector('.add-night-btn');
    tabsContainer.innerHTML = '';
    
    // Add new tabs
    for (let i = 1; i <= numNights; i++) {
        const tab = document.createElement('button');
        tab.textContent = `Đêm ${i}`;
        tab.className = 'night-tab';
        tab.dataset.night = i;
        if (i === currentNightTab) {
            tab.classList.add('active');
        }
        
        tab.onclick = function() {
            switchNightTab(i);
        };
        
        tabsContainer.appendChild(tab);
    }
    
    // Add back the add night button
    tabsContainer.appendChild(addNightBtn || createAddNightButton());
}

// Create add night button
function createAddNightButton() {
    const btn = document.createElement('button');
    btn.className = 'add-night-btn';
    btn.textContent = '+ Thêm đêm';
    btn.onclick = addNewNight;
    return btn;
}

// Render night content
function renderNightContent(nightNum, content) {
    const nightsContent = document.getElementById('nightsContent');
    
    // Create interface for night content
    nightsContent.innerHTML = `
        <div class="night-content">
            <h3>Ghi chú Đêm ${nightNum}</h3>
            <textarea id="nightNote" placeholder="Ghi chú các hành động trong đêm...">${content}</textarea>
            <div class="note-actions">
                <button onclick="saveNightNote(${nightNum})">Lưu ghi chú</button>
            </div>
        </div>
    `;
}

// Switch between night tabs
function switchNightTab(nightNum) {
    // Update current tab
    currentNightTab = nightNum;
    
    // Update tab display
    const allTabs = document.querySelectorAll('.night-tab');
    allTabs.forEach(tab => {
        if (parseInt(tab.dataset.night) === nightNum) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Load note content for selected night
    db.ref('games/' + currentGameCode + '/nightNotes/night' + nightNum).once('value').then(snapshot => {
        const noteData = snapshot.val();
        renderNightContent(nightNum, noteData ? noteData.content : '');
    }).catch(error => {
        console.error('Lỗi khi tải ghi chú:', error);
        renderNightContent(nightNum, '');
    });
}

// Save night note
async function saveNightNote(nightNum) {
    const noteContent = document.getElementById('nightNote').value;
    
    try {
        await db.ref('games/' + currentGameCode + '/nightNotes/night' + nightNum).update({
            content: noteContent,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        alert(`Đã lưu ghi chú Đêm ${nightNum} thành công!`);
        
    } catch (error) {
        console.error('Lỗi khi lưu ghi chú:', error);
        alert('Lỗi khi lưu ghi chú. Vui lòng thử lại!');
    }
}

// Add new night
async function addNewNight() {
    try {
        // Read all current nights
        const snapshot = await db.ref('games/' + currentGameCode + '/nightNotes').once('value');
        const nightNotes = snapshot.val() || {};
        
        // Find highest night number
        const nightNumbers = Object.keys(nightNotes)
            .map(key => parseInt(key.replace('night', '')))
            .sort((a, b) => a - b);
        
        const newNightNum = (nightNumbers.length > 0 ? nightNumbers[nightNumbers.length - 1] : 0) + 1;
        
        // Add new night
        await db.ref('games/' + currentGameCode + '/nightNotes/night' + newNightNum).set({
            content: '',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Update UI
        currentNightTab = newNightNum;
        renderNightTabs(newNightNum);
        renderNightContent(newNightNum, '');
        
    } catch (error) {
        console.error('Lỗi khi thêm đêm mới:', error);
        alert('Lỗi khi thêm đêm mới. Vui lòng thử lại!');
    }
}