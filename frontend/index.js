function createRoom(name, activity) {
    // Create Room In DB by sending request to Backend
    // Redirect User to Create User Page
    window.location.href = '/join-room';
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

export async function renderRoom(sessionId, sessionName) {

}

function userSuggestsAttribute (type, value) {
    
}
