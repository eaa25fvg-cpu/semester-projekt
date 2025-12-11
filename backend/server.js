import express from 'express';
import path from 'path';
import { connect } from '../db/connect.js';
// import { play } from './player.js';
import { get } from 'http';

const db = await connect();
/*
const tracks = await loadTracks();
const currentTracks = new Map(); // maps partyCode to index in tracks
*/

// In-Memory States
const roomState = new Map();
const activeUsers = new Map();
const players = new Map();


/* 

** Room State Object **
{
roomName: ""
songQueue: [{songItem}]
currentSong: {songItem}
events: [{eventObject}]
}


** Song Item Object **

songName: ""
artist: ""
coverImage: ""
duration: ""
releaseYear: ""
genre: int
tempo: int
theme: int
mood: int
*/


const port = process.env.PORT || 3003;
const server = express();

server.use(express.static('frontend'));
server.use(express.json());
server.use(onEachRequest);
server.post('/api/create-party', onCreateParty)
server.post('/api/room/:room_id/:user_id/skip-song', onSkipSong)
server.post('/api/room/:room_id/createUser', onCreateUser);
server.get('/api/room/:room_id/:user_id', onGetRoom)
server.get('/api/theme', getAllTheme);
server.get('/api/genre', getAllGenre);
server.get('/api/tempo', getAllTempo);
server.get('/api/mood', getAllMood);
server.get('/api/songs', getAllSongs);
server.get('/room/:room_id/join-room', redirectJoin);
server.get('/room/:room_id', redirectRoom); 
// server.get('/api/next-song/user/:sessionId', getNextSongWithUserActivity);
server.listen(port, onServerReady);

function onEachRequest(request, response, next) {
    console.log(new Date(), request.method, request.url);
    next();
}

async function redirectJoin(request, response) {
    response.sendFile(path.join(import.meta.dirname, '..', 'frontend', 'join-room.html'));
}

async function redirectRoom(request, response) {
    response.sendFile(path.join(import.meta.dirname, '..', 'frontend', 'room.html'));
}


function onServerReady() {
    console.log('Webserver running on port', port);
}

async function loadTracks() {
    const dbResult = await db.query(`
        select track_id, title, artist, duration
        from   tracks
    `);
    return dbResult.rows;
}

function pickNextTrackFor(partyCode) {
    const trackIndex = Math.floor(Math.random() * tracks.length)
    currentTracks.set(partyCode, trackIndex);
    const track = tracks[trackIndex];
    play(partyCode, track.track_id, track.duration, Date.now(), () => currentTracks.delete(partyCode));
    return trackIndex;
}


async function onGetRoom(request, response) {
    try {
        const roomId = parseInt(request.params.room_id);
        const userId = parseInt(request.params.user_id);
        
        // Update user's heartbeat (mark as active)
        await updateUserHeartbeat(roomId, userId);
        
        // Get room state from memory
        const roomItem = roomState.get(roomId);
        
        if (!roomItem) {
            return response.status(404).json({ error: "Room not found" });
        }
        
        playerHandler(roomId, "status")
        const playerItem = players.get(roomId)

        // Get active users (automatically cleans up inactive ones)
        const currentUsers = getActiveUsersInRoom(roomId);
        
        response.json({
            room: roomItem,
            users: currentUsers,
            user_count: currentUsers.length,
            timestamp: Date.now(),
            player: playerItem
        });
        
    } catch (error) {
        console.error('Error in onGetRoom:', error);
        response.status(500).json({ error: "Server error" });
    }
}

async function onSkipSong(request, response) {
    try {
        const roomId = parseInt(request.params.room_id);
        const userId = parseInt(request.params.user_id);

        const room = roomState.get(roomId);
        
        if (!room) {
            return response.status(404).json({ error: "Room not found" });
        }

        // Initialiser skipRequests hvis det ikke findes
        if (!room.skipRequests) {
            room.skipRequests = [];
        }

        // Check om brugeren allerede har stemt
        const hasVoted = room.skipRequests.includes(userId);

        if (hasVoted) {
            // Fjern stemme
            room.skipRequests = room.skipRequests.filter(id => id !== userId);
        } else {
            // Tilføj stemme
            room.skipRequests.push(userId);
        }

        // Send tilbage
        response.json({
            success: true,
            skipVotes: room.skipRequests.length
        });
        
    } catch (error) {
        console.error('Error in onSkipSong:', error);
        response.status(500).json({ error: "Server error" });
    }
}

