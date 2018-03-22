function update_state (name, room, seat) {
	$('.player').each(function() {
		draw_seat($(this).parent());
	});
	for (var i = 0; i < seat.length; i++) {
		draw_player($('#' + room[i] + '>.seat' + seat[i]), name[i]);
	}
}

function send_state(name, room, seat) {
	socket.emit('new state', {
		name: name,
		room: room,
		seat: seat
	});
}

function show_pick (masterSuit) {
	$('<div id="pickally"><select name="order"><option value=1>1st</option><option value=2>2nd</option><option value=3>3rd</option></select><select name="suit"><option value="D">Diamond</option><option value="C">Club</option><option value="H">Heart</option><option value="S">Spade</option></select><select name="value"><option value="A">A</option><option value="K">K</option><option value="Q">Q</option><option value="J">J</option><option value="0">10</option><option value="9">9</option><option value="8">8</option><option value="7">7</option><option value="6">6</option><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option></select><button id="picked" type="submit">Pick</button></div>').insertBefore($('#hold'));
	if (masterSuit) $('select>option[value='+masterSuit+']').remove();
}

function timer (name) {
	$('<h1 id="timer" class="' + name + '">Start</h1>').insertBefore($('#turn'));
	var t = 30;
	var interval = setInterval(function() {
		if (t < 10) {
			$('.' + name).css('color', 'red');
			$('.' + name).text('0' + t.toString());
			if (t === 0) clearInterval(interval);
		} else {
			$('.' + name).text(t);
		}
		t--;
	}, 1000);
}

function switch_turn(turn) {
	turn++;
	return turn % 5;
}

function array_minus (bigArray,smallArray) {
	copy = bigArray.slice();
	smallArray.forEach(function(v) { if (copy.indexOf(v) != -1) copy.splice(copy.indexOf(v),1); });
	return copy;
}

function ssort(a,b) {
	if (a == b) return 0;
	else {
		Object.keys(Cards).forEach(function(v) {
			if (Cards[v].hasOwnProperty(a)) a_suit = v;
			if (Cards[v].hasOwnProperty(b)) b_suit = v;
		});
		if (a_suit != b_suit) return ['D','C','H','S','M'].indexOf(a_suit) - ['D','C','H','S','M'].indexOf(b_suit);
		else if (a[1] != b[1]) return Cards[a_suit][a] - Cards[b_suit][b];
		else return ['D','C','H','S'].indexOf(a[0]) - ['D','C','H','S'].indexOf(b[0]);
	}
}

function setup_cards(masterSuit,masterValue) {
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
}

function create_card(card) {
	Card = {};
	Card['Suit'] = function() { return Object.keys(Cards).find(function(v) { return Cards[v].hasOwnProperty(card); }); };
	Card['Value'] = function() { return Cards[this.Suit()][card]; };
	return Card;
}

