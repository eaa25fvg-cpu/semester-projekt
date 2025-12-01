import { upload } from 'pg-upload';
import { connect } from './connect.js';

console.log('Recreating database...');

const db = await connect();

console.log('Dropping tables...');
await db.query('drop table if exists tracks, sessions, session_users, user_activity, songs, genre, tempo, mood, activity, genres');
console.log('All tables dropped.');

console.log('Recreating tables...');
await db.query(`
    create table sessions (
        sessions_id int primary key generated always as identity,
	    room_name text not null,
	    current_song int not null,
	    created_at timestamp not null,
		updated_at timestamp not null
    )
`);

await db.query(`
	create table session_users(
		session_users_id int primary key generated always as identity,
		name text not null,
		session_id int references sessions(sessions_id),
		profile_image text not null
	)
`);

await db.query(`
	create table user_activity(
	user_activity_id int primary key generated always as identity,
	user_id int references session_users(session_users_id),
	genre text not null,
	tempo text not null,
	activity text not null,
	mood text not null
	)
`);


await db.query(`
	create table genre(
	genre_id int primary key generated always as identity,
	genre_name text not null
	)
`);

await db.query(`
	create table tempo(
	tempo_id int primary key generated always as identity,
	tempo_name text not null
	)
`);

await db.query(`
	create table activity(
	activity_id int primary key generated always as identity,
	activity_name text not null
	)
`);

await db.query(`
	create table mood(
	mood_id int primary key generated always as identity,
	mood_name text
	)
`);

await db.query(`
	create table songs(
	songs_id int primary key generated always as identity,
	song_name text not null,
	artist text not null,
	cover_image text not null,
	duration int not null,
	genre int not null references genre(genre_id),
	tempo int not null references tempo(tempo_id),
	activity int not null references activity(activity_id),
	mood int not null references mood(mood_id),
	release_year int not null
	)
`);

console.log('Tables recreated.');

console.log('Importing data from CSV files...');

await upload(db, 'db/genre.csv', `
	copy genre(genre_name)
	from stdin
	with csv header
	delimiter ';'
	`);

await upload(db, 'db/activity.csv', `
	copy activity(activity_name)
	from stdin
	with csv header
	delimiter ';'
	`);

await upload(db, 'db/mood.csv', `
	copy mood(mood_name)
	from stdin
	with csv header
	delimiter ';'
	`);

await upload(db, 'db/tempo.csv', `
	copy tempo(tempo_name)
	from stdin
	with csv header
	delimiter ';'
	`);

await upload(db, 'db/songs_final_ID_done.csv', `
	copy songs (song_name, artist, cover_image, duration, genre, tempo, activity, mood, release_year)
	from stdin
	with csv header
	delimiter ';'
	`);
	
console.log('Data imported.');

/*await upload(db, 'db/short-tracks.csv', `
	copy tracks (track_id, title, artist, duration)
	from stdin
	with csv header`);
console.log('Data imported.');
*/

await db.end();

console.log('Database recreated.');
