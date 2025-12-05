import express from 'express';
import path from 'path';
import { connect } from '../db/connect.js';
import { play } from './player.js';

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
// server.post('/api/:room_id/createUser', onCreateUser);
server.get('/api/theme', getAllTheme);
server.get('/api/genre', getAllGenre);
server.get('/api/tempo', getAllTempo);
server.get('/api/mood', getAllMood);
server.get('/api/songs', getAllSongs);
// server.get(/\/[a-zA-Z0-9-_/]+/, onFallback); // serve index.html on any other simple path
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

async function onFallback(request, response) {
    response.sendFile(path.join(import.meta.dirname, '..', 'frontend', 'index.html'));
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

/*
async function onCreateUser() {
    try{
        const roomId = request.params.room_id;
        const name = request.body.name;
        const avatar = request.body.avatar;

        await db.query(`
            INSERT INTO session_users (name, session_id profile_image)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [name, roomId, avatar]);

        res.status(201).send("User created");
            
    } catch (error) {
        console.error(error);
        response.status(500).json({error: "Database error"});
    }
};
*/

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