function create_select(select) {//['C2','C3','C4']
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
	//find out all double plus triple cards, return false if suit is 'mix'
	Select['Tri_Double'] = function() {
		if (this.Suit() == 'mix') return false;
		else if (!this.Double()) return this.Triple();
		else if (!this.Triple()) return this.Double();
		else return this.Double().concat(this.Triple());
	};
	//find out tractors, triple cards don't count, return false if suit is 'mix'
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
	//find out all tractors, triple cards count, return false if suit is 'mix'
	//put all findings in one object, classified by tractors' length
	Select['AllTractor'] = function() {
		if (this.Suit() == 'mix') return false;
		else if (this.Tri_Double().length < 2) return false;
		else {
			alltractors = {};
			for (i=0;i<this.Tri_Double().length;i++) {
				a = this.Tri_Double()[i];
				found = [];
				b = this.Tri_Double().find(function(v) { return create_card(v).Value() == create_card(a).Value() + 1; });
				if (b == undefined) continue;
				else {
					found.push(a);
					while (b != undefined) {
						a = b;
						found.push(a);
						b = this.Tri_Double().find(function(v) { return create_card(v).Value() == create_card(a).Value() + 1; });
					}
					len = found.length;
					if (alltractors.hasOwnProperty(len)) alltractors[len].push(found);
					else alltractors[len] = [found];
					i += (len - 1);
				}
			}
			return Object.keys(alltractors) == 0 ? false : alltractors;
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
		if (this.Suit() == 'mix') return false;
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
			if (this.Dump().hasOwnProperty('Triple')) pattern = pattern.concat('30'.repeat(this.Dump().Triple.length));
			
			if (this.Dump().hasOwnProperty('Tractor')) {
				tr = this.Dump().Tractor;
				Object.keys(tr).reverse().forEach(function(v) {
					for (i=0;i<tr[v].length;i++) {
						pattern = pattern.concat('2'.repeat(v));
						pattern = pattern.concat('0');
					}
				});
			}
			if (this.Dump().hasOwnProperty('Double')) pattern = pattern.concat('20'.repeat(this.Dump().Double.length));
			if (this.Dump().hasOwnProperty('Single')) pattern = pattern.concat('10'.repeat(this.Dump().Single.length));
			return pattern;
		}
	};
	Select['Patterns'] = function() {
		if (this.Suit() === 'mix') return false;
		else {
			pat = {};
			copy = this.Sort();
			while (create_select(copy).Tritractor()) {//{'2':[[S2,S3],[S6,S7]],'3':[[S9,S0,SJ]],...}
				m = Object.keys(create_select(copy).Tritractor())[Object.keys(create_select(copy).Tritractor()).length - 1];
				ttr = create_select(copy).Tritractor()[m][create_select(copy).Tritractor()[m].length - 1];
				ttr = ttr.concat(ttr, ttr);
				k = '3'.repeat(m);
				if (!pat.hasOwnProperty(k)) pat[k] = [];
				copy = array_minus(copy, ttr);
				pat[k].push(ttr);
			}
			while (create_select(copy).Triple().length > 0) {
				tpl = create_select(copy).Triple()[create_select(copy).Triple().length - 1];
				if (!pat.hasOwnProperty('3')) pat['3'] = [];
				copy = array_minus(copy, [tpl, tpl, tpl]);
				pat['3'].push([tpl, tpl, tpl]);
			}
			while (create_select(copy).Tractor()) {//{'2':[[S2,S3],[S6,S7]],'3':[[S9,S0,SJ]],...}
				m = Object.keys(create_select(copy).Tractor())[Object.keys(create_select(copy).Tractor()).length - 1];
				tr = create_select(copy).Tractor()[m][create_select(copy).Tractor()[m].length - 1];
				tr = tr.concat(tr);
				k = '2'.repeat(m);
				if (!pat.hasOwnProperty(k)) pat[k] = [];
				copy = array_minus(copy, tr);
				pat[k].push(tr);
			}
			while (create_select(copy).Double().length > 0) {
				dbl = create_select(copy).Double()[create_select(copy).Double().length - 1];
				if (!pat.hasOwnProperty('2')) pat['2'] = [];
				copy = array_minus(copy, [dbl, dbl]);
				pat['2'].push([dbl, dbl]);
			}
			pat['1'] = [];
			pat['1'].push(copy);
			return pat;
		}
	};
	return Select;
}

function sortkey (a, b) {
	if (a === b) {//33 : 33
		return 0;
	} else if (a.slice(0, 1) === b.slice(0, 1)) {//3:333
		return parseInt(a) - parseInt(b);
	} else if (a.length === b.length) {//22:33
		return parseInt(a) - parseInt(b);
	} else {//3:22
		return parseInt(a.slice(0, 1)) - parseInt(b.slice(0, 1));
	}
}

function vali_length (a, b) {
	return a.length === b.length ? true : false;
}

function vali_same_suit (select) {
	if (select.length === 0) return false;
	else return create_select(select).Suit() === 'mix' ? false : true;
}

