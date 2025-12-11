async function createRoom(name, theme) {
    try {
        const response = await fetch('/api/create-party', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roomName: name, theme: theme })
        });

        if (!response.ok) {
            throw new Error('Failed to create room');
        }

        const data = await response.json();
        const roomId = data.room_id;

        // Redirect to join-room page
        window.location.href = `/room/${roomId}/join-room`;
        
    } catch (error) {
        console.error('Error creating room:', error);
        alert('Error creating room!');
    }
}


async function createUser(name, avatar, roomId) {
    // Request to backend to create user
    const response = await fetch(`/api/room/${roomId}/createUser`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
            name: name,
            avatar: avatar
        })
    });

    const data = await response.json();

    localStorage.setItem("userId", data)

    window.location.href = `/room/${roomId}`;
    
    console.log("User created:", data);
}



function startRoomPolling(roomId, interval = 3000) {
    renderRoom(roomId)

    pollIntervalId = setInterval(() => {
        renderRoom(roomId); 
    }, interval)
}


async function renderRoom(roomId) {
    try {
        const userId = localStorage.getItem("userId");
        const response = await fetch(`/api/room/${roomId}/${userId}`);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        const data = await response.json();
        
        console.log("Data:", data);
        console.log("Users:", data.users);

        // Update room title
        document.getElementById("room-name").textContent = data.room.roomName;


        // Update current song
        let s = data.player.currentSong

        document.getElementById("song-cover").src = s.cover_image;
        document.getElementById("song-title").textContent = s.song_name;
        document.getElementById("song-artist").textContent = s.artist;

        // Update active users
        document.getElementById("active-user-count").textContent = `${data.users.length} ${data.users.length === 1 ? "lytter" : "lyttere"}`;

        const totalUsers = data.users.length; 
        document.getElementById("active-user-count").textContent = `${totalUsers} ${totalUsers === 1 ? "lytter" : "lyttere"}`;

        const skipVotes = data.room.skipRequests ? data.room.skipRequests.length : 0;
        document.getElementById("skip-count").textContent = `${skipVotes}/${totalUsers}`;

        const skipButton = document.getElementById("skipButton");
            if (skipButton && !skipButton.hasAttribute('data-listener')) {
            skipButton.setAttribute('data-listener', 'true');
            skipButton.onclick = handleSkip;
        }



    } catch (err) {
      console.error("Failed to load room:", err);
      return null;
    }
  }  

async function handleSkip() {
    const roomId = new URLSearchParams(window.location.search).get('room_id') || 
                   window.location.pathname.split('/')[2];
    const userId = localStorage.getItem("userId");
    
    if (!userId || !roomId) {
        console.error("Missing userId or roomId");
        return;
    }
    
    try {
        const response = await fetch(`/api/room/${roomId}/${userId}/skip-song`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Refresh hele rummet for at få opdateret data
            await renderRoom(roomId);
        }
    } catch (error) {
        console.error("Skip error:", error);
    }
}


async function skipToNextSong(roomId) {
    const room = roomState.get(roomId);
    
    if (!room) return;

    try {
        // Hvis der er sange i queue, tag den første
        if (room.songQueue && room.songQueue.length > 0) {
            room.currentSong = room.songQueue.shift();
        } else {
            // Ellers hent en ny random sang baseret på roomets theme
            const themeResult = await db.query(
                `SELECT room_theme FROM sessions WHERE sessions_id = $1`,
                [roomId]
            );
            
            if (themeResult.rows.length > 0) {
                const theme = themeResult.rows[0].room_theme;
                const newSong = await getRandomSong(theme);
                room.currentSong = newSong;
                
                // Opdater også databasen
                await db.query(
                    `UPDATE sessions SET current_song = $1 WHERE sessions_id = $2`,
                    [newSong.songs_id, roomId]
                );
            }
        }
        
        console.log(`Skipped to next song in room ${roomId}`);
    } catch (error) {
        console.error('Error in skipToNextSong:', error);
    }
}

function userSuggestsAttribute (type, value) {
    
}

window.onload = function () {
    const parts = window.location.pathname.split('/');
    const roomId = parts[2]; // henter roomId fra URL'en

    const absoluteUrl = `${window.location.origin}/room/${roomId}/join-room`;

    document.getElementById('qr').innerHTML = qr.encodeQR(absoluteUrl, 'svg');
};

