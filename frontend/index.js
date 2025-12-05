document.getElementById("roomForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("room-name").value;
    const theme = document.getElementById("theme-select").value;
    createRoom(name, theme);
    console.log(name + theme);
  });

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
    const response = await fetch(`/api/${roomId}/createUser`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
            name: name,
            avatar: avatar
        })
    });

    const data = await response.json();
    console.log("User created:", data)
}

/*
export async function renderRoom(sessionId, sessionName) {
    
}
*/

function userSuggestsAttribute (type, value) {
    
}