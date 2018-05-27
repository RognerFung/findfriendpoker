//draw all the empty chairs and player on chairs according to the latest state of name, room and seat
function update_state (name, room, seat) {
	$('.player').each(function() {
		draw_seat($(this).parent());
	});
	for (var i = 0; i < seat.length; i++) {
		draw_player($('#' + room[i] + '>.seat' + seat[i]), name[i]);
	}
}
//send state of name, room and seat to server
function send_state (name, room, seat) {
	socket.emit('new state', {
		name: name,
		room: room,
		seat: seat
	});
}
//show the pick-ally-card selects
function show_pick (masterSuit) {
	$('<div id="pickally"><select name="order"><option value=1>1st</option><option value=2>2nd</option><option value=3>3rd</option></select><select name="suit"><option value="D">Diamond</option><option value="C">Club</option><option value="H">Heart</option><option value="S">Spade</option></select><select name="value"><option value="A">A</option><option value="K">K</option><option value="Q">Q</option><option value="J">J</option><option value="0">10</option><option value="9">9</option><option value="8">8</option><option value="7">7</option><option value="6">6</option><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option></select><button id="picked" type="submit">Pick</button></div>').insertBefore($('#hold'));
	if (masterSuit) {
        $('select>option[value=' + masterSuit + ']').remove();
    }
}
//a 30 seconds timer shows when each player's turn begin, but it doesn't do anything when downs to zero, need further work
//add a class with random name to the #timer, in case different timer interferes each other
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
//turn equals 3 means it's player 3's turn to play, normally it switches from 1 - 5 then back to 1 again.
function switch_turn (turn) {
	turn++;
	return turn % 5;
}
//smallArray is a sub array of bigArray, return a new array of bigArray minus smallArray. duplicated elements only minus once. 
function array_minus (bigArray, smallArray) {
	var copy = bigArray.slice();
	smallArray.forEach(function(v) {
        if (copy.indexOf(v) !== -1) {
            copy.splice(copy.indexOf(v), 1);
        } 
    });
	return copy;
}
//sort two cards by order of suits(M>S>H>C>D), value(A>K>Q>...>3>2)(except master value), master value's suit(S>H>C>D)
function ssort(a, b) {
	if (a === b) {
        return 0;
    } else {
		Object.keys(Cards).forEach(function(v) {
			if (Cards[v].hasOwnProperty(a)) {
                var a_suit = v;
            }
			if (Cards[v].hasOwnProperty(b)) {
                var b_suit = v;
            }
		});
		if (a_suit !== b_suit) {
            return ['D','C','H','S','M'].indexOf(a_suit) - ['D','C','H','S','M'].indexOf(b_suit);
        } else if (a[1] !== b[1]) {
            return Cards[a_suit][a] - Cards[b_suit][b];
        } else {
            return ['D','C','H','S'].indexOf(a[0]) - ['D','C','H','S'].indexOf(b[0]);
        }
	}
}
//according a masterSuit and masterValue, setup the Cards into D,C,H,S,M five suits, and each suits has elements with a value in order
function setup_cards(masterSuit, masterValue) {
	var order = ['2', '3', '4', '5', '6', '7', '8', '9', '0', 'J', 'Q', 'K', 'A'];
	var Cards = { D: {}, C: {}, H: {}, S: {} };
	order.splice(order.indexOf(masterValue), 1);
	var i = 0;
	order.forEach(function(v) {
		Cards['D']['D' + v] = i;
		Cards['C']['C' + v] = i;
		Cards['H']['H' + v] = i;
		Cards['S']['S' + v] = i;
		i++;
	});
	if (masterSuit !== false) {
		Cards['M'] = Cards[masterSuit];
		delete(Cards[masterSuit]);
		Cards['M']['D' + masterValue] = i;
		Cards['M']['C' + masterValue] = i;
		Cards['M']['H' + masterValue] = i;
		Cards['M']['S' + masterValue] = i;
		delete(Cards['M'][masterSuit + masterValue]);
		Cards['M'][masterSuit + masterValue] = i + 1;
		Cards['M']['MF'] = i + 2;
		Cards['M']['ME'] = i + 3;
	}
	else {
		Cards['M'] = {};
		Cards['M']['D' + masterValue] = 0;
		Cards['M']['C' + masterValue] = 0;
		Cards['M']['H' + masterValue] = 0;
		Cards['M']['S' + masterValue] = 0;
		Cards['M']['MF'] = 2;
		Cards['M']['ME'] = 3;
	}
	return Cards;
}
//from a string, like 'SA', creat a Card object, it has two properties of 'Suit' and 'Value'.
function create_card(card) {
	var Card = {};
	Card['Suit'] = function() { return Object.keys(Cards).find(function(v) { return Cards[v].hasOwnProperty(card); }); };
	Card['Value'] = function() { return Cards[this.Suit()][card]; };
	return Card;
}
//from a array of cards, like ['SA', 'SA', 'SK'], create a select object, which has multiple methods
function create_select(select) {//['C2','C3','C4']
	var Select = {};
	//if all elements have the same suit, return the suit; if not, return 'mix'
	Select['Suit'] = function() { return select.every(function(v, i, a) { return i === 0 || create_card(v).Suit() === create_card(a[i - 1]).Suit(); }) ? create_card(select[0]).Suit() : 'mix'; };
	//return length
	Select['Length'] = function() { return select.length; };
	//sort the cards by the order of Cards[suit], then Cards[value], then prefix if two cards are not masterSuit but masterValues
	Select['Sort'] = function() { 
		return select.sort(function(a, b) {
			if (create_card(a).Suit() !== create_card(b).Suit()) {
                return ['D','C','H','S','M'].indexOf(create_card(a).Suit()) - ['D','C','H','S','M'].indexOf(create_card(b).Suit());
            } else if (create_card(a).Value() !== create_card(b).Value()) {
                return create_card(a).Value() - create_card(b).Value();
            } else {
                return ['D','C','H','S'].indexOf(a.slice(0,1)) - ['D','C','H','S'].indexOf(b.slice(0,1));
            }
		});
    }
    //return the select has how many scores, by counting '5', '0' and 'K's in it
	Select['Score'] = function() {
		var sc = 0;
		select.forEach(function(v) { 
			if (v.slice(-1) == '5') sc += 5;
			else if (v.slice(-1) == '0') sc += 10;
			else if (v.slice(-1) == 'K') sc += 10;
		});
		return sc;
	}
	//find out all single cards, return false if suit is 'mix'
	Select['Single'] = function() {
		if (this.Suit() === 'mix') {
            return false;
        } else {
			var singleResult = [];
			this.Sort().forEach(function(v, i, a) {
                if (v !== a[i - 1] && v !== a[i + 1]) {
                    singleResult.push(v);
                }
            });
			return singleResult;
		}
	};
	//find out all double cards, triple cards don't count, return false if suit is 'mix'
	Select['Double'] = function() {
		if (this.Suit() === 'mix') {
            return false;
        } else {
			var doubleResult = [];
			var removeTriple = $(this.Sort()).not(this.Triple()).get();
			removeTriple.forEach(function(v, i, a) {
                if (v === a[i - 1] && v !== a[i + 1]) {
                    doubleResult.push(v);
                }
            });
			return doubleResult;
		}
	};
	//find out all triple cards, return false if suit is 'mix'
	Select['Triple'] = function() {
		if (this.Suit() === 'mix') {
            return false;
        } else {
			var tripleResult = [];
			this.Sort().forEach(function(v, i, a) {
                if (v === a[i - 1] && v === a[i + 1]) {
                    tripleResult.push(v);
                } 
            });
			return tripleResult;
		}
	};
	//find out all double plus triple cards, return false if suit is 'mix'
	Select['Tri_Double'] = function() {
		if (this.Suit() === 'mix') {
            return false;
        } else if (!this.Double()) {
            return this.Triple();
        } else if (!this.Triple()) {
            return this.Double();
        } else {
            return this.Double().concat(this.Triple());
        }
	};
	//find out tractors, triple cards don't count, return false if suit is 'mix'
	//put all findings in one object, under keys of tractors' length
	Select['Tractor'] = function() {
		if (this.Suit() === 'mix' || this.Double().length < 2) {
            return false;
        } else {
			var tractors = {};
			for (var i = 0; i < this.Double().length; i++) {
				var a = this.Double()[i];
				var found = [];
				var b = this.Double().find(function(v) { return create_card(v).Value() === create_card(a).Value() + 1; });
				if (b === undefined) {
                    continue;
                } else {
					found.push(a);
					while (b !== undefined) {
						a = b;
						found.push(a);
						b = this.Double().find(function(v) { return create_card(v).Value() === create_card(a).Value() + 1; });
					}
					var len = found.length;
					if (tractors.hasOwnProperty(len)) {
                        tractors[len].push(found);
                    } else {
                        tractors[len] = [found];
                    }
					i += (len - 1);
				}
			}
			return Object.keys(tractors).length === 0 ? false : tractors;
		}	
	};
	//find out all tractors, triple cards count, return false if suit is 'mix'
	//put all findings in one object, under keys of tractors' length
	Select['AllTractor'] = function() {
		if (this.Suit() === 'mix' || this.Tri_Double().length < 2) {
            return false;
        } else {
			var alltractors = {};
			for (var i = 0; i < this.Tri_Double().length; i++) {
				var a = this.Tri_Double()[i];
				var found = [];
				var b = this.Tri_Double().find(function(v) { return create_card(v).Value() === create_card(a).Value() + 1; });
				if (b == undefined) {
                    continue;
                } else {
					found.push(a);
					while (b !== undefined) {
						a = b;
						found.push(a);
						b = this.Tri_Double().find(function(v) { return create_card(v).Value() === create_card(a).Value() + 1; });
					}
					var len = found.length;
					if (alltractors.hasOwnProperty(len)) {
                        alltractors[len].push(found);
                    } else {
                        alltractors[len] = [found];
                    }
					i += (len - 1);
				}
			}
			return Object.keys(alltractors).length === 0 ? false : alltractors;
		}	
	};
	//find out all tritractors, return false if suit is 'mix'
	//put all findings in one object, under keys of tritractors' length
	Select['Tritractor'] = function() {
		if (this.Suit() == 'mix' || this.Triple().length < 2) {
            return false;
        } else {
			var tritractors = {};
			for (var i = 0; i < this.Triple().length; i++) {
				var a = this.Triple()[i];
				var found = [];
				var b = this.Triple().find(function(v) { return create_card(v).Value() === create_card(a).Value() + 1; });
				if (b === undefined) {
                    continue;
                } else {
					found.push(a);
					while (b !== undefined) {
						a = b;
						found.push(a);
						b = this.Triple().find(function(v) { return create_card(v).Value() === create_card(a).Value() + 1; });
					}
					var len = found.length;
					if (tritractors.hasOwnProperty(len)) {
                        tritractors[len].push(found);
                    } else {
                        tritractors[len] = [found];
                    }
                    i += (len - 1);
				}
			}
			return Object.keys(tritractors).length === 0 ? false : tritractors;
		}	
	};
	//return selection's type, return 'fool' if suit is 'mix', return dump is selection has no type
	Select['Type'] = function() {
		if (this.Suit() === 'mix') {
            return 'fool';
        } else if (this.Length() === 1) {
            return 'single';
        } else if (this.Length() === 2 && this.Double().length > 0) {
            return 'double';
        } else if (this.Length() === 3 && this.Triple().length > 0) {
            return 'triple';       
        } else if (Object.keys(this.Tractor()).length === 1 && Object.entries(this.Tractor())[0][1][0].length * 2 === this.Length()) {
            return 'tractor';
            //tractor has only one key, elements under this key times 2 equals tractor's length.
        } else if (Object.keys(this.Tritractor()).length === 1 && Object.entries(this.Tritractor())[0][1][0].length * 3 === this.Length()) {
            return 'tritractor';
            //tritractor has only one key, elements under this key times 3 equals tritractor's length.
        } else {
            return 'dump';
        }
	};
	//return the top value card of a selection if it has a type, return false if type is 'dump' or suit is 'mix'
	Select['Top'] = function() {
		if (this.Suit() === 'mix' || this.Type() === 'dump') {
            return false;
        } else {
            return this.Sort().slice(-1)[0];
        }
	};
	//find out a dump's details, return false if type is not 'dump' or suit is 'mix'
	//tritractors, tractors and singles can be accessed directly, doubles should minus tractor elements and triples should minus tritractor elements
	Select['Dump'] = function() {
		if (this.Suit() === 'mix') {
            return false;
        } else {
			var all = {};
			if (this.Tritractor()) {
                all['Tritractor'] = this.Tritractor();
            }
            if (this.Tractor()) {
                all['Tractor'] = this.Tractor();
            }
			var ttr = this.Tritractor();
			var tri = this.Triple().slice();
			Object.keys(ttr).forEach(function(k){ ttr[k].forEach(function(v){ tri = $(tri).not(v).get(); }); });
			if (tri.length > 0) {
                all['Triple'] = tri;
            }
			var tr = this.Tractor();
			var db = this.Double().slice();
			Object.keys(tr).forEach(function(k){ tr[k].forEach(function(v){ db = $(db).not(v).get(); }); });
			if (db.length > 0) {
                all['Double'] = db;
            }
			if (this.Single().length > 0) {
                all['Single'] = this.Single();
            }
			return all;
		}
	};
	//generate a string to describe the selection's pattern
	//like 3330330302222022202010 for a selection which has a 3-tritractor, a 2-tritractor, a triple, a 4-tractor, a 3-tractor, a double and a single
	//use this to compare dump to a killer dump, if a successful dump is played, only a 'M' suit dump with the same pattern can beat it
	Select['Pattern'] = function() {
		if (this.Suit() === 'mix') return false;
		else {
			var pattern = '';
			if (this.Dump().hasOwnProperty('Tritractor')) {
				var ttr = this.Dump().Tritractor;
				Object.keys(ttr).reverse().forEach(function(v) {
					for (var i = 0; i < ttr[v].length; i++) {
						pattern = pattern.concat('3'.repeat(v));
						pattern = pattern.concat('0');
					}
				});
			}
			if (this.Dump().hasOwnProperty('Triple')) {
                pattern = pattern.concat('30'.repeat(this.Dump().Triple.length));
            }
			if (this.Dump().hasOwnProperty('Tractor')) {
				var tr = this.Dump().Tractor;
				Object.keys(tr).reverse().forEach(function(v) {
					for (var i = 0; i < tr[v].length; i++) {
						pattern = pattern.concat('2'.repeat(v));
						pattern = pattern.concat('0');
					}
				});
			}
			if (this.Dump().hasOwnProperty('Double')) {
                pattern = pattern.concat('20'.repeat(this.Dump().Double.length));
            }
			if (this.Dump().hasOwnProperty('Single')) {
                pattern = pattern.concat('10'.repeat(this.Dump().Single.length));
            }
			return pattern;
		}
    };
    //return a object with every pattern signal as the key and every element belong that pattern as the value
	Select['Patterns'] = function() {
		if (this.Suit() === 'mix') {
            return false;
        } else {
			var pat = {};
            var copy = this.Sort();
            var m;
			while (create_select(copy).Tritractor()) {//{'2':[[S2,S3],[S6,S7]],'3':[[S9,S0,SJ]],...}
				m = Object.keys(create_select(copy).Tritractor())[Object.keys(create_select(copy).Tritractor()).length - 1];
				var ttr = create_select(copy).Tritractor()[m][create_select(copy).Tritractor()[m].length - 1];
				ttr = ttr.concat(ttr, ttr);
				var k = '3'.repeat(m);
				if (!pat.hasOwnProperty(k)) {
                    pat[k] = [];
                }
				copy = array_minus(copy, ttr);
				pat[k].push(ttr);
			}
			while (create_select(copy).Triple().length > 0) {
				var tpl = create_select(copy).Triple()[create_select(copy).Triple().length - 1];
				if (!pat.hasOwnProperty('3')) {
                    pat['3'] = [];
                }
				copy = array_minus(copy, [tpl, tpl, tpl]);
				pat['3'].push([tpl, tpl, tpl]);
			}
			while (create_select(copy).Tractor()) {//{'2':[[S2,S3],[S6,S7]],'3':[[S9,S0,SJ]],...}
				m = Object.keys(create_select(copy).Tractor())[Object.keys(create_select(copy).Tractor()).length - 1];
				var tr = create_select(copy).Tractor()[m][create_select(copy).Tractor()[m].length - 1];
				tr = tr.concat(tr);
				k = '2'.repeat(m);
				if (!pat.hasOwnProperty(k)) {
                    pat[k] = [];
                }
				copy = array_minus(copy, tr);
				pat[k].push(tr);
			}
			while (create_select(copy).Double().length > 0) {
				var dbl = create_select(copy).Double()[create_select(copy).Double().length - 1];
				if (!pat.hasOwnProperty('2')) {
                    pat['2'] = [];
                }
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
//s1 s2 are simple patterns(contains no 0's) like: A('1'), AA('2'), AAA('3'), QQKKAA('222'), 000JJJ('33')
//cover means s1 pattern equals or contains s2 pattern. for example: AAA('3') covers KK('2'), 777888999('333') covers 4455('22') 
function cover (s1, s2) {
	if (s2.slice(0, 1) === '3') {
		if (s1.slice(0, 1) === '3' && s1.length >= s2.length) {
            return true;
        } else {
            return false;
        }
	} else if (s2.slice(0, 1) === '2') {
		if ((s1.slice(0, 1) === '2' && s1.length >= s2.length) || (s1.slice(0, 1) === '3' && s1.length >= s2.length)) {
            return true;
        } else {
            return false;
        }
	} else if (s2 === '1') {
		if (s1.length > 0) {
            return true;
        } else {
            return false;
        }
	} else {
        return true;
    }
}
//s1 pattern covers s2 pattern, returns what pattern left after s1 minus s2, for example:
//if s1 === s2, cover_left = empty array
//KKAA('22') cover_left QQ('2') = ['2'], QQQKKKAAA('333') cover_left JJJ('3') = ['33']
//AAA('3') cover_left KK('2') = ['1'], QQQKKKAAA('333') cover_left 9900JJ('222') = ['1','1','1']
//KKAA('22') cover_left 'Q'('1') = ['2','1'], JJJQQQKKKAAA('3333') cover_left 9900('22') = ['3','3','1','1']
//if s1 not cover s2 return false
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
//sort pattern in order: longest 3 > shortest 3 > longest 2 > shortest 2 > 1
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
//this function determines whether a complicated pattern p1 covers complicated pattern p2, for example:
//333>222010101, 3>201, 33>2201, 2>101, 3>201, 3>10101, 22>202, 22>20101, 33>303, 33>30201, 33>220101
function pattern_cover (p1, p2) {
    if (p1 === p2) {
        return true;
    } else if (p1.split('').reduce(function(t, v) { return t + parseInt(v); }, 0) < p2.split('').reduce(function(t, v) { return t + parseInt(v); }, 0)) {
        return false;//if p1 length < p2 length, return false
    } else {
		var a1 = p1.split('0');
		var a2 = p2.split('0');
		var b1 = array_minus(a1, a2);
		var b2 = array_minus(a2, a1);		
        var c2 = b2.sort(sortkey).reverse();
        var c1 = b1.sort(sortkey);
        while (c2.length !== 0) {
            var x = c1.find(function(v) {
                return cover(v, c2[0]);
            });
            if (x !== undefined) {
                c1 = array_minus(c1, [x]).concat(cover_left(x, c2[0]));
                c2 = array_minus(c2, [c2[0]]);
                var d1 = array_minus(c1, c2);
                var d2 = array_minus(c2, c1);
                c1 = d1;
                c2 = d2;
            } else {
                break;
            }
        }
        return c2.length === 0 ? true : false;
    }
}
//if a select has the same suit
function vali_same_suit (select) {
	if (select.length === 0) {
        return false;
    } else {
        return create_select(select).Suit() === 'mix' ? false : true;
    }
}
//validate a select is legal or not, and if it can beat the current winplay
function vali_select (select, winplay, hold, roundsuit) {
	var thisSelect = create_select(select);
	var RoundWin = create_select(winplay);
	var judge = false;
	if (thisSelect.Length() !== RoundWin.Length()) {//选牌与本轮出牌长度不同的情况
		return 'length must be the same';//警告：长度必须相等
	} else {//选牌与本轮出牌长度相同的情况
		if (thisSelect.Suit() !== roundsuit) {//选牌与本轮出牌长度相同但花色不同的情况
			if (array_minus(hold, select).length > 0) {//手牌减去选牌后仍然有同花色牌的情况
				return 'still have ' + roundsuit + ' suit, have to play same suit.';//警告：仍有该花色手牌，必须打出
			} else {//手牌减去选牌后无同花色牌的情况
				if (thisSelect.Suit() !== 'M') {//选牌非主的情况
                    judge = -1;//非主选牌必输
                } else {//选牌为主的情况
					if (thisSelect.Type() !== RoundWin.Type()) {//选牌与胜牌牌型不同的情况
                        judge = -1;//牌型不符选牌必输
                    } else {//选牌与胜牌牌型相同的情况
						if (RoundWin.Suit() !== 'M') {//胜牌非主的情况
                            judge = 1;//选牌是合法的，且是唯一的主杀，选牌胜
                        } else {//胜牌为主的情况
                            judge = create_card(thisSelect.Top()).Value() > create_card(RoundWin.Top()).Value() ? 1 : -1;
                            //胜牌和选牌都合法，且都是主杀，比较最高牌值大小决定胜负
                        }
                    }
				}
				return judge;
			}
		} else {//选牌与本轮出牌长度、花色都相同的情况
			if (thisSelect.Type() === RoundWin.Type()) {//选牌与胜牌长度、花色、牌型都相同的情况
				if (thisSelect.Suit() !== RoundWin.Suit()) {//选牌与胜牌花色不同的情况
                    judge = -1;//选牌与本轮出牌花色相同但不为主杀，而胜牌为主杀，因此选牌必输
                } else {//选牌、胜牌、本轮出牌长度、花色、牌型都相同的情况
                    judge = create_card(thisSelect.Top()).Value() > create_card(RoundWin.Top()).Value() ? 1 : -1;
                    //比较最高牌值大小决定胜负
                }
				return judge;
			} else {//选牌与胜牌长度、花色相同，但牌型不同的情况
				//牌型不同选牌必输，需要进一步判定手牌中是否真的没有应出牌型可以打出
				if (RoundWin.Type() === 'tritractor') {//牌型是三拖拉的情况，有三拖拉机出三拖拉机，否则有拖拉机出拖拉机，否则有三张出三张，否则有对出对
					if (Object.keys(create_select(hold).Tritractor()).some(function(v) { return v - Object.keys(RoundWin.Tritractor())[0] >= 0; })) {
                        //手牌中存在比胜牌等长或更长的三拖拉机的情况
                        return 'have longer tritractor, must play it';//警告：有等长或更长的三拖拉机就必须打出
                    } else {//手牌中三拖拉机长度比胜牌中的小（甚至没有三拖拉机）的情况
						if (create_select(hold).Triple().length * 3 < RoundWin.Length()) {//手牌中三张的牌数小于胜牌牌数的情况（不能剩余三张，还要做到有对出对）
							if (create_select(array_minus(hold, select).concat(thisSelect.Single(), thisSelect.Double())).Triple().length > 0) {
                                //剩余手牌加上选牌中的单牌、对牌，能拼凑出三张的情况（说明剩余手牌中仍有三张或玩家把三张拆开出）
                                return 'still have triples and break triple is not allowed';//警告：仍有三张，或明明有三张却拆开出，使得三张数不够，这样是不允许的
                            } else {//剩余手牌加上选牌中的单牌、对牌，不能拼凑出三张的情况（说明剩余手牌中没有三张并且玩家没有拆开三张）
								if (thisSelect.Single().length < 2) {//选牌中单牌数不到2张的情况（不可能存在有对不出对的情况）
                                    return -1;
                                } else {//选牌中单牌数超过或等于2张的情况（可能存在有对不出对的情况）
									if (create_select(array_minus(hold, select).concat(thisSelect.Single())).Double().length > 0) {
                                        //剩余手牌加上选牌中的单牌，能拼凑出对牌的情况（说明剩余手牌中仍有对牌或玩家把对牌拆开出）
                                        return 'still have doubles and break double is not allowed';//警告：仍有对牌，或明明有对牌却拆开出，使得对牌数不够，这样是不允许的
                                    } else {//剩余手牌加上选牌中的单牌，不能拼凑出对牌的情况（说明剩余手牌中没有对牌并且玩家把对牌拆开出）
                                        return -1;
                                    }
								}
							}
						} else {//手牌中三张的牌数大于或等于胜牌牌数的情况（选牌必须全是三张）
							if (thisSelect.Double().length > 0 || thisSelect.Single().length > 0) {//选牌中含有对牌或单牌的情况
                                return 'still have triples, must play triple';//警告：仍有三张，必须打出
                            } else {//选牌中无对牌或单牌的情况
								if (thisSelect.Tritractor()) {//选牌中含有三拖拉机的情况
                                    return -1;
                                } else {//选牌中不含有三拖拉机的情况
									if (create_select(hold).Tritractor()) {//手牌中含有三拖拉机的情况
                                        return 'have tritractor, must play it';//警告：有三拖拉机就要出三拖拉机
                                    } else {//手牌中不含有三拖拉机的情况
                                        return -1;
                                    }
								}
							}
						}
					}
				} else if (RoundWin.Type() === 'tractor') {//牌型是拖拉的情况，有拖拉机出拖拉机，否则有对出对
					if (Object.keys(create_select(hold).Tractor()).some(function(v) { return v - Object.keys(RoundWin.Tractor())[0] >= 0; })) {
                        //手牌中存在比胜牌等长或更长的拖拉机的情况
                        return 'have longer tractor, must play it';
                    } else {//手牌中拖拉机长度比胜牌中的小（甚至没有拖拉机）的情况
						if (create_select(hold).Double().length * 2 < RoundWin.Length()) {//手牌中对牌的牌数小于胜牌牌数的情况（不能剩余对牌）
							if (create_select(array_minus(hold, select).concat(thisSelect.Single())).Double().length > 0) {
                                //剩余手牌加上选牌中的单牌，能拼凑出对牌的情况（说明剩余手牌中仍有对牌或玩家把对牌拆开出）
                                return 'still have doubles and break double is not allowed';//警告：仍有对牌，或明明有对牌却拆开出，使得对牌数不够，这样是不允许的
                            } else {//剩余手牌加上选牌中的单牌，不能拼凑出对牌的情况（说明剩余手牌中没有对牌并且玩家把对牌拆开出）
                                return -1;
                            }
						} else {//手牌中对牌的牌数大于或等于胜牌牌数的情况（选牌必须全是对牌）
							if (thisSelect.Single().length > 0)	{//选牌中含有单牌的情况
                                return 'still have doubles, must play double';//警告：仍有对牌，必须打出
                            } else {//选牌中无单牌的情况
								if (thisSelect.Tractor()) {//选牌中含有拖拉机的情况
                                    return -1;
                                } else {//选牌中不含有拖拉机的情况
									if (create_select(hold).Tractor()) {//手牌中含有拖拉机的情况
                                        return 'have tractor, must play it';//警告：有拖拉机就要出拖拉机
                                    } else {//手牌中不含有拖拉机的情况
                                        return -1;
                                    }
								}
							}
						}
					}
				} else if (RoundWin.Type() === 'triple') {//牌型是三张的情况，有三张出三张，否则有对出对
					if (create_select(hold).Triple().length > 0) {//手牌有三张的情况
                        return 'have triple, must play it';//警告：有三张必须出三张
                    } else {//手牌没有三张的情况
						if (thisSelect.Double().length > 0) {//选牌有对牌的情况
                            return -1;
                        } else {//选牌没有对牌的情况
							if (create_select(hold).Double().length > 0) {//手牌有对牌的情况
                                return 'have double, must play it';//警告：有对牌必须出对牌
                            } else {//手牌无对牌的情况
                                return -1;
                            }
						}
					}
				} else if (RoundWin.Type() === 'double') {//牌型是对牌的情况，有对牌出对牌
					if (create_select(hold).Double().length > 0) {//手牌有对牌的情况
                        return 'have double, must play it';//警告：有对牌必须出对牌
                    } else {//手牌无对牌的情况
                        return -1;
                    }
				}//单牌不可能牌型不同
			}
		}
	}
}
//in playtype='dump' situation, validate a play is legal or not, and if it can beat the winplay
function vali_dump (play, dump, winplay, hold) {
	var thisPlay = create_select(play);//选牌
	var theDump = create_select(dump);//原始甩牌
	var RoundWin = create_select(winplay);//胜牌
	var thisHold = create_select(hold);//手牌
	var judge;//判定
	if (thisPlay.Length() !== theDump.Length()) {//选牌与原始甩牌长度不一致的情况
		judge = 'length must be the same';//警告：长度必须一致
		console.log(judge);
	} else {
		if (thisPlay.Suit() === theDump.Suit()) {//选牌与原始甩牌花色一致的情况
			if (array_minus(hold, play).length === 0) {//除去选牌后不剩下手牌的情况
				judge = -1;//手牌都出完了，不用判定合法性，因为甩牌已经验证为成功甩牌，因此同花色选牌必输
				console.log(judge);
			} else {//除去选牌后仍有手牌剩余的情况
				judge = -1;//甩牌已经验证为成功甩牌，因此同花色选牌必输，仍须验证合法性
				if (theDump.Tritractor()) {//原始甩牌中含有三拖拉机的情况
					if (thisHold.Tritractor()) {//手牌中含有三拖拉机的情况
						if (!thisPlay.Tritractor()) {//选牌中不含有三拖拉机的情况
							judge = "have tritractor, must play it";//警告：有三拖拉机，必须打出
						} else {//选牌中含有三拖拉机的情况，需要验证三拖拉机数是否合法，三拖拉机长度是否合法
							var triNumDump = 0;//原始甩牌中含有的三拖拉机数
							var triNumHold = 0;//手牌中含有的三拖拉机数
							var triNumPlay = 0;//选牌中含有的三拖拉机数
							Object.keys(theDump.Tritractor()).forEach(function(v) {
								triNumDump += theDump.Tritractor()[v].length;
							});
							Object.keys(thisHold.Tritractor()).forEach(function(v) {
								triNumHold += thisHold.Tritractor()[v].length;
							});
							Object.keys(thisPlay.Tritractor()).forEach(function(v) {
								triNumPlay += thisPlay.Tritractor()[v].length;
							});
							if (triNumPlay < triNumDump && triNumPlay < triNumHold) {//选牌中含有的三拖拉机数比原始甩牌和手牌中的都少的情况
								judge = 'have more tritractors, must play it';//警告：有更多的三拖拉机，必须打出
							}
                            //原始甩牌，手牌和选牌中最长的三拖拉机的长度
							var topKeyDump = Object.keys(theDump.Tritractor())[Object.keys(theDump.Tritractor()).length - 1];
							var topKeyHold = Object.keys(thisHold.Tritractor())[Object.keys(thisHold.Tritractor()).length - 1];
							var topKeyPlay = Object.keys(thisPlay.Tritractor())[Object.keys(thisPlay.Tritractor()).length - 1];
							if (topKeyPlay < topKeyDump && topKeyPlay < topKeyHold) {//选牌中最长三拖拉机的长度比原始甩牌和手牌中的都小的情况
								judge = 'have longer tritractor, must play it';//警告：有更长的三拖拉机，必须打出
							}
						}
					}
                }
                if (theDump.AllTractor()) {//原始甩牌中含有拖拉机或三拖拉机的情况
					if (thisHold.AllTractor()) {//手牌中含有拖拉机或三拖拉机的情况
						if (!thisPlay.AllTractor()) {//选牌中不含有拖拉加或三拖拉机的情况
							judge = "have tractor or tritractor, must play it";//警告：有拖拉机或三拖拉机，必须打出
						} else {//选牌中含有拖拉机或三拖拉机的情况，需要验证拖拉机或三拖拉机数是否合法，拖拉机或三拖拉机长度是否合法
							var traNumDump = 0;//原始甩牌中含有的拖拉机或三拖拉机数
							var traNumHold = 0;//手牌中含有的拖拉机或三拖拉机数
							var traNumPlay = 0;//选牌中含有的拖拉机或三拖拉机数
							Object.keys(theDump.AllTractor()).forEach(function(v) {
								traNumDump += theDump.AllTractor()[v].length;
							});
							Object.keys(thisHold.AllTractor()).forEach(function(v) {
								traNumHold += thisHold.AllTractor()[v].length;
							});
							Object.keys(thisPlay.AllTractor()).forEach(function(v) {
								traNumPlay += thisPlay.AllTractor()[v].length;
							});
							if (traNumPlay < traNumDump && traNumPlay < traNumHold) {//选牌中含有的拖拉机或三拖拉机数比原始甩牌和手牌中的都少的情况
								judge = 'have more tractors or tritractors, must play it';//警告：有更多的拖拉机或三拖拉机，必须打出
							}
                            //原始甩牌，手牌和选牌中最长的拖拉机或三拖拉机的长度
							var topKeyDump = Object.keys(theDump.AllTractor())[Object.keys(theDump.AllTractor()).length - 1];
							var topKeyHold = Object.keys(thisHold.AllTractor())[Object.keys(thisHold.AllTractor()).length - 1];
							var topKeyPlay = Object.keys(thisPlay.AllTractor())[Object.keys(thisPlay.AllTractor()).length - 1];
							if (topKeyPlay < topKeyDump && topKeyPlay < topKeyHold) {//选牌中最长的拖拉机或三拖拉机的长度比原始甩牌和手牌中的都小的情况
								judge = 'have longer tractor or tritractor, must play it';//警告：有更长的拖拉机或三拖拉机，必须打出
							}
						}
					}
				}
				if (theDump.Tritractor() && thisHold.Tritractor() && !thisPlay.Tritractor()) {//原始甩牌和手牌中有三拖拉机，而选牌中没有的情况
					judge = "have tritractor, must play it";//警告：有三拖拉机，必须打出
				}
				if (theDump.Tractor() && thisHold.Tractor() && !thisPlay.Tractor()) {//原始甩牌和手牌中有拖拉机，而选牌中没有的情况
					judge = "have tractor, must play it";//警告：有拖拉机，必须打出
				}
				if (theDump.Triple().length > 0) {//原始甩牌中含有三张的情况，需要验证，有三张出足够三张，没有三张出足够对牌
                    if (thisHold.Triple().length >= theDump.Triple().length) {//手牌中的三张数大于等于原始甩牌中的三张数的情况
                        if (thisPlay.Triple().length < theDump.Triple().length) {//选牌中三张数小于原始甩牌中三张数的情况
						    judge = "have triple, must play it";//警告：有足够的三张，必须出够
                        } 
                    } else {//手牌中的三张数小于原始甩牌中的三张数的情况
                        if (thisHold.Triple().length !== thisPlay.Triple().length) {//手牌中和选牌中的三张数不一致的情况，说明三张没出完
							judge = "still have triple, must play it";//警告，仍有三张，必须出完
						}
                    }
				}
				if (theDump.Tri_Double().length > 0) {//原始甩牌中含有对牌或三张的情况
					if (thisPlay.Tri_Double().length < theDump.Tri_Double().length) {//选牌中对牌加三张数小于原始甩牌中对牌加三张数的情况
                        if (thisHold.Tri_Double().length >= theDump.Tri_Double().length) {//手牌中的对牌加三张数大于等于原始甩牌中对牌加三张数的情况
                            judge = "have double or triple, must play enough double or triple"//警告：有足够的对牌或三张，必须出够
                        } else {//手牌中的对牌加三张数小于原始甩牌中对牌加三张数的情况
                            if (thisHold.Tri_Double().length !== thisPlay.Tri_Double().length) {//手牌中和选牌中的对牌加三张数不一致的情况，说明对牌或三张没出完
                                judge = "still have double or triple, must play it";//警告，仍有对牌或三张，必须出完
                            }
                        }
                    }
				}
				console.log(judge);
			}
		} else {//选牌与原始甩牌花色不一致的情况
			if (array_minus(hold, play).length > 0) {//除去选牌后仍然有手牌剩下的情况
				judge = 'still have ' + theDump.Suit() + ' suit, must play same suit';//警告：仍然有该花色，必须出同花色
				console.log(judge);
			} else {//除去选牌后没有手牌剩下的情况，因为花色不同，因此一定是合法的
				if (thisPlay.Suit() !== 'M') {//选牌花色不是主的情况，非主的选牌不可能胜过成功的甩牌，选牌为负
					judge = -1;
				} else {//选牌花色是主的情况，有可能是主杀，要分析牌型是否符合，并与胜牌比较大小
					if (!pattern_cover(thisPlay.Pattern(), theDump.Pattern())) {//选牌牌型无法包含原始甩牌牌型的情况，不是成功的主杀，选牌为负
						judge = -1;
					}
					else {//选牌牌型包含原始甩牌牌型，是成功的主杀，必进一步与胜牌比较大小
						if (RoundWin.Suit() !== 'M') {//胜牌花色非主的情况，选牌是唯一成功的主杀，选牌为胜
                            judge = 1;
                        } else {//胜牌花色为主的情况，存在两个主杀（主牌甩牌也算），直接比较选牌与胜牌的大小即可
							if (theDump.Tritractor()) {//原始甩牌中含有三拖拉机的情况，m是原始甩牌的最长三拖拉机长度，比较选牌和胜牌最长三拖拉机的最大牌哪个大
								var m = Object.keys(theDump.Tritractor())[Object.keys(theDump.Tritractor()).length - 1];
								judge = create_card(thisPlay.Tritractor()[m][thisPlay.Tritractor()[m].length - 1][m-1]).Value() 
									- create_card(RoundWin.Tritractor()[m][RoundWin.Tritractor()[m].length - 1][m-1]).Value();
							} else if (theDump.Triple().length > 0) {//原始甩牌中含有三张的情况，比较选牌和胜牌的最大三张哪个大
								judge = create_card(thisPlay.Triple()[thisPlay.Triple().length - 1]).Value() 
									- create_card(RoundWin.Triple()[RoundWin.Triple().length - 1]).Value();
							} else if (theDump.Tractor()) {//原始甩牌中含有拖拉机的情况，m是原始甩牌的最长拖拉机长度，比较选牌和胜牌最长拖拉机或三拖拉机的最大牌哪个大
								var m = Object.keys(theDump.Tractor())[Object.keys(theDump.Tractor()).length - 1];
								judge = create_card(thisPlay.AllTractor()[m][thisPlay.AllTractor()[m].length - 1][m-1]).Value() 
									- create_card(RoundWin.AllTractor()[m][RoundWin.AllTractor()[m].length - 1][m-1]).Value();
							} else if (theDump.Double().length > 0) {//原始甩牌中含有对牌的情况，比较选牌和胜牌的最大对牌或三张哪个大
								judge = create_card(thisPlay.Tri_Double()[thisPlay.Tri_Double().length - 1]).Value() 
									- create_card(RoundWin.Tri_Double()[RoundWin.Tri_Double().length - 1]).Value();
							} else {//原始甩牌中只含有单牌的情况，比较选牌和胜牌的最大牌哪个大
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
//compare dump and hold, see if hold has any card that can beat dump in specific pattern
//1. compare single, if hold has single bigger than dump's smallest single, restCard is an array with dump's smallest single
//2. compare double, if hold has double or triple bigger than dump's smallest double, restCard is an array with dump's smallest double
//3. compare triple, if hold has triple bigger than dump's smallest triple, restCard is an array with dump's smallest triple
//4. compare tractor, if hold has tractor or tritractor bigger than dump's smallest tractor, restCard is an array with dump's smallest tractor
//5. compare tritractor, if hold has tritractor bigger than dump's smallest tritractor, restCard is an array with dump's smallest tritractor
//if one of the conditions above was met, return restCard, if none was met, return false
function challenge_dump (dump, hold) {
    var thisSelect = create_select(dump);
    var sgl;
    sgl = thisSelect.Single()[0];
    var dbl;
	if (thisSelect.Dump().Double !== undefined) {
        dbl = thisSelect.Dump().Double[0];
    } else {
        dbl = undefined;
    }
    var tpl;
	if (thisSelect.Dump().Triple !== undefined) {
        tpl = thisSelect.Dump().Triple[0];
    } else {
        tpl = undefined;
    }
	var tr = thisSelect.Tractor();
	var ttr = thisSelect.Tritractor();
	var restCard = false;
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
    return restCard ? restCard : false;
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