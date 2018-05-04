var express = require('express');
var app = express();
var path = require('path');
var server = require('http').Server(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 8080;
var session = require('express-session');
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var hbs = require('hbs');
var util = require('./public/javascripts/util');
var Users = {};
var Rooms = {};
var Seats = {};

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
	
	socket.on('disconnect', function() {
		console.log('A user disconnected, id: ' + socket.id);
		delete Users[socket.id];
		if (Seats[Users[socket.id]] !== undefined) delete Seats[Users[socket.id].seat];
	});
	
	socket.on('login', function(data) {
		console.log('A user login, name: ' + data.username);
		Users[socket.id] = {};
		Users[socket.id].name = data.username;
		Users[socket.id].room = null;
		Users[socket.id].seat = null;
		util.update_state(Users, io);
	});
	
	socket.on('join', function(data) {
		console.log(data);
		socket.join(data);
	});

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
	
	socket.on('chair ready', function(data) {
		io.to(socket.id).emit('bottom cards', {
			topCards: Rooms[data.room]['Game']['playercards'][Rooms[data.room]['Game']['chair']['seat']],
			bottomCards: Rooms[data.room]['Game']['playercards'][0]
		});	
	});

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
	
	socket.on('play', function(data) {
		console.log('here is a test play ' + data.play);
		io.to(data.room).emit('play coming', {
			play: data.play,
			judge: data.judge,
			seat: data.seat,
			name: data.name
		});
	});
	
	socket.on('testdump', function(data) {
		console.log('here is a test dump ' + data.play);
		socket.broadcast.to(data.room).emit('validate dump', {
			origin: socket.id,
			play: data.play
		});
	});
	
	socket.on('dong', function(data) {
		console.log('dong!' + data.restcard);
		io.to(data.origin).emit('got dong', {
			restcard: data.restcard
		});
	});
	
	socket.on('dump', function(data) {
		console.log('here is a dump ' + data.play);
		io.to(data.room).emit('dump coming', {
			play: data.play,
			judge: data.judge,
			seat: data.seat,
			name: data.name
		});
	});
	
	socket.on('round end', function(data) {
		io.to(data.room).emit('turn', {
			turn: data.winnerseat
		});
		console.log(data.winnerseat);
	});

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
	
	socket.on('again ready', function(data) {
		io.to(data.room).emit('confirm');
	});
});

server.listen(8080, function() {
	console.log('Example app listening on port 8080');
})
