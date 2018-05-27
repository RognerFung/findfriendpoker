var express = require('express');
var app = express();
var path = require('path');
var server = require('http').Server(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var session = require('express-session');
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var hbs = require('hbs');
var util = require('./public/javascripts/util');
var Users = {};
var Rooms = {};

app.use(session({
    secret: 'gaflkjhlfdahfoiguhdiofghdf',
    resave: true,
    saveUninitialized: true
}));
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/library', express.static(path.join(__dirname, 'node_modules')));

app.set('view engine', 'html');
app.engine('html', hbs.__express);

app.get('/', function (req, res) {
	res.render('game');
});

io.on('connection', function(socket) {
	console.log('A user connected, id: ' + socket.id);
    //user disconnected, delete Players, Levels, Users info related to that user
    //in case the remain Players, Levels data contaminate the new ones
	socket.on('disconnect', function() {
        console.log('A user disconnected, id: ' + socket.id);
        if (Users[socket.id] !== undefined) {
            delete Rooms[Users[socket.id].room]['Players'][Users[socket.id].seat];
            delete Rooms[Users[socket.id].room]['Levels'][Users[socket.id].seat];
        }
        delete Users[socket.id];
	});
    //when user login with a username, save this user to a Users[socket.id] object
    //also create room and seat properties for this Users[socket.id] object for further usage
    //send Users info to all user, for updating seat situation, exclude the users who haven't sit down yet
	socket.on('login', function(data) {
		console.log('A user login, name: ' + data.username);
		Users[socket.id] = {};
		Users[socket.id].name = data.username;
		Users[socket.id].room = null;
		Users[socket.id].seat = null;
		util.update_state(Users, io);
	});
    //seat situation has changed (a user has sit down or left seat), save the name, room, seat info into the corresponding Users[socket.id] object
    //update the latest state of seat and name to all users online
    socket.on('new state', function(data){
		Object.keys(Users).forEach(function(v) {
			if (v === socket.id) {
				Users[v].name = data.name;
				Users[v].room = data.room;
				Users[v].seat = data.seat;
			}
		});
		util.update_state(Users, io);
	});
    //when a table's five seat is all taken, server receive a 'table full' signal
    //five users sit around this table, their sockets join into this room
    //if new, create a Rooms[roomId] object to save the Game, Players, Levels info; if not new, save data into existing Rooms[roomId]
    //save user name, seat, level info into Players and Levels properties;
    //Game property has playercards, master, chair, side prolerties
    //playercards is random generated cards deal to each user, only generate once in one game, make sure all the users are on the same game
    //emit each user's playcards seperately to each user, make sure they cannot see each other's cards
    //7 left cards called hidden cards are emited to the chair player
    //when 5 users data all saved into Rooms[roomId] object, emit the userinfo to all users, include chair, name, seat, level
	socket.on('table full', function(data) {
		socket.join(data.room);
		if (Rooms[data.room] === undefined) {
			Rooms[data.room] = util.create_room(data.room);
			Rooms[data.room]['Players'][data.seat] = data.name;
			Rooms[data.room]['Levels'] = {'1': '2', '2': '2', '3': '2', '4': '2', '5': '2'};
		} else {
			Rooms[data.room]['Players'][data.seat] = data.name;
		}
		if (Rooms[data.room]['Game']['playercards'] === undefined) {
			Rooms[data.room]['Game']['playercards'] = util.deal_card();
			Rooms[data.room]['Game']['master']['suit'] = ['D','C','H','S',false][Math.floor(Math.random() * 5)];
			Rooms[data.room]['Game']['master']['value'] = '2';
			Rooms[data.room]['Game']['chair']['seat'] = ['1','2','3','4','5'][Math.floor(Math.random() * 5)];
			Rooms[data.room]['Game']['side']['minority'].push(Rooms[data.room]['Game']['chair']['seat']);
		}
		if (data.room === Rooms[data.room]['ID'] && data.seat === Rooms[data.room]['Game']['chair']['seat']) {
			io.to(socket.id).emit('deals', {
				playercards: Rooms[data.room]['Game']['playercards'][data.seat].concat(Rooms[data.room]['Game']['playercards'][0]),
				master: Rooms[data.room]['Game']['master'],
				chair: Rooms[data.room]['Game']['chair'],
				side: Rooms[data.room]['Game']['side']
			});
		} else if (data.room === Rooms[data.room]['ID']) {
			io.to(socket.id).emit('deals', {
				playercards: Rooms[data.room]['Game']['playercards'][data.seat],
				master: Rooms[data.room]['Game']['master'],
				chair: Rooms[data.room]['Game']['chair'],
				side: Rooms[data.room]['Game']['side']
			});
        }
		if (Object.keys(Rooms[data.room]['Players']).length === 5) {
			Rooms[data.room]['Game']['chair']['name'] = Rooms[data.room]['Players'][Rooms[data.room]['Game']['chair']['seat']];
			util.update_userinfo(Rooms[data.room], io);
		}
	});
	//receive 'chair ready' signal from chair, emit bottom cards to chair
	socket.on('chair ready', function(data) {
		io.to(socket.id).emit('bottom cards', {
			topCards: Rooms[data.room]['Game']['playercards'][Rooms[data.room]['Game']['chair']['seat']],
			bottomCards: Rooms[data.room]['Game']['playercards'][0]
		});	
	});
    //receive 'chair finished' signal from chair, save hidden card data into ['Game']['hiddens']
    //emit 'pick info' to users in this room, tell them which ally card chair has picked
    //emit 'turn' to users in this room, tell them it's the chair's turn to play
	socket.on('chair finished', function(data) {
		Rooms[data.room]['Game']['hiddens'] = data.hiddens;
		io.to(data.room).emit('pick info', {
			pick: data.pick
		});
		io.to(data.room).emit('turn', {
			turn: Rooms[data.room]['Game']['chair']['seat']
		});
		console.log(Rooms[data.room]);
	});
    //receive 'next' signal, telling server it's next player's turn, server emit 'turn' to the next player
	socket.on('next', function(data) {
		var nextseat = parseInt(data.seat) + 1;
		if (nextseat > 5) {
			nextseat = nextseat % 5;
		}
		nextseat = nextseat.toString();
		io.to(data.room).emit('turn', {
			turn: nextseat
		});
	});
    //receive 'play' signal, telling server it's a regular play, judge shows the play is winning or not
    //emit 'play coming' to all players in the room
	socket.on('play', function(data) {
		console.log('here is a play ' + data.play);
		io.to(data.room).emit('play coming', {
			play: data.play,
			judge: data.judge,
			seat: data.seat,
			name: data.name
		});
	});
    //receive 'testdump' signal, telling server to validate first, 
    //emit 'validate dump' to every user in the room except the one who played the testdump
    //the socket.id of the one who played the testdump is emited too as data.origin, for further usage
	socket.on('testdump', function(data) {
		console.log('here is a test dump ' + data.play);
		socket.broadcast.to(data.room).emit('validate dump', {
			origin: socket.id,
			play: data.play
		});
	});
    //receive 'dong' signal, all four of them, 
    //emit all four of 'got dong' to the origin testdump player using his socket.id(data.origin)
    //four challenge results(restcard) will be emited to the origin testdump player
	socket.on('dong', function(data) {
		console.log('dong!' + data.restcard);
		io.to(data.origin).emit('got dong', {
			restcard: data.restcard
		});
	});
	//receive 'dump' signal, emit 'dump coming' to all players in the room
	socket.on('dump', function(data) {
		console.log('here is a dump ' + data.play);
		io.to(data.room).emit('dump coming', {
			play: data.play,
			judge: data.judge,
			seat: data.seat,
			name: data.name
		});
	});
	//receive 'round end' signal, set turn to the round winner and emit 'turn'
	socket.on('round end', function(data) {
		io.to(data.room).emit('turn', {
			turn: data.winnerseat
		});
		console.log(data.winnerseat);
	});
    //receive 'game end' signal, set turn to null and emit 'turn', make sure no player has his turn
    //emit 'show hiddens' to all players in the room, with winner and winplay info
	socket.on('game end', function(data) {
		io.to(data.room).emit('turn', {
			turn: null
		});
		io.to(socket.id).emit('show hiddens', {
			hiddens: Rooms[data.room]['Game']['hiddens'],
			win: data.win,
			winner: data.winner
		});
	});
    //receive 'game result' signal, reset Game object, shuffle and deal cards, then assign new chair, new levels, new masterValue to new game
    //emit 'again' to all users in the room to let them confirm to start the next game
	socket.on('game result', function(data) {
		console.log('Next game parameters:')
		console.log(data.newLevel);
		console.log(data.newChair);
		console.log(data.newMasterValue);
		Rooms[data.room]['Levels'] = data.newLevel;
		Rooms[data.room]['Game'] = {'master': {}, 'chair': {}, 'side': {'minority': [], 'majority': []}, 'hiddens': []};
		Rooms[data.room]['Game']['playercards'] = util.deal_card();
		Rooms[data.room]['Game']['master']['suit'] = ['D','C','H','S',false][Math.floor(Math.random() * 5)];
		Rooms[data.room]['Game']['master']['value'] = data.newMasterValue;
		Rooms[data.room]['Game']['chair']['seat'] = data.newChair;
		Rooms[data.room]['Game']['chair']['name'] = Rooms[data.room]['Players'][Rooms[data.room]['Game']['chair']['seat']];
		Rooms[data.room]['Game']['side']['minority'].push(Rooms[data.room]['Game']['chair']['seat']); 
		io.to(socket.id).emit('again');
	});
	//receive 'again ready' signal, emit 'confirm' to all players in the room
	socket.on('again ready', function(data) {
		io.to(data.room).emit('confirm');
	});
});

server.listen(3000, function() {
	console.log('Example app listening on port 3000');
})
