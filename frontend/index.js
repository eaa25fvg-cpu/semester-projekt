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

    window.location.href = `/room/${roomId}`;
    
    console.log("User created:", data);
}


async function renderRoom(roomId) {
    const response = await fetch('/api/room/create-party', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomName: name, theme: theme })
    });
}


function userSuggestsAttribute (type, value) {
    
}

window.onload = function () {
    const parts = window.location.pathname.split('/');
    const roomId = parts[2]; // henter roomId fra URL'en

    const absoluteUrl = `${window.location.origin}/room/${roomId}/join-room`;

    document.getElementById('qr').innerHTML = qr.encodeQR(absoluteUrl, 'svg');
};