function vali_select (select, winplay, hold, roundsuit) {
	thisSelect = create_select(select);
	RoundWin = create_select(winplay);
	judge = false;
	if (thisSelect.Length() !== RoundWin.Length()) {
		console.log('length must be the same');
		return false;
	} else {
		if (thisSelect.Suit() !== roundsuit) {
			if (array_minus(hold, select).length > 0) {
				console.log('still have ' + roundsuit + ' suit, have to play same suit.');
				return false;
			} else {
				if (thisSelect.Suit() !== 'M') judge = -1;
				else {
					if (thisSelect.Type() !== RoundWin.Type()) judge = -1;
					else {
						if (RoundWin.Suit() !== 'M') judge = 1;
						else judge = create_card(thisSelect.Top()).Value() > create_card(RoundWin.Top()).Value() ? 1 : -1;
					}
				}
				return judge;
			}
		} else {
			if (thisSelect.Type() === RoundWin.Type()) {//same length, suit, type and not dumps, just compare top value
				if (thisSelect.Suit() !== RoundWin.Suit()) judge = -1;//for situation like: thisSelect.Suit() = Round.Suit != 'M' && Round.Win.Suit() == 'M'
				else judge = create_card(thisSelect.Top()).Value() > create_card(RoundWin.Top()).Value() ? 1 : -1;
				return judge;
			} else {
				judge = -1;
				if (RoundWin.Type() == 'tritractor') {
					if (Object.keys(create_select(hold).Tritractor()).some(function(v) { return v - Object.keys(RoundWin.Tritractor())[0] >= 0; })) return false;
					else {
						if (create_select(hold).Triple().length * 3 < RoundWin.Length()) {
							if (create_select(array_minus(hold, select).concat(thisSelect.Single())).Triple().length > 0) return false;
							else {
								if (thisSelect.Single().length < 2) return judge;
								else {
									if (create_select(array_minus(hold, select).concat(thisSelect.Single())).Double().length > 0) return false;
									else return judge;
								}
							}
									
						} else {
							if (thisSelect.Double().length > 0 || thisSelect.Single().length > 0) return false;
							else {
								if (thisSelect.Tritractor()) return judge;
								else {
									if (create_select(hold).Tritractor()) return false;
									else return judge;
								}
							}
						}
					}
				} else if (RoundWin.Type() == 'tractor') {
					if (Object.keys(create_select(hold).Tractor()).some(function(v) { return v - Object.keys(RoundWin.Tractor())[0] >= 0; })) return false;
					else {
						if (create_select(hold).Double().length * 2 < RoundWin.Length()) {
							if (create_select(array_minus(hold,select).concat(thisSelect.Single())).Double().length > 0) return false;
							else return judge;
						} else {
							if (thisSelect.Single().length > 0)	return false;
							else {
								if (thisSelect.Tractor()) return judge;
								else {
									if (create_select(hold).Tractor()) return false;
									else return judge;
								}
							}
						}
					}
				} else if (RoundWin.Type() == 'triple') {
					if (create_select(hold).Triple().length > 0) return false;
					else {//no triple is fine, still need to check double cause 'no triple play double' rule
						if (thisSelect.Double().length > 0) return judge;
						else {
							if (create_select(hold).Double().length > 0) return false;
							else return judge;
						}
					}
				} else if (RoundWin.Type() == 'double') {//select.Double() method already exclude the only triple situation, so if no double means no double or have only triple
					if (create_select(hold).Double().length > 0) return false;
					else return judge;
				}
			}
		}
	}
}

