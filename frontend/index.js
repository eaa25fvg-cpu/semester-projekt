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
        // Start/Opdater progress-knob
        updateProgressBar(data.player);
        songTime(data.player);


        document.getElementById("song-cover").src = s.cover_image;
        document.getElementById("song-title").textContent = s.song_name;
        document.getElementById("song-artist").textContent = s.artist;

        // Update queue
        renderQueue(data.player.songQueue)

        // Update active user elements
        updateActiveUsers(data.users)

        const totalUsers = data.users.length; 
        document.getElementById("active-user-count").textContent = `${totalUsers} ${totalUsers === 1 ? "lytter" : "lyttere"}`;

        const skipVotes = data.player.skipRequests ? data.player.skipRequests.length : 0;

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




function userSuggestsAttribute (type, value) {
    
}

window.onload = function () {
    const parts = window.location.pathname.split('/');
    const roomId = parts[2]; // henter roomId fra URL'en

    const absoluteUrl = `${window.location.origin}/room/${roomId}/join-room`;

    document.getElementById('qr').innerHTML = qr.encodeQR(absoluteUrl, 'svg');
};

function renderQueue(queue) {
    const parent = document.getElementById("queue-list");
    if (!parent) return;

    // Clear previous queue to avoid duplication
    parent.innerHTML = "";

    if (!Array.isArray(queue) || queue.length === 0) return;

    const html = queue
        .map((song, index) => {
            const isNowPlaying = index === 0;

            return `
                <div class="queue-item">
                    <div class="item-info">
                        <img class="queue-cover" src="${song.cover_image || ""}">
                        <div class="text-wrapper">
                            <p class="queue-title">${song.song_name}</p>
                            <p class="queue-artist">${song.artist}</p>
                        </div>
                    </div>

                    ${
                        isNowPlaying
                            ? `
                        <div class="play-status">
                            <i class="ph-fill ph-play"></i>
                            <p>Afspilles nu</p>
                        </div>`
                            : ""
                    }
                </div>
            `;
        })
        .join("");

    parent.innerHTML = html;
}

let progressAnimationId = null;

function updateProgressBar(player) {
    const knob = document.getElementById("progress-knob");
    const barFill = document.getElementById("progress-bar");

    if (!player || !player.currentSong) return;

    const startTime = player.startTime;        // ms
    const duration = player.currentSong.duration; // ms

    if (progressAnimationId) cancelAnimationFrame(progressAnimationId);

    function animate() {
        const now = Date.now();
        const elapsed = now - startTime; // ms
        const pct = Math.min((elapsed / duration) * 100, 100);

        knob.style.left = pct + "%";     // knob bevæger sig direkte
        barFill.style.width = pct + "%"; // linear transition påfyldning

        if (pct < 100) {
            progressAnimationId = requestAnimationFrame(animate);
        }
    }

    animate();
}

 function songTime(player) {
    const startEl = document.getElementById('song-start');
    const endEl = document.getElementById('song-end');

    const now = Date.now();
    const startTime = player.startTime; // ms fra server
    const duration = player.currentSong.duration; // ms

    // Hvor langt inde i sangen er vi i sekunder
    const elapsedSec = Math.floor((now - startTime) / 1000);

    // Sangens længde i sekunder
    const durationSec = Math.floor(duration / 1000);

    startEl.textContent = formatTime(elapsedSec);
    endEl.textContent = formatTime(durationSec);
}

function formatTime(sec) {
    const formatMin = Math.floor(sec / 60);
    const formatSec = sec % 60;
    return `${formatMin}:${formatSec.toString().padStart(2, '0')}`;
}

function updateActiveUsers(users) {
    // Opdatere Live Lyttertal
    document.getElementById("active-user-count").textContent = `${users.length} ${users.length === 1 ? "lytter" : "lyttere"}`; 

    const userList = document.getElementById("user-list");

    userList.innerHTML = "";

    // Loop (max 3 iterations)
    for (let i = 0; i < users.length && i < 3; i++) {
        const user = users[i];

        // Create elements
        const item = document.createElement("div");
        item.className = "user-item";

        const img = document.createElement("img");
        img.className = "user-img";
        img.src = user.profile_image;

        const textWrapper = document.createElement("div");
        textWrapper.className = "text-wrapper";

        const nameEl = document.createElement("p");
        nameEl.className = "user-name";
        nameEl.textContent = user.name;

        const roleEl = document.createElement("p");
        roleEl.className = "user-role";
        roleEl.textContent = "Lytter";

        // Build structure
        textWrapper.appendChild(nameEl);
        textWrapper.appendChild(roleEl);

        item.appendChild(img);
        item.appendChild(textWrapper);

        // Append to #user-list
        userList.appendChild(item);
    }
}

/*
{
type: 
name:
value: id
}
*/
async function addAttribute(roomId, attribute) {
    const userId = localStorage.getItem("userId");
    const response = await fetch(`/api/room/${roomId}/${userId}/select-attribute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({attribute: attribute})
    });
}
