module.exports = {
//for users whose seat is not null, save their name, room, seat info relatively in three arrays and emit to all users
//for updating the seat situation to all online users
update_state: function(Users, io) {
	var name = [];
	var room = [];
	var seat = [];
	Object.keys(Users).forEach(function(v) {
		if (Users[v].seat !== null) {
			name.push(Users[v].name);
			room.push(Users[v].room);
			seat.push(Users[v].seat);
		}
	});
	io.emit('update state', {
		name: name,
		room: room,
		seat: seat
	});
},
//create a game room, has roomID, Game, Players, Levels properties
//Game is a object contains master, chair, side, hiddens properties
create_room: function create_room(roomID) {
	var Room = {};
	Room['ID'] = roomID;
	Room['Game'] = {'master': {}, 'chair': {}, 'side': {'minority': [], 'majority': []}, 'hiddens': []};
	Room['Players'] = {};
	Room['Levels'] = {};
	return Room;
},
//emit userinfo the the 5 users in the room, include the chair, players, levels info
update_userinfo: function(room, io) {
	io.to(room['ID']).emit('user info', {
		chairName: room['Game']['chair']['name'],
		players: room['Players'],
		levels: room['Levels']
	});
},

switch_turn: function (turn) {
	var iturn = parseInt(turn) + 1;
	return iturn === 5 ? '5' : (iturn % 5).toString;
},

setup_cards: function setup_cards(masterSuit,masterValue) {
	order = ['2','3','4','5','6','7','8','9','0','J','Q','K','A'];
	Cards = {D:{},C:{},H:{},S:{}};
	order.splice(order.indexOf(masterValue),1);
	i = 0;
	order.forEach(function(v) {
		Cards['D']['D'+v] = i;
		Cards['C']['C'+v] = i;
		Cards['H']['H'+v] = i;
		Cards['S']['S'+v] = i;
		i++;
	});
	if (masterSuit !== false) {
		Cards['M'] = Cards[masterSuit];
		delete(Cards[masterSuit]);
		Cards['M']['D'+masterValue] = i;
		Cards['M']['C'+masterValue] = i;
		Cards['M']['H'+masterValue] = i;
		Cards['M']['S'+masterValue] = i;
		delete(Cards['M'][masterSuit+masterValue]);
		Cards['M'][masterSuit+masterValue] = i+1;
		Cards['M']['MF'] = i+2;
		Cards['M']['ME'] = i+3;
	}
	else {
		Cards['M'] = {};
		Cards['M']['D'+masterValue] = 0;
		Cards['M']['C'+masterValue] = 0;
		Cards['M']['H'+masterValue] = 0;
		Cards['M']['S'+masterValue] = 0;
		Cards['M']['MF'] = 2;
		Cards['M']['ME'] = 3;
	}
	return Cards;
},

deal_card: function deal_card() {
	var cardset = [];
	var suits = ['D','C','H','S'];
	var values = ['2','3','4','5','6','7','8','9','0','J','Q','K','A'];
	suits.forEach(function(s) {
		values.forEach(function(v) {
			cardset.push(s + v);
		});
	});
	cardset.push('MF','ME');
	var threeset = cardset.concat(cardset, cardset);
	for (i = threeset.length - 1; i > 0; i--) {
		j = Math.floor(Math.random() * (i + 1));
		var temp = threeset[i];
		threeset[i] = threeset[j];
		threeset[j] = temp;
	}
	var playercards = {};
	playercards[0] = threeset.slice(-7);
	[1,2,3,4,5].forEach(function(v) {
		playercards[v] = threeset.slice((v - 1) * 31, v * 31);
	});
	return playercards;
},

create_card: function create_card(card) {
	Card = {};
	Card['Suit'] = function() { return Object.keys(Cards).find(function(v) { return Cards[v].hasOwnProperty(card); }); };
	Card['Value'] = function() { return Cards[this.Suit()][card]; };
	return Card;
},

create_select: function create_select(select) {//['C2','C3','C4']
	Select = {};
	//if same suit, return it; if not, return 'mix'
	Select['Suit'] = function() { return select.every(function(v,i,a) { return i === 0 || create_card(v).Suit() === create_card(a[i-1]).Suit(); }) ? create_card(select[0]).Suit() : 'mix'; };
	//return length
	Select['Length'] = function() { return select.length; };
	//sort the cards by the order of Cards[suit], then Cards[value], then prefix if two cards are not masterSuit but masterValues
	Select['Sort'] = function() { 
		return select.sort(function(a,b) {
			if (create_card(a).Suit() != create_card(b).Suit()) return ['D','C','H','S','M'].indexOf(create_card(a).Suit()) - ['D','C','H','S','M'].indexOf(create_card(b).Suit());
			else if (create_card(a).Value() != create_card(b).Value()) return create_card(a).Value() - create_card(b).Value();
			else return ['D','C','H','S'].indexOf(a.slice(0,1)) - ['D','C','H','S'].indexOf(b.slice(0,1));
		});
	}
	Select['Score'] = function() {
		sc = 0;
		select.forEach(function(v) { 
			if (v.slice(-1) == '5') sc += 5;
			else if (v.slice(-1) == '0') sc += 10;
			else if (v.slice(-1) == 'K') sc += 10;
		});
		return sc;
	}
	//find out all single cards, return false if suit is 'mix'
	Select['Single'] = function() {
		if (this.Suit() == 'mix') return false;
		else {
			singleResult = [];
			this.Sort().forEach(function(v,i,a) { if (v != a[i-1] && v != a[i+1]) singleResult.push(v); });
			return singleResult;
		}
	};
	//find out all double cards, triple cards don't count, return false if suit is 'mix'
	Select['Double'] = function() {
		if (this.Suit() == 'mix') return false;
		else {
			doubleResult = [];
			removeTriple = $(this.Sort()).not(this.Triple()).get();
			removeTriple.forEach(function(v,i,a) { if (v == a[i-1] && v != a[i+1]) doubleResult.push(v); });
			return doubleResult;
		}
	};
	//find out all triple cards, return false if suit is 'mix'
	Select['Triple'] = function() {
		if (this.Suit() == 'mix') return false;
		else {
			tripleResult = [];
			this.Sort().forEach(function(v,i,a) { if (v == a[i-1] && v == a[i+1]) tripleResult.push(v); });
			return tripleResult;
		}
	};
	//find out all tractors, triple cards don't count, return false if suit is 'mix'
	//put all findings in one object, classified by tractors' length
	Select['Tractor'] = function() {
		if (this.Suit() == 'mix') return false;
		else if (this.Double().length < 2) return false;
		else {
			tractors = {};
			for (i=0;i<this.Double().length;i++) {
				a = this.Double()[i];
				found = [];
				b = this.Double().find(function(v) { return create_card(v).Value() == create_card(a).Value() + 1; });
				if (b == undefined) continue;
				else {
					found.push(a);
					while (b != undefined) {
						a = b;
						found.push(a);
						b = this.Double().find(function(v) { return create_card(v).Value() == create_card(a).Value() + 1; });
					}
					len = found.length;
					if (tractors.hasOwnProperty(len)) tractors[len].push(found);
					else tractors[len] = [found];
					i += (len - 1);
				}
			}
			return Object.keys(tractors) == 0 ? false : tractors;
		}	
	};
	//find out all tritractors, return false if suit is 'mix'
	//put all findings in one object, classified by tritractors' length
	Select['Tritractor'] = function() {
		if (this.Suit() == 'mix') return false;
		else if (this.Triple().length < 2) return false;
		else {
			tritractors = {};
			for (i=0;i<this.Triple().length;i++) {
				a = this.Triple()[i];
				found = [];
				b = this.Triple().find(function(v) { return create_card(v).Value() == create_card(a).Value() + 1; });
				if (b == undefined) continue;
				else {
					found.push(a);
					while (b != undefined) {
						a = b;
						found.push(a);
						b = this.Triple().find(function(v) { return create_card(v).Value() == create_card(a).Value() + 1; });
					}
					len = found.length;
					if (tritractors.hasOwnProperty(len)) tritractors[len].push(found);
					else tritractors[len] = [found];
					i += (len - 1);
				}
			}
			return Object.keys(tritractors) == 0 ? false : tritractors;
		}	
	};
	//return selection's type, return 'fool' if suit is 'mix', return dump is selection has no type
	Select['Type'] = function() {
		if (this.Suit() == 'mix') return 'fool';
		else if (this.Length() == 1) return 'single';
		else if (this.Length() == 2 && this.Double().length > 0) return 'double';
		else if (this.Length() == 3 && this.Triple().length > 0) return 'triple';
		else if (Object.keys(this.Tractor()).length == 1 && Object.entries(this.Tractor())[0][1][0].length * 2 == this.Length()) return 'tractor';
		else if (Object.keys(this.Tritractor()).length == 1 && Object.entries(this.Tritractor())[0][1][0].length * 3 == this.Length()) return 'tritractor';
		else return 'dump';
	};
	//return the top value card of a selection if it has a type, return false if type is 'dump' or suit is 'mix'
	Select['Top'] = function() {
		if (this.Suit() == 'mix') return false;
		else if (this.Type() == 'dump') return false;
		else return this.Sort().slice(-1)[0];
	};
	//find out a dump's details, return false if type is not 'dump' or suit is 'mix'
	//tritractors, tractors and singles can be accessed directly, doubles should minus tractor elements and triples should minus tritractor elements
	Select['Dump'] = function() {
		if (this.Suit() == 'mix') return false;
		else if (this.Type() != 'dump') return false;
		else {
			all = {};
			if (this.Tritractor()) all['Tritractor'] = this.Tritractor();
			if (this.Tractor()) all['Tractor'] = this.Tractor();
			ttr = this.Tritractor();
			tri = this.Triple().slice();
			Object.keys(ttr).forEach(function(k){ ttr[k].forEach(function(v){ tri = $(tri).not(v).get(); }); });
			if (tri.length > 0) all['Triple'] = tri;
			tr = this.Tractor();
			db = this.Double().slice();
			Object.keys(tr).forEach(function(k){ tr[k].forEach(function(v){ db = $(db).not(v).get(); }); });
			if (db.length > 0) all['Double'] = db;
			if (this.Single().length > 0) all['Single'] = this.Single();
			return all;
		}
	};
	//generate a string to describe the selection's pattern
	//like 3330330302222022202010 for a selection which has a 3-tritractor, a 2-tritractor, a triple, a 4-tractor, a 3-tractor, a double and a single
	//use this to compare dump to a killer dump, if a successful dump is played, only a 'M' suit dump with the same pattern can beat it
	Select['Pattern'] = function() {
		if (this.Dump() == false) return false;
		else {
			pattern = '';
			if (this.Dump().hasOwnProperty('Tritractor')) {
				ttr = this.Dump().Tritractor;
				Object.keys(ttr).reverse().forEach(function(v) {
					for (i=0;i<ttr[v].length;i++) {
						pattern = pattern.concat('3'.repeat(v));
						pattern = pattern.concat('0');
					}
				});
			}
			if (this.Dump().hasOwnProperty('Triple')) for (i=0;i<this.Dump().Triple.length;i++) pattern = pattern.concat('30');
			if (this.Dump().hasOwnProperty('Tractor')) {
				tr = this.Dump().Tractor;
				Object.keys(tr).reverse().forEach(function(v) {
					for (i=0;i<tr[v].length;i++) {
						pattern = pattern.concat('2'.repeat(v));
						pattern = pattern.concat('0');
					}
				});
			}
			if (this.Dump().hasOwnProperty('Double')) for (i=0;i<this.Dump().Double.length;i++) pattern = pattern.concat('20');
			if (this.Dump().hasOwnProperty('Single')) for (i=0;i<this.Dump().Single.length;i++) pattern = pattern.concat('10');
			return pattern;
		}
	};
	return Select;
},

create_hold: function create_hold (hold) {
	Hold = {'D': [], 'C': [], 'H': [], 'S': [], 'M': []};
	hold.forEach(function(v) {
		Hold[create_card(v).Suit()].push(v);
	});
	return Hold;
}


};