function pattern_cover (p1, p2) {//333>222010101, 3>201, 33>2201, 2>101, 3>201, 3>10101, 22>202, 22>20101, 33>303, 33>30201, 33>220101
	if (p1.split('').reduce(function(t,v) { return t + parseInt(v); }, 0) < p2.split('').reduce(function(t,v) { return t + parseInt(v); }, 0)) return false;
	else {
		a1 = p1.split('0');
		a2 = p2.split('0');
		b1 = array_minus(a1, a2);
		b2 = array_minus(a2, a1);
		if (b1.length === 0) return true;
		else if (b2.some(function(v) { return v.slice(0, 1) === '3'; })) return false;
		else {
			c2 = b2.sort(sortkey).reverse();
			c1 = b1.sort(sortkey);
			while (c2.length !== 0) {
				x = c1.find(function(v) {
					return cover(v, c2[0]);
				});
				if (x !== undefined) {
					c1 = array_minus(c1, [x]).concat(cover_left(x, c2[0]));
					c2 = array_minus(c2, [c2[0]]);
					d1 = array_minus(c1, c2);
					d2 = array_minus(c2, c1);
					c1 = d1;
					c2 = d2;
				} else {
					break;
				}
			}
			return c2.length === 0 ? true : false;
		}
	}
}

function cover (s1, s2) {
	if (s2.slice(0, 1) === '3') {
		if (s1.slice(0, 1) === '3' && s1.length >= s2.length) return true;
		else return false;
	} else if (s2.slice(0, 1) === '2') {
		if ((s1.slice(0, 1) === '2' && s1.length >= s2.length) || (s1.slice(0, 1) === '3' && s1.length >= s2.length)) return true;
		else return false;
	} else if (s2 === '1') {
		if (s1.length > 0) return true;
		else return false;
	} else return true;
}

function cover_left (s1, s2) {
	if (cover(s1, s2)) {
		if (s1 === s2) return [];
		else if (s1.slice(0, 1) === s2.slice(0, 1)) {
			return [s1.slice(0, 1).repeat(s1.length - s2.length)];
		} else if (s1.length === s2.length) {
			return (parseInt(s1.slice(0, 1)) - parseInt(s2.slice(0, 1))).toString().repeat(s1.length).split('');
		} else {
			return [s1.slice(0, 1).repeat(s1.length - s2.length)].concat((parseInt(s1.slice(0, 1)) - parseInt(s2.slice(0, 1))).toString().repeat(s2.length).split(''));
		}
	} else {
		return false;
	}
}

