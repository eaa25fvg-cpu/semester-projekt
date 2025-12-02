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
        window.location.href = `/${roomId}/join-room`;
        
    } catch (error) {
        console.error('Error creating room:', error);
        alert('Error creating room!');
    }
}

function createUser(name, avatar) {
    // Request to backend to create user
}

export async function renderRoom(sessionId, sessionName) {

}

function userSuggestsAttribute (type, value) {
    
}
