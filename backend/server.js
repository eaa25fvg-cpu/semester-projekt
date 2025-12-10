import express from 'express';
import path from 'path';
import { connect } from '../db/connect.js';
import { play } from './player.js';
import { get } from 'http';

const db = await connect();
/*
const tracks = await loadTracks();
const currentTracks = new Map(); // maps partyCode to index in tracks
*/
const port = process.env.PORT || 3003;
const server = express();

server.use(express.static('frontend'));
server.use(express.json());
server.use(onEachRequest);
server.post('/api/create-party', onCreateParty)
server.get('/api/party/:partyCode/currentTrack', onGetCurrentTrackAtParty);
server.post('/api/room/:room_id/createUser', onCreateUser);
server.get('/api/theme', getAllTheme);
server.get('/api/genre', getAllGenre);
server.get('/api/tempo', getAllTempo);
server.get('/api/mood', getAllMood);
server.get('/api/songs', getAllSongs);
server.get('/room/:room_id/join-room', redirectJoin);
server.get('/room/:room_id', renderRoom);
server.get('/api/next-song/simple/:sessionId', getRandomSongForSession);   
server.get('/api/next-song/user/:sessionId', getNextSongWithUserActivity);
server.listen(port, onServerReady);

async function onGetCurrentTrackAtParty(request, response) {
    const partyCode = request.params.partyCode;
    let trackIndex = currentTracks.get(partyCode);
    if (trackIndex === undefined) {
        trackIndex = pickNextTrackFor(partyCode);
    }
    const track = tracks[trackIndex];
    response.json(track);
}

function onEachRequest(request, response, next) {
    console.log(new Date(), request.method, request.url);
    next();
}

async function redirectJoin(request, response) {
    response.sendFile(path.join(import.meta.dirname, '..', 'frontend', 'join-room.html'));
}

async function renderRoom(request, response) {
    response.sendFile(path.join(import.meta.dirname, '..', 'frontend', 'room.html'));
    const roomId = request.params.room_id;
    await db.query (``)
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


async function onCreateUser(request, response) {
    try{
        const roomId = request.params.room_id;
        const name = request.body.name;
        const avatar = request.body.avatar;

        await db.query(`
            INSERT INTO session_users (name, session_id, profile_image)
            VALUES ($1, $2, $3)
            RETURNING name;
        `, [name, roomId, avatar]);

        response.json({message: "User created successfully"});
            
    } catch (error) {
        console.error(error);
        response.status(500).json({error: "Database error"});
    }
};


async function onCreateParty(request, response) {
    try {
        const roomName = request.body.roomName;
        const theme = request.body.theme;

        const dbResult = await db.query(
            `
            INSERT INTO sessions (room_name, room_theme)
            VALUES ($1, $2)
            RETURNING sessions_id;
            `,
            [roomName, theme]
        );

        const newRoomId = dbResult.rows[0].sessions_id;

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

async function getRandomSongForSession(request, response) {
    const sessionId = request.params.sessionId;

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
                so.release_year
            FROM sessions s
            JOIN theme th ON s.room_theme = th.theme_id
            JOIN songs so ON so.theme = th.theme_id
            JOIN genre g ON so.genre = g.genre_id
            JOIN tempo te ON so.tempo = te.tempo_id
            JOIN mood mo ON so.mood = mo.mood_id
            WHERE s.sessions_id = $1
            ORDER BY random()
            LIMIT 1;
            `,
            [sessionId]
        );

        if (result.rows.length === 0) {
            return response.status(404).json({ error: "Ingen sange med dette tema" });
        }

        return response.json(result.rows[0]);
    } catch (error) {
        console.error("Fejl i getRandomSongForSession:", error);
        return response.status(500).json({ error: "Serverfejl" });
    }
}


async function getNextSongWithUserActivity(request, response) {
    const sessionId = request.params.sessionId;

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

        return response.json(chosen);

    } catch (error) {
        console.error("Fejl i getNextSongWithUserActivity:", error);
        return response.status(500).json({ error: "Serverfejl" });
    }
}