function vali_dump (play, dump, winplay, hold) {
	thisPlay = create_select(play);
	theDump = create_select(dump);
	RoundWin = create_select(winplay);
	thisHold = create_select(hold);
	var judge;
	if (thisPlay.Length() !== theDump.Length()) {
		judge = 'length must be the same';
		console.log(judge);
	} else {
		if (thisPlay.Suit() === theDump.Suit()) {//same suit
			if (array_minus(hold, play).length === 0) {
				judge = -1;//don't have any same suit card left, no need to validate any further
				console.log(judge);
			} else {
				judge = -1;
				//same suit play cannot beat a successful dump, need to validate further
				//only have to check the situations violating the rules
				if (theDump.Tritractor()) {//original dump has tritractor
					if (thisHold.Tritractor()) {//player's hold has tritractor
						if (!thisPlay.Tritractor()) {//player has tritractor but didn't play it, foul
							judge = "have tritractor, must play it";
						} else {//player did play tritractor, must play the right one, 
							var triNumDump = 0;
							var triNumHold = 0;
							var triNumPlay = 0;
							Object.keys(theDump.Tritractor()).forEach(function(v) {
								triNumDump += theDump.Tritractor()[v].length;
							});
							Object.keys(thisHold.Tritractor()).forEach(function(v) {
								triNumHold += thisHold.Tritractor()[v].length;
							});
							Object.keys(thisPlay.Tritractor()).forEach(function(v) {
								triNumPlay += thisPlay.Tritractor()[v].length;
							});
							if (triNumPlay < triNumDump && triNumPlay < triNumHold) {
								//play's tritractor number less than dump's and hold's
								judge = 'have more tritractors, must play it';
							}

							var topKeyDump = Object.keys(theDump.Tritractor())[Object.keys(theDump.Tritractor()).length - 1];
							var topKeyHold = Object.keys(thisHold.Tritractor())[Object.keys(thisHold.Tritractor()).length - 1];
							var topKeyPlay = Object.keys(thisPlay.Tritractor())[Object.keys(thisPlay.Tritractor()).length - 1];
							if (topKeyPlay < topKeyDump && topKeyPlay < topKeyHold) {
								//play's tritractor shorter than dump's and hold's
								judge = 'have longer tritractor, must play it';
							}
							
						}
					} else if (thisHold.Tractor()) {

					}
				}
				if (RoundWin.Tritractor() && thisHold.Tritractor() && !thisPlay.Tritractor()) {
					judge = "have tritractor, must play it";
				}
				if (RoundWin.Tractor() && thisHold.Tractor() && !thisPlay.Tractor()) {
					judge = "have tractor, must play it";
				}
				if (RoundWin.Triple().length > 0) {
					if (thisPlay.Triple().length < RoundWin.Triple().length) {
						if (thisHold.Triple().length >= RoundWin.Triple().length) {
							judge = "have triple, must play it";
						} else if (thisHold.Triple().length !== thisPlay.Triple().length) {
							judge = "still have triple, must play it";
						}
					}
				}
				if (RoundWin.Double().length > 0) {
					if (thisPlay.Double().length < RoundWin.Tri_Double().length) {
						if (thisHold.Double().length >= RoundWin.Tri_Double().length) {
							judge = 'have double, must play it';
							console.log(judge);
						} else if (thisHold.Double().length !== thisPlay.Double().length) {
							judge = 'still have double, must play it';
						}
					}
				}
				console.log(judge);
			}
		} else {//different suit
			if (array_minus(hold, play).length > 0) {
				judge = 'still have ' + theDump.Suit() + ' suit, must play same suit';
				console.log(judge);
			} else {//really don't have this suit card, play is legal
				if (thisPlay.Suit() !== 'M') {
					judge = -1;//only same pattern M dump can beat a successful dump
				} else {//thisPlay is legal and M suit, compare with RoundWin see which one wins
					if (!pattern_cover(thisPlay.Pattern(), theDump.Pattern())) {
						judge = -1;
					}
					else {
						if (RoundWin.Suit() !== 'M') judge = 1;
						else {
							if (theDump.Tritractor()) {
								var m = Object.keys(theDump.Tritractor())[Object.keys(theDump.Tritractor()).length - 1];
								judge = create_card(thisPlay.Tritractor()[m][thisPlay.Tritractor()[m].length - 1][m-1]).Value() 
									- create_card(RoundWin.Tritractor()[m][RoundWin.Tritractor()[m].length - 1][m-1]).Value();
							} else if (theDump.Triple().length > 0) {
								judge = create_card(thisPlay.Triple()[thisPlay.Triple().length - 1]).Value() 
									- create_card(RoundWin.Triple()[RoundWin.Triple().length - 1]).Value();
							} else if (theDump.Tractor()) {
								var m = Object.keys(theDump.Tractor())[Object.keys(theDump.Tractor()).length - 1];
								judge = create_card(thisPlay.AllTractor()[m][thisPlay.AllTractor()[m].length - 1][m-1]).Value() 
									- create_card(RoundWin.AllTractor()[m][RoundWin.AllTractor()[m].length - 1][m-1]).Value();
							} else if (theDump.Double().length > 0) {
								judge = create_card(thisPlay.Tri_Double()[thisPlay.Tri_Double().length - 1]).Value() 
									- create_card(RoundWin.Tri_Double()[RoundWin.Tri_Double().length - 1]).Value();
							} else {
								judge = create_card(thisPlay.Sort()[thisPlay.Sort().length - 1]).Value() 
									- create_card(RoundWin.Sort()[RoundWin.Sort().length - 1]).Value();
							}
						}
					}
				}
			}
		}
	}
	return judge;
}

