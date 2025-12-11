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


    } catch (err) {
      console.error("Failed to load room:", err);
      return null;
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