async function onCreateUser(request, response) {
    try{
        const roomId = request.params.room_id;
        const name = request.body.name;
        const avatar = request.body.avatar;

        const dbResult = await db.query(`
            INSERT INTO session_users (name, session_id, profile_image)
            VALUES ($1, $2, $3)
            RETURNING session_users_id;
        `, [name, roomId, avatar]);

        const userId = dbResult.rows[0].session_users_id

        response.json(userId);
            
    } catch (error) {
        console.error(error);
        response.status(500).json({error: "Database error"});
    }
};


async function onCreateParty(request, response) {
    try {
        const roomName = request.body.roomName;
        const theme = request.body.theme;
        let queue = []

        for (let index = 0; index < 3; index++) {
            const element = await getRandomSong(theme)
            queue.push(element)
        }
        const songObject = queue[0]

        const dbResult = await db.query(
            `
            INSERT INTO sessions (room_name, room_theme, current_song)
            VALUES ($1, $2, $3)
            RETURNING sessions_id;
            `,
            [roomName, theme, songObject.songs_id]
        );

        const newRoomId = dbResult.rows[0].sessions_id;

        const roomObject = createRoomObject(roomName, songObject)
        const playerObject = createPlayerObject(songObject, queue)

        roomState.set(newRoomId, roomObject)
        players.set(newRoomId, playerObject)

        response.json({ room_id: newRoomId });
    } catch (err) {
        console.error(err);
        response.status(500).json({ error: "Failed to create room" });
    }
}

async function getAllTheme(request, response) {
    const result = await db.query("SELECT * FROM theme");
    response.json(result.rows);
}

async function getAllGenre(request, response) {
    const result = await db.query("SELECT * FROM genre");
    response.json(result.rows);
}

async function getAllTempo(request, response) {
    const result = await db.query("SELECT * FROM tempo");
    response.json(result.rows);
}

async function getAllMood(request, response) {
    const result = await db.query("SELECT * FROM mood");
    response.json(result.rows);
}

async function getAllSongs(request, response) {
    try {
        const result = await db.query(`
            SELECT
                songs.songs_id,
                songs.song_name,
                songs.artist,
                songs.cover_image,
                songs.duration,
                genre.genre_name as genre,
                tempo.tempo_name as tempo,
                theme.theme_name as theme,
                mood.mood_name as mood,
                songs.release_year
            FROM songs
            JOIN genre ON songs.genre = genre.genre_id
            JOIN tempo ON songs.tempo = tempo.tempo_id
            JOIN theme ON songs.theme = theme.theme_id
            JOIN mood ON songs.mood = mood.mood_id

        `);
        response.json(result.rows);
    } catch (error) {
        console.error(error);
        response.status(500).json({error: "Database error"});
    }
}


function createRoomObject(roomName = "Et Rum", song = null) {
    return {
      roomName,
      songQueue: [],
      currentSong: song,
      skipRequests: []
    };
  }

  function createPlayerObject(currentSong, queue) {
    return {
        currentSong: currentSong,
        songQueue: queue,
        startTime: Date.now(),
        skipRequests: []
    }
  }
  
  async function getRandomSong(theme) {
    try {
        const result = await db.query(
            `
            SELECT
                so.songs_id,
                so.song_name,
                so.artist,
                so.cover_image,
                so.duration,
                g.genre_name,
                te.tempo_name,
                mo.mood_name,
                th.theme_name,
                th.theme_id,
                so.release_year
            FROM songs so
            JOIN theme th ON so.theme = th.theme_id
            JOIN genre g ON so.genre = g.genre_id
            JOIN tempo te ON so.tempo = te.tempo_id
            JOIN mood mo ON so.mood = mo.mood_id
            WHERE th.theme_id = $1
            ORDER BY random()
            LIMIT 1;
            `,
            [theme]
        );

        if (result.rows.length === 0) {
            return null; // No song found for this theme
        }

        return result.rows[0]; // Return the song data
    } catch (error) {
        console.error("Error in getRandomSong:", error);
        throw error; // Let the calling function handle the error
    }
}