function challenge_dump (dump, hold) {
	thisSelect = create_select(dump);
	sgl = thisSelect.Single()[0];
	if (thisSelect.Dump().Double !== undefined) dbl = thisSelect.Dump().Double[0];
	else dbl = undefined;
	if (thisSelect.Dump().Triple !== undefined) tpl = thisSelect.Dump().Triple[0];
	else tpl = undefined;
	tr = thisSelect.Tractor();
	ttr = thisSelect.Tritractor();
	restCard = false;
	if (sgl !== undefined && hold.some(function(v) { return create_card(v).Value() > create_card(sgl).Value(); })) {
		console.log('I have singles bigger than your smallest single');
		restCard = [sgl];
	} else if (dbl !== undefined && create_select(hold).Tri_Double().some(function(v) { return create_card(v).Value() > create_card(dbl).Value(); })) {
		console.log('I have doubles bigger than your smallest double');
		restCard = [dbl, dbl];	
	} else if (tpl !== undefined && create_select(hold).Triple().some(function(v) { return create_card(v).Value() > create_card(tpl).Value(); })) {
			console.log('I have triples bigger than your smallest triple');
			restCard = [tpl, tpl, tpl];
	} else if (tr) {
		Object.keys(tr).forEach(function(e) {
			holdTr = create_select(hold).AllTractor();
			if (Object.keys(holdTr).some(function(k) { return k >= e && create_card(holdTr[k][holdTr[k].length - 1][k - 1]).Value() > create_card(tr[e][tr[e].length - 1][e - 1]).Value(); })) {
				console.log('I have tractors bigger than your smallest tractor');
				restCard = tr[e][0].concat(tr[e][0]);
			}
		});		
	} else if (ttr) {
		Object.keys(ttr).forEach(function(e) {	
			holdTtr = create_select(hold).Tritractor();
			if (Object.keys(holdTtr).some(function(k) { return k >= e && create_card(holdTtr[k][holdTtr[k].length - 1][k - 1]).Value() > create_card(ttr[e][ttr[e].length - 1][e - 1]).Value(); })) {
				console.log('I have tritractors bigger than your smallest tritractor');
				restCard = ttr[e][0].concat(ttr[e][0]).concat(ttr[e][0]);
			}
		});		
	}
	if (restCard) return restCard;			
	else return false;
}

function level_up (level, score, side) {
	rule = ['2','3','4','5','6','7','8','9','0','J','Q','K','A'];
	miup = maup = 0;
	if (score === 0) miup = 5;
	else if (score < 60) miup = 2;
	else if (score < 120) miup = 1;
	else if (score < 180) maup = miup = 0;
	else if (score < 240) maup = 1;
	else if (score < 300) maup = 2;
	else if (score < 360) maup = 3;
	else maup = 5;
	
	if (side === 'minority' || side === 'chair') up = miup;
	else up = maup;
	
	if (rule.indexOf(level) < 3) upmax = Math.min(3 - rule.indexOf(level), up);
	else if (rule.indexOf(level) < 8) upmax = Math.min(8 - rule.indexOf(level), up);
	else if (rule.indexOf(level) === 8) upmax = Math.min(1, up);
	else if (rule.indexOf(level) === 9) {
		if (side === 'chair') upmax = Math.min(2, up);
		else upmax = 0;
	}
	else if (rule.indexOf(level) < 11) upmax = Math.min(11 - rule.indexOf(level), up);
	else if (rule.indexOf(level) === 11) upmax = Math.min(1, up);
	else {
		if (side === 'chair') {
			if (up === 0) upmax = 0;
			else upmax = Math.min(-9, up - 13);
		}
		else upmax = 0;
	}
	return rule[rule.indexOf(level) + upmax];
}

function overlap (cardType, nospace = false) {
	if (nospace) {
		var i = 0;
		$(cardType).each(function() {
			$(this).css({'left': (i * 50) + 'px', 'z-index': i});
			i++;
		});
	} else {
		var i = 0;
		var totalWidth = 1340;
		var cardWidth = 80;
		var cardNum = $(cardType).length;
		var theCardNum = 16;
		var width;
		var space;
		if (cardNum > theCardNum) {
			width = cardWidth - (cardWidth * cardNum - totalWidth) / cardNum;
			space = 0;
		} else {
			width = 80;
			space = (totalWidth - cardWidth * cardNum) / 2;
		}
		$(cardType).each(function() {
			$(this).css({'left': (space + i * width) + 'px', 'z-index': i});
			i++;
		});
	}
}

