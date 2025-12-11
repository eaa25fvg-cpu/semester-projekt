/*const players = new Map();

/*
players = {
currentSong = {}
songQueue = {}
startTime = ""
skipRequests = []
}
*/
 
async function playerHandler(roomId, action = "status") {
    const player = players.get(roomId);

    let startTime = player.startTime
    const duration = player.currentSong.duration
    let songQueue = player.songQueue
    let currentSong = player.currentSong
    let skipRequests = player.skipRequests
    let newSong = null

    if (action === "status") {

        if (Date.now() >= startTime + duration) {
            songQueue.splice(0,1)
            currentSong = songQueue[0]

            // Reset startTime & skip requests
            startTime = Date.now()
            skipRequests = []

            // Add new song to Queue
            newSong = await getSongByAttributes(roomId)
            songQueue.push(newSong)
        }
 

    } else if (action === "skip") {
        songQueue.splice(0,1)
        currentSong = songQueue[0]

        // Reset startTime & skip requests
        startTime = Date.now()
        skipRequests = []

        // Add new song to Queue
        newSong = await getSongByAttributes(roomId)
        songQueue.push(newSong)
    } else {
        return "Error"
    }

    player.startTime = startTime
    player.songQueue = songQueue
    player.currentSong = currentSong
    player.skipRequests = skipRequests

    players.set(roomId, player);
}