async function getSongByAttributes(roomId) {
    const sessionId = roomId

    try {
        //
        // 1. Find sessionens tema
        //
        const sessionResult = await db.query(
            `SELECT room_theme FROM sessions WHERE sessions_id = $1`,
            [sessionId]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: "Session findes ikke" });
        }

        const roomTheme = sessionResult.rows[0].room_theme;


        //
        // 2. Hent alle sange som matcher temaet
        //
        const songsResult = await db.query(
            `
            SELECT
                so.songs_id,
                so.song_name,
                so.artist,
                g.genre_name,
                te.tempo_name,
                mo.mood_name
            FROM songs so
            JOIN genre g ON so.genre = g.genre_id
            JOIN tempo te ON so.tempo = te.tempo_id
            JOIN mood mo ON so.mood = mo.mood_id
            WHERE so.theme = $1;
            `,
            [roomTheme]
        );

        const songs = songsResult.rows;


        //
        // 3. Hent alle user_activity for brugerne i sessionen
        //
        const activityResult = await db.query(
            `
            SELECT ua.genre, ua.tempo, ua.mood
            FROM user_activity ua
            JOIN session_users su ON ua.user_id = su.session_users_id
            WHERE su.session_id = $1;
            `,
            [sessionId]
        );

        const activity = activityResult.rows;


        //
        // 4. Hvis ingen har valgt noget → fallback til random (som step 1)
        //
        if (activity.length === 0) {
            const randomSong = songs[Math.floor(Math.random() * songs.length)];
            return response.json(randomSong);
        }


        //
        // 5. Tæl stemmer fra user_activity
        //
        const votes = { genre: {}, tempo: {}, mood: {} };

        for (const act of activity) {
            if (act.genre) votes.genre[act.genre] = (votes.genre[act.genre] || 0) + 1;
            if (act.tempo) votes.tempo[act.tempo] = (votes.tempo[act.tempo] || 0) + 1;
            if (act.mood)  votes.mood[act.mood]  = (votes.mood[act.mood]  || 0) + 1;
        }


        //
        // 6. Beregn score for hver sang
        //
        let bestScore = -1;
        let bestSongs = [];

        for (const song of songs) {
            let score = 0;

            score += votes.genre[song.genre_name] || 0;
            score += votes.tempo[song.tempo_name] || 0;
            score += votes.mood[song.mood_name]   || 0;

            if (score > bestScore) {
                bestScore = score;
                bestSongs = [song];
            } else if (score === bestScore) {
                bestSongs.push(song);
            }
        }


        //
        // 7. Delvist random: vælg tilfældigt mellem topscorerne
        //
        const chosen = bestSongs[Math.floor(Math.random() * bestSongs.length)];

        return chosen;

    } catch (error) {
        console.error("Fejl i getNextSongWithUserActivity:", error);
        return response.status(500).json({ error: "Serverfejl" });
    }

}

// Active User Hearbeat Functions


// Get active users and clean up inactive ones
function getActiveUsersInRoom(roomId) {
    if (!activeUsers.has(roomId)) {
        return [];
    }
    
    const roomUsers = activeUsers.get(roomId);
    const now = Date.now();
    const activeUsersList = [];
    
    // Filter out inactive users and return active ones
    for (const [userId, userData] of roomUsers. entries()) {
        if (now - userData.lastSeen < 10000) {
            activeUsersList.push({
                session_users_id: userData.session_users_id,
                name: userData.name,
                profile_image: userData.profile_image,
                lastSeen: userData. lastSeen
            });
        } else {
            // Remove inactive user
            console.log(`User ${userId} timed out in room ${roomId}`);
            roomUsers.delete(userId);
        }
    }
    
    return activeUsersList;
}

// Update user's last seen timestamp (heartbeat)
async function updateUserHeartbeat(roomId, userId) {
    if (!activeUsers.has(roomId)) {
        activeUsers.set(roomId, new Map());
    }
    
    const roomUsers = activeUsers. get(roomId);
    
    if (!roomUsers.has(userId)) {
        // Fetch user details from database first time
        try {
            const userResult = await db.query(`
                SELECT session_users_id, name, profile_image
                FROM session_users
                WHERE session_users_id = $1 AND session_id = $2
            `, [userId, roomId]);
            
            if (userResult. rows.length > 0) {
                roomUsers.set(userId, {
                    session_users_id:  userResult.rows[0].session_users_id,
                    name: userResult.rows[0].name,
                    profile_image: userResult.rows[0].profile_image,
                    lastSeen: Date.now()
                });
                console.log(`User ${userId} joined room ${roomId}`);
            } else {
                console.warn(`User ${userId} not found in database for room ${roomId}`);
                return false;
            }
        } catch (error) {
            console. error('Error fetching user details:', error);
            return false;
        }
    } else {
        // Just update last seen timestamp
        const user = roomUsers.get(userId);
        user.lastSeen = Date.now();
    }
    
    return true;
}


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

async function getEvent(roomId) {
    
}

async function addEvent(roomId, userId, event) {
    const eventObject = {
        userId: userId,
        event: event,
        timestamp: Date.now()
    }
    roomState.get(roomId).events.push(eventObject)
}