function draw_card(card, cardArea, cardClass) {
	var thecard = $('<canvas class="' + cardClass + '" value="' + card + '"></canvas>');
	thecard[0].width = 80;
	thecard[0].height = 120;
	$(cardArea).append(thecard);
	if (thecard[0].getContext) {
		var ctx = thecard[0].getContext('2d');
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, 80, 120);
		ctx.beginPath();
		ctx.moveTo(4, 0);
		ctx.lineTo(76, 0);
		ctx.moveTo(80, 4);
		ctx.lineTo(80, 116);
		ctx.moveTo(76, 120);
		ctx.lineTo(4, 120);
		ctx.moveTo(0, 116);
		ctx.lineTo(0, 4);
		ctx.moveTo(76, 0);
		ctx.arc(76, 4, 4, - Math.PI / 2, 0, false);
		ctx.moveTo(80, 116);
		ctx.arc(76, 116, 4, 0, Math.PI / 2, false);
		ctx.moveTo(4, 120);
		ctx.arc(4, 116, 4, Math.PI / 2, Math.PI, false);
		ctx.moveTo(0, 4);
		ctx.arc(4, 4, 4, Math.PI, Math.PI * 3 / 2, false);
		ctx.closePath();
		ctx.stroke();	
		if (card === 'MF') {
			ctx.font = '15px Arial';
			ctx.fillStyle = 'black';
			ctx.fillText('J', 7, 14);
			ctx.fillText('O', 5, 26);
			ctx.fillText('K', 5, 38);
			ctx.fillText('E', 5, 50);
			ctx.fillText('R', 5, 62);
			ctx.beginPath();
			ctx.moveTo(40, 35);
			ctx.bezierCurveTo(36, 50, 36, 64, 20, 90);
			ctx.lineTo(60, 90);
			ctx.bezierCurveTo(44, 64, 44, 50, 40, 40);
			ctx.closePath();
			ctx.fill();
			ctx.arc(40, 35, 6, 0, 2 * Math.PI, false);
			ctx.fill();
		} else if (card === 'ME'){
			ctx.font = '15px Arial';
			ctx.fillStyle = 'red';
			ctx.fillText('J', 7, 14);
			ctx.fillText('O', 5, 26);
			ctx.fillText('K', 5, 38);
			ctx.fillText('E', 5, 50);
			ctx.fillText('R', 5, 62);
			ctx.beginPath();
			ctx.moveTo(40, 35);
			ctx.bezierCurveTo(36, 50, 36, 64, 20, 90);
			ctx.lineTo(60, 90);
			ctx.bezierCurveTo(44, 64, 44, 50, 40, 40);
			ctx.closePath();
			ctx.fill();
			ctx.arc(40, 35, 6, 0, 2 * Math.PI, false);
			ctx.fill();
		} else {
			if (card[0] === 'D') {
				ctx.fillStyle = 'red';
				ctx.beginPath();
				ctx.moveTo(40, 30);
				ctx.lineTo(20, 60);
				ctx.lineTo(40, 90);
				ctx.lineTo(60, 60);
				ctx.lineTo(40, 30);
				ctx.closePath();
				ctx.font = '30px Arial';
				if (card[1] === '0') {
					ctx.fillText('1', 0, 30);
					ctx.fillText('0', 13, 30);
				} else {
					ctx.fillText(card[1], 5, 30);
				}
				ctx.fill();
			} else if (card[0] === 'C') {
				ctx.fillStyle = 'black';
				ctx.beginPath();
				ctx.arc(40, 46, 12, 0, 2 * Math.PI, false);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(52, 66, 12, 0, 2 * Math.PI, false);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(28, 66, 12, 0, 2 * Math.PI, false);
				ctx.fill();
				ctx.beginPath();
				ctx.arc(40, 62, 6, 0, 2 * Math.PI, false);
				ctx.fill();
				ctx.moveTo(40, 66);
				ctx.quadraticCurveTo(40, 90, 30, 90);
				ctx.lineTo(50, 90);
				ctx.quadraticCurveTo(40, 90, 40, 64);
				ctx.closePath();
				ctx.font = '30px Arial';
				if (card[1] === '0') {
					ctx.fillText('1', 0, 30);
					ctx.fillText('0', 13, 30);
				} else {
					ctx.fillText(card[1], 5, 30);
				}
				ctx.fill();
			} else if (card[0] === 'H') {
				ctx.fillStyle = 'red';
				ctx.beginPath();
				ctx.moveTo(40, 48);
				ctx.bezierCurveTo(40, 30, 10, 30, 10, 48);
				ctx.bezierCurveTo(10, 69, 40, 69, 40, 90);
				ctx.bezierCurveTo(40, 69, 70, 69, 70, 48);
				ctx.bezierCurveTo(70, 30, 40, 30, 40, 48);
				ctx.font = '30px Arial';
				if (card[1] === '0') {
					ctx.fillText('1', 0, 30);
					ctx.fillText('0', 13, 30);
				} else {
					ctx.fillText(card[1], 5, 30);
				}
				ctx.fill();
			} else if (card[0] === 'S') {
				ctx.fillStyle = 'black';
				ctx.beginPath();
				ctx.moveTo(40, 30);
				ctx.bezierCurveTo(40, 51, 19, 51, 19, 72);
				ctx.bezierCurveTo(19, 84.6, 40, 84.6, 40, 72);
				ctx.bezierCurveTo(40, 84.6, 61, 84.6, 61, 72);
				ctx.bezierCurveTo(61, 51, 40, 51, 40, 30);
				ctx.closePath();
				ctx.fill();	
				ctx.beginPath();
				ctx.moveTo(40, 72);
				ctx.quadraticCurveTo(40, 90, 19, 90);
				ctx.lineTo(61, 90);
				ctx.quadraticCurveTo(40, 90, 40, 72);
				ctx.closePath();
				ctx.font = '30px Arial';
				if (card[1] === '0') {
					ctx.fillText('1', 0, 30);
					ctx.fillText('0', 13, 30);
				} else {
					ctx.fillText(card[1], 5, 30);
				}
				ctx.fill();
			}
		}
	}
}

