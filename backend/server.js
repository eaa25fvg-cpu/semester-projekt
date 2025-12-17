import express from 'express';
import path from 'path';
import { connect } from '../db/connect.js';

const db = await connect();

// In-Memory States
const roomState = new Map();
const activeUsers = new Map();
const players = new Map();

const port = process.env.PORT || 3003;
const server = express();

server.use(express.static('frontend'));
server.use(express.json());
server.use(onEachRequest);
server.post('/api/create-party', onCreateParty)
server.post('/api/room/:room_id/:user_id/skip-song', onSkipSong)
server.post('/api/room/:room_id/createUser', onCreateUser);
server.post('/api/room/:room_id/:user_id/select-attribute', onSelectAttribute)
server.get('/api/room/:room_id/:user_id', onGetRoom)
server.get('/api/theme', getAllTheme);
server.get('/api/genre', getAllGenre);
server.get('/api/tempo', getAllTempo);
server.get('/api/mood', getAllMood);
server.get('/api/songs', getAllSongs);
server.get('/room/:room_id/join-room', redirectJoin);
server.get('/room/:room_id', redirectRoom);
server.post('/api/room/:room_id/:user_id/song_like', onLikeSong)
server.post('/api/room/:room_id/:user_id/song_dislike', onDislikeSong)  
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

async function onGetRoom(request, response) {
    try {
        const roomId = parseInt(request.params.room_id);
        const userId = parseInt(request.params.user_id);
        
        // Opdater brugers heartbeat (marker dem som aktiv)
        await updateUserHeartbeat(roomId, userId);
        
        // Få room state fra memory
        const roomItem = roomState.get(roomId);
        
        if (!roomItem) {
            return response.status(404).json({ error: "Room not found" });
        }
        
        playerHandler(roomId, "status")
        const playerItem = players.get(roomId)

        // Få aktive brugere (og fjern inaktive)
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

        // Hent player
        const player = players.get(roomId);
        if (!player) {
            return response.status(404).json({ error: "Player not found" });
        }

        // Sørg for skipRequests findes i player
        if (!player.skipRequests) player.skipRequests = [];

        // Hent aktive brugere
        const activeUsers = getActiveUsersInRoom(roomId);
        const userCount = activeUsers.length;

        if (userCount === 0) {
            return response.json({ success: false, error: "No active users" });
        }

        // Tjek om brugeren har stemt
        const hasVoted = player.skipRequests.includes(userId);

        // Toggle stemme direkte på player
        if (hasVoted) {
            player.skipRequests = player.skipRequests.filter(id => id !== userId);
        } else {
            player.skipRequests.push(userId);
        }

        addEvent(roomId, userId, "ønsker at skippe")

        // Antal stemmer
        const currentVotes = player.skipRequests.length;
        const votesNeeded = Math.ceil(userCount / 2);
        const shouldSkip = currentVotes >= votesNeeded;

        // --- SKIP PERFORMED ---
        if (shouldSkip) {

            // Skip sang gennem playerHandler
            await playerHandler(roomId, "skip");

            // Hent opdateret player
            const updatedPlayer = players.get(roomId);

            // Nulstil stemmer
            updatedPlayer.skipRequests = [];
            players.set(roomId, updatedPlayer);

            return response.json({
                success: true,
                skipped: true,
                skipVotes: 0,
                totalUsers: userCount,
                hasVoted: false,
                newSong: updatedPlayer.currentSong
            });
        }

        // --- IKKE NOK STEMMER ENNU ---
        players.set(roomId, player);

        return response.json({
            success: true,
            skipped: false,
            skipVotes: player.skipRequests.length,
            totalUsers: userCount,
            hasVoted: player.skipRequests.includes(userId)
        });

    } catch (error) {
        console.error("Error in onSkipSong:", error);
        response.status(500).json({ error: "Server error" });
    }
}

// Lav brugeren baseret på brugerinput
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

// Laver rummet
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

        const roomObject = createRoomObject(roomName)
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


function createRoomObject(roomName = "Et Rum") {
    return {
      roomName,
      events: []
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



// Add better error handling and fallback to getRandomSong:

async function getSongByAttributes(roomId) {
    const sessionId = roomId;

    try {
        // 1. Find sessionens tema
        const sessionResult = await db.query(
            `SELECT room_theme FROM sessions WHERE sessions_id = $1`,
            [sessionId]
        );

        if (sessionResult.rows.length === 0) {
            console. error("Session findes ikke:", sessionId);
            return null;
        }

        const roomTheme = sessionResult.rows[0].room_theme;

        // 2. Hent alle sange som matcher temaet
        const songsResult = await db.query(
            `
            SELECT
                so.songs_id,
                so.song_name,
                so.artist,
                so.cover_image,
                so.duration,
                so.release_year,
                g.genre_name,
                te.tempo_name,
                mo.mood_name,
                th.theme_name,
                th.theme_id
            FROM songs so
            JOIN genre g ON so.genre = g.genre_id
            JOIN tempo te ON so.tempo = te. tempo_id
            JOIN mood mo ON so.mood = mo.mood_id
            JOIN theme th ON so.theme = th.theme_id
            WHERE so.theme = $1;
            `,
            [roomTheme]
        );

        const songs = songsResult.rows;
        
        if (songs.length === 0) {
            console.error(`No songs found for theme ${roomTheme}`);
            return null;
        }

        // 3. Hent alle user_activity for brugerne i sessionen
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

        // 4. Hvis ingen har valgt noget → fallback til random
        if (activity.length === 0) {
            const randomSong = songs[Math.floor(Math.random() * songs.length)];
            console.log(`No user activity, returning random song: ${randomSong. song_name}`);
            return randomSong;
        }

        // 5. Tæl stemmer fra user_activity
        const votes = { genre: {}, tempo: {}, mood: {} };

        for (const act of activity) {
            if (act.genre) votes.genre[act.genre] = (votes.genre[act.genre] || 0) + 1;
            if (act.tempo) votes.tempo[act.tempo] = (votes.tempo[act.tempo] || 0) + 1;
            if (act.mood)  votes.mood[act.mood]  = (votes.mood[act.mood]  || 0) + 1;
        }

        // 6. Beregn score for hver sang
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
                bestSongs. push(song);
            }
        }

        // 7. Delvist random:  vælg tilfældigt mellem topscorerne
        const chosen = bestSongs[Math.floor(Math.random() * bestSongs.length)];
        console.log(`Selected song based on user activity: ${chosen.song_name}, score: ${bestScore}`);
        
        return chosen;

    } catch (error) {
        console.error("Fejl i getSongByAttributes:", error);
        // Fallback to getRandomSong
        try {
            const sessionResult = await db.query(
                `SELECT room_theme FROM sessions WHERE sessions_id = $1`,
                [sessionId]
            );
            if (sessionResult.rows.length > 0) {
                return await getRandomSong(sessionResult.rows[0].room_theme);
            }
        } catch (fallbackError) {
            console. error("Fallback also failed:", fallbackError);
        }
        return null;
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
    
    const roomUsers = activeUsers.get(roomId);
    
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

    if (!player) {
        console.error(`No player found for room ${roomId}`);
        return false;
    }

    let startTime = player.startTime;
    const duration = player.currentSong.duration;
    let songQueue = [... player.songQueue]; // Arbejd på en midlertidig kopi og gem først ændringerne til sidst
    let currentSong = player.currentSong;
    let skipRequests = player.skipRequests || [];
    let newSong = null;

    if (action === "status") {
        // Check om nuværende sang er færdig
        if (Date.now() >= startTime + duration) {
            console.log(`Song finished in room ${roomId}, moving to next song`);
            
            // Remove the current song from queue (it's the first one)
            songQueue.shift();
            
            // Få næste sang fra queue
            if (songQueue.length > 0) {
                currentSong = songQueue[0];
            } else {
                console.error(`Queue is empty for room ${roomId}`);
                // Fallback: get a random song
                const room = roomState.get(roomId);
                if (room && room.currentSong) {
                    newSong = await getSongByAttributes(roomId);
                    if (newSong) {
                        currentSong = newSong;
                        songQueue = [newSong];
                    }
                }
            }

            // Nulstil startTime og skip requests
            startTime = Date.now();
            skipRequests = [];

            // Tilføj ny sang i queue
            try {
                newSong = await getSongByAttributes(roomId);
                if (newSong) {
                    songQueue.push(newSong);
                    console.log(`Added new song to queue:  ${newSong.song_name}`);
                } else {
                    console.warn(`getSongByAttributes returned null for room ${roomId}`);
                }
            } catch (error) {
                console.error(`Error getting new song for room ${roomId}: `, error);
            }
        }

    } else if (action === "skip") {
        console.log(`Skipping song in room ${roomId}`);
        
        // Fjern nuværende sang fra queue
        songQueue.shift();
        
        // Få næste sang i queue
        if (songQueue.length > 0) {
            currentSong = songQueue[0];
        } else {
            console.error(`Queue is empty after skip for room ${roomId}`);
            return false;
        }

        // Nulstil startTime og skip requests
        startTime = Date.now();
        skipRequests = [];

        // Tilføj ny sang til queue
        try {
            newSong = await getSongByAttributes(roomId);
            if (newSong) {
                songQueue. push(newSong);
                console.log(`Added new song after skip: ${newSong.song_name}`);
            }
        } catch (error) {
            console.error(`Error getting new song after skip: `, error);
        }
    } else {
        console.error(`Unknown action: ${action}`);
        return false;
    }

    // Update player state
    player.startTime = startTime;
    player.songQueue = songQueue;
    player.currentSong = currentSong;
    player.skipRequests = skipRequests;

    players.set(roomId, player);
    
    console.log(`Player updated for room ${roomId}.  Current:  ${currentSong.song_name}, Queue length: ${songQueue.length}`);
    
    return true;
}

async function addEvent(roomId, userId, eventMessage) {
    const roomKey = parseInt(roomId);
    const userKey = parseInt(userId);

    let userName = 'Someone';
    let userAvatar = null;

    try {
        const roomUsers = activeUsers.get(roomKey);
        if (roomUsers && roomUsers.has(userKey)) {
            const u = roomUsers.get(userKey);
            userName = u.name || userName;
            userAvatar = u.profile_image || userAvatar;
        } else {
            // fallback: laver DB Lookup (Hvis ikke defineret i server-memory)
            try {
                const res = await db.query(
                    `SELECT name, profile_image FROM session_users WHERE session_users_id = $1`,
                    [userKey]
                );
                if (res.rows.length > 0) {
                    userName = res.rows[0].name || userName;
                    userAvatar = res.rows[0].profile_image || userAvatar;
                }
            } catch (dbErr) {
                console.warn("addEvent DB fallback failed:", dbErr);
            }
        }
    } catch (err) {
        console.error("addEvent lookup error:", err);
    }

    const event = `${userName} ${eventMessage || ''}`;

    const eventObject = {
        userId: userKey,
        userAvatar: userAvatar,
        event: event,
        timestamp: Date.now()
    };

    // Sikrer at rummet eksistere
    let room = roomState.get(roomKey);
    if (!room) {
        room = createRoomObject(`Room ${roomKey}`);
        roomState.set(roomKey, room);
    }
    if (!Array.isArray(room.events)) room.events = [];

    room.events.push(eventObject);
}


async function onSelectAttribute(request, response) {
    const roomId = request.params.room_id;
    const userId = request.params.user_id;
    const attribute = request.body.attribute || {};
    const type = attribute.type;
    const value = attribute.value;
    const name = attribute.name;

    if (!type || value === undefined) {
        return response.status(400).send({ error: "Missing attribute type or value" });
    }

    // Laver query til at indsætte det i DB
    const query = `
        INSERT INTO user_activity (user_id, session_id, ${type})
        VALUES ($1, $2, $3)
    `;

    try {
        await db.query(query, [userId, roomId, value]);
        await addEvent(roomId, userId, `har tilføjet mere ${name || ''}`);
        return response.status(200).send({ ok: true });
    } catch (err) {
        console.error("DB Error:", err);
        return response.status(500).send({ error: "Database error" });
    }
}


function onLikeSong(request, response) {
    const roomId = request.params.room_id;
    const userId = request.params.user_id;

    addEvent(roomId, userId, "har liket sangen")

    response.sendStatus(200);
}

function onDislikeSong(request, response) {
    const roomId = request.params.room_id;
    const userId = request.params.user_id;

    addEvent(roomId, userId, "har disliket sangen")

    response.sendStatus(200);
}