function draw_table(tableArea) {
	var thetable = $('<canvas class="table"></canvas>');
	thetable[0].width = 100;
	thetable[0].height = 100;
	$(tableArea).append(thetable);
	if (thetable[0].getContext) {
		var ctx = thetable[0].getContext('2d');
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, 100, 100);
		ctx.beginPath();
		ctx.arc(50, 50, 50, 0, 2 * Math.PI, false);
		ctx.closePath();
		ctx.fillStyle = 'maroon';
		ctx.fill();	
	}
}

function draw_seat(seatArea) {
	var theseat = $('<canvas class="seat"></canvas>');
	theseat[0].width = 30;
	theseat[0].height = 30;
	$(seatArea).empty();
	$(seatArea).append(theseat);
	if (theseat[0].getContext) {
		var ctx = theseat[0].getContext('2d');
		ctx.fillStyle = 'silver';
		ctx.fillRect(0, 0, 30, 30);
	}
}

function draw_player(seatArea, name) {
	var theplayer = $('<canvas class="player"></canvas>');
	theplayer[0].width = 30;
	theplayer[0].height = 30;
	$(seatArea).empty();
	$(seatArea).append(theplayer);
	if (theplayer[0].getContext) {
		var ctx = theplayer[0].getContext('2d');
		ctx.fillStyle = 'orange';
		ctx.fillRect(0, 0, 30, 30);
		ctx.fillStyle = 'black';
		ctx.font = '10 Arial';
		ctx.fillText(name, 0, 15);
	}
}