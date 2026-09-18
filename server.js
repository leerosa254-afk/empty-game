const path = require('path');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingTimeout: 20000, pingInterval: 10000 });
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const ROUND_SECONDS = 75;
const REVEAL_SECONDS = 10;
const MAX_PLAYERS = 35;

const EMOTIONS = [
  ['분노','😡'],['억울함','😤'],['서운함','😞'],['배신감','💔'],['소외감','😔'],
  ['외로움','🥺'],['질투','😒'],['당황스러움','😳'],['창피함','🫣'],['불안함','😰'],
  ['부담감','😣'],['막막함','😵‍💫'],['답답함','😩'],['미안함','😔'],['안도감','😌'],
  ['뿌듯함','😊'],['설렘','🤩'],['기대감','😆'],['놀라움','😮'],['고마움','🥹']
].map(([name, emoji]) => ({ name, emoji }));

const SITUATIONS = {
  '분노':['친구가 싫다고 한 별명으로 계속 부른다.','친구가 내 물건을 허락 없이 사용했다.','친구가 자기 실수를 내 탓이라고 한다.'],
  '억울함':['하지 않은 장난 때문에 선생님께 혼났다.','모둠 친구가 자기가 안 한 일을 내가 안 했다고 말한다.','친구 둘의 싸움이 내 탓이라고 오해받는다.'],
  '서운함':['친한 친구가 내 생일을 잊었다.','내가 힘든 걸 알면서 친구가 아무 말도 하지 않는다.','늘 같이 가던 친구가 다른 친구와 먼저 가버렸다.'],
  '배신감':['친구에게만 말한 비밀이 반 친구들에게 알려졌다.','내 편을 들겠다던 친구가 다른 사람 앞에서 말을 바꿨다.','친구가 나와 한 약속을 몰래 다른 친구와 해버렸다.'],
  '소외감':['단톡방에서 나만 모르는 이야기로 친구들이 웃는다.','모둠을 정할 때 아무도 먼저 같이 하자고 하지 않는다.','친구들이 나를 빼고 놀 계획을 세운다.'],
  '외로움':['쉬는 시간인데 이야기할 친구가 보이지 않는다.','힘든 일을 누구에게 이야기해야 할지 모르겠다.','친구들 사이에 있어도 나를 이해하는 사람이 없는 것 같다.'],
  '질투':['단짝이 요즘 다른 친구와 더 많이 다닌다.','내가 좋아하는 친구가 다른 친구에게만 관심을 보인다.','나보다 늦게 시작한 친구가 칭찬을 더 많이 받는다.'],
  '당황스러움':['수업 중 선생님이 갑자기 나를 지목했다.','친구에게 보낼 메시지를 단체방에 잘못 보냈다.','복도에서 넘어졌는데 모두가 나를 쳐다봤다.'],
  '창피함':['발표하다가 내용을 완전히 잊어버렸다.','체육 시간에 혼자 엉뚱한 방향으로 뛰었다.','조용한 교실에서 내 알림음이 크게 울렸다.'],
  '불안함':['시험 결과가 곧 발표된다.','중요한 이야기를 보낸 친구에게 답장이 오지 않는다.','선생님이 수업 후 잠깐 남으라고 했다.'],
  '부담감':['부모님이 이번 시험은 꼭 성적을 올리라고 한다.','친구들이 반장 선거에 꼭 나가라고 한다.','모둠 친구들이 발표를 전부 나에게 맡긴다.'],
  '막막함':['내일까지 수행평가인데 아직 시작하지 못했다.','시험 범위를 보니 공부할 내용이 너무 많다.','친구와 크게 싸운 뒤 어떻게 말을 걸지 모르겠다.'],
  '답답함':['설명해도 친구가 내 말을 믿어주지 않는다.','부모님께 내 생각을 말해도 같은 대답만 하신다.','오해를 풀고 싶은데 상대가 대화를 피한다.'],
  '미안함':['내 실수 때문에 모둠 전체가 과제를 다시 해야 한다.','화가 나서 친구에게 심한 말을 했다.','친구가 기다리고 있었는데 약속을 깜빡했다.'],
  '안도감':['잃어버린 줄 알았던 휴대전화를 가방에서 찾았다.','지각한 줄 알고 뛰었는데 수업 전이었다.','걱정한 수행평가 결과가 생각보다 괜찮았다.'],
  '뿌듯함':['어려운 문제를 처음으로 혼자 풀었다.','내가 도와준 친구가 고맙다고 말했다.','열심히 준비한 발표를 잘 끝냈다.'],
  '설렘':['좋아하는 친구와 우연히 같은 모둠이 됐다.','기다리던 수학여행이 바로 내일이다.','꼭 가고 싶던 공연 티켓이 생겼다.'],
  '기대감':['다음 주에 학교 축제가 열린다.','친구들과 주말에 처음 놀러 가기로 했다.','내가 좋아하는 동아리에 합격했다.'],
  '놀라움':['생각하지 못한 친구에게 생일 선물을 받았다.','조용하던 친구가 장기자랑에서 멋진 공연을 했다.','선생님이 갑자기 오늘 수행평가가 없다고 했다.'],
  '고마움':['혼자 있을 때 친구가 먼저 다가와줬다.','준비물을 잊었는데 친구가 자기 것을 나눠줬다.','힘든 이야기를 했더니 친구가 끝까지 들어줬다.']
};

const RELATED = {
  '분노':['억울함','답답함','배신감','서운함'],'억울함':['분노','답답함','서운함','불안함'],
  '서운함':['배신감','소외감','외로움','질투'],'배신감':['분노','서운함','창피함','불안함'],
  '소외감':['외로움','서운함','질투','불안함'],'외로움':['소외감','서운함','불안함','막막함'],
  '질투':['서운함','소외감','분노','불안함'],'당황스러움':['창피함','불안함','놀라움','부담감'],
  '창피함':['당황스러움','불안함','부담감','미안함'],'불안함':['부담감','막막함','당황스러움','답답함'],
  '부담감':['불안함','막막함','답답함','당황스러움'],'막막함':['불안함','부담감','답답함','외로움'],
  '답답함':['억울함','분노','막막함','서운함'],'미안함':['창피함','불안함','서운함','부담감'],
  '안도감':['뿌듯함','고마움','기대감','놀라움'],'뿌듯함':['고마움','안도감','기대감','설렘'],
  '설렘':['기대감','뿌듯함','놀라움','고마움'],'기대감':['설렘','뿌듯함','놀라움','안도감'],
  '놀라움':['당황스러움','설렘','기대감','안도감'],'고마움':['뿌듯함','안도감','서운함','설렘']
};

function code() { let c; do c = Math.random().toString(36).slice(2,6).toUpperCase(); while (rooms.has(c)); return c; }
function token() { return crypto.randomBytes(18).toString('base64url'); }
function clean(v, n=30) { return String(v || '').trim().replace(/[<>]/g,'').slice(0,n); }
function publicPlayer(p) { return { id:p.id, name:p.name, avatar:p.avatar, score:p.score, isHost:p.isHost, connected:p.connected }; }
function playerBySocket(socket) {
  const room = rooms.get(socket.data.roomCode);
  return room && room.players.find(p => p.token === socket.data.token);
}
function publicRoom(room, viewer) {
  const g = room.game;
  const drawer = g && room.players.find(p => p.token === g.drawerToken);
  const reveal = g?.phase === 'reveal';
  const isDrawer = viewer?.token === g?.drawerToken;
  return {
    code:room.code, status:room.status, players:room.players.map(publicPlayer),
    game: !g ? null : {
      round:g.round, maxRounds:g.maxRounds, phase:g.phase, endsAt:g.endsAt,
      mode:g.mode, drawerId:drawer?.id, drawerName:drawer?.name,
      situation:g.problem.situation,
      emotion:(isDrawer || reveal) ? g.problem.emotion : null,
      choices:g.choices, clue:g.clue, guesses:g.guesses.size,
      selfCount:g.selfChoices.size, myGuess:g.guesses.has(viewer?.token),
      mySelfChoice:g.selfChoices.has(viewer?.token), distribution:reveal ? distribution(g) : null
    },
    me: viewer ? publicPlayer(viewer) : null
  };
}
function broadcast(room) {
  for (const p of room.players) if (p.socketId) io.to(p.socketId).emit('state', publicRoom(room,p));
}
function distribution(g) {
  const counts = Object.fromEntries(EMOTIONS.map(e => [e.name,0]));
  for (const arr of g.selfChoices.values()) for (const e of arr) if (counts[e] !== undefined) counts[e]++;
  return Object.entries(counts).filter(([,count])=>count).sort((a,b)=>b[1]-a[1]).map(([emotion,count])=>({emotion,count}));
}
function choicesFor(emotion) {
  const names = [emotion, ...(RELATED[emotion] || [])];
  const extras = EMOTIONS.map(e=>e.name).filter(x=>!names.includes(x)).sort(()=>Math.random()-.5);
  return [...names, ...extras].slice(0,6).sort(()=>Math.random()-.5);
}
function emitError(socket, msg) { socket.emit('errorMsg', msg); }
function cancelTimers(room) { clearTimeout(room.phaseTimer); room.phaseTimer = null; }

function beginRound(room) {
  cancelTimers(room);
  if (room.game.round >= room.game.maxRounds) {
    room.status = 'finished'; room.game = null; broadcast(room); return;
  }
  const active = room.players.filter(p=>p.connected);
  if (active.length < 2) { room.status='waiting'; room.game=null; broadcast(room); return; }
  const round = room.game.round + 1;
  const drawer = active[(round-1) % active.length];
  const emotion = EMOTIONS[(room.deck.pop() ?? 0) % EMOTIONS.length].name;
  const situations = SITUATIONS[emotion];
  const problem = { emotion, situation:situations[Math.floor(Math.random()*situations.length)] };
  room.game = {
    round, maxRounds:room.maxRounds, phase:'express', mode:['말','이모지','행동·대사','그림','자유표현'][(round-1)%5],
    drawerToken:drawer.token, problem, choices:choicesFor(emotion), clue:'', guesses:new Map(),
    reasons:new Map(), selfChoices:new Map(), endsAt:Date.now()+ROUND_SECONDS*1000
  };
  room.status='playing'; broadcast(room);
  room.phaseTimer=setTimeout(()=>revealRound(room,'시간이 끝났어요.'), ROUND_SECONDS*1000);
}
function revealRound(room, reason='모두 선택했어요.') {
  if (!room.game || room.game.phase === 'reveal') return;
  cancelTimers(room); room.game.phase='reveal'; room.game.endsAt=Date.now()+REVEAL_SECONDS*1000;
  room.game.revealReason=reason; broadcast(room);
  room.phaseTimer=setTimeout(()=>beginRound(room), REVEAL_SECONDS*1000);
}
function maybeReveal(room) {
  if (!room.game || room.game.phase !== 'express') return;
  const guessers = room.players.filter(p=>p.connected && p.token!==room.game.drawerToken);
  const everyoneGuessed = guessers.length && guessers.every(p=>room.game.guesses.has(p.token));
  const everyoneReflected = guessers.every(p=>room.game.selfChoices.has(p.token));
  if (everyoneGuessed && everyoneReflected) revealRound(room);
}

io.on('connection', socket => {
  socket.on('createRoom', data => {
    const name=clean(data?.name); if(!name) return emitError(socket,'이름을 입력해 주세요.');
    const roomCode=code(), p={token:token(),id:socket.id,socketId:socket.id,name,avatar:clean(data.avatar,4)||'🙂',score:0,isHost:true,connected:true};
    const room={code:roomCode,status:'waiting',players:[p],game:null,maxRounds:5,deck:EMOTIONS.map((_,i)=>i).sort(()=>Math.random()-.5),phaseTimer:null};
    rooms.set(roomCode,room); socket.join(roomCode); socket.data={roomCode,token:p.token};
    socket.emit('session',{roomCode,playerToken:p.token}); broadcast(room);
  });
  socket.on('joinRoom', data => {
    const room=rooms.get(clean(data?.code,4).toUpperCase()); const name=clean(data?.name);
    if(!room) return emitError(socket,'방을 찾을 수 없습니다.');
    if(!name) return emitError(socket,'이름을 입력해 주세요.');
    if(room.players.length>=MAX_PLAYERS) return emitError(socket,'방이 가득 찼습니다.');
    if(room.status!=='waiting') return emitError(socket,'이미 게임이 시작되었습니다. 재접속만 가능합니다.');
    const p={token:token(),id:socket.id,socketId:socket.id,name,avatar:clean(data.avatar,4)||'🙂',score:0,isHost:false,connected:true};
    room.players.push(p); socket.join(room.code); socket.data={roomCode:room.code,token:p.token};
    socket.emit('session',{roomCode:room.code,playerToken:p.token}); broadcast(room);
  });
  socket.on('resume', data => {
    const room=rooms.get(clean(data?.roomCode,4).toUpperCase()); const p=room?.players.find(x=>x.token===data?.playerToken);
    if(!room || !p) return socket.emit('resumeFailed');
    p.id=socket.id; p.socketId=socket.id; p.connected=true; socket.join(room.code); socket.data={roomCode:room.code,token:p.token};
    socket.emit('session',{roomCode:room.code,playerToken:p.token}); broadcast(room);
  });
  socket.on('startGame', ({rounds}={}) => {
    const room=rooms.get(socket.data.roomCode), p=playerBySocket(socket);
    if(!room||!p?.isHost) return; if(room.players.filter(x=>x.connected).length<2) return emitError(socket,'최소 2명이 필요합니다.');
    room.maxRounds=Math.min(20,Math.max(3,Number(rounds)||5)); room.deck=EMOTIONS.map((_,i)=>i).sort(()=>Math.random()-.5);
    room.game={round:0,maxRounds:room.maxRounds}; room.players.forEach(x=>x.score=0); beginRound(room);
  });
  socket.on('submitClue', ({clue}={}) => {
    const room=rooms.get(socket.data.roomCode), p=playerBySocket(socket); if(!room?.game||p?.token!==room.game.drawerToken) return;
    const value=clean(clue,100); if(!value) return;
    if(value.includes(room.game.problem.emotion)) return emitError(socket,'감정 정답 단어는 사용할 수 없습니다.');
    room.game.clue=value; broadcast(room);
  });
  socket.on('guess', ({emotion,reason}={}) => {
    const room=rooms.get(socket.data.roomCode), p=playerBySocket(socket), g=room?.game;
    if(!g||g.phase!=='express'||!p||p.token===g.drawerToken||g.guesses.has(p.token)||!g.choices.includes(emotion)) return;
    g.guesses.set(p.token,emotion); g.reasons.set(p.token,clean(reason,20));
    if(emotion===g.problem.emotion){p.score+=10; const d=room.players.find(x=>x.token===g.drawerToken); if(d)d.score+=3;}
    broadcast(room); maybeReveal(room);
  });
  socket.on('selfChoice', ({emotions}={}) => {
    const room=rooms.get(socket.data.roomCode), p=playerBySocket(socket), g=room?.game;
    if(!g||g.phase!=='express'||!p||g.selfChoices.has(p.token)||!Array.isArray(emotions)) return;
    const valid=[...new Set(emotions)].filter(x=>EMOTIONS.some(e=>e.name===x)).slice(0,2); if(!valid.length)return;
    g.selfChoices.set(p.token,valid); broadcast(room); maybeReveal(room);
  });
  socket.on('draw', data => {
    const room=rooms.get(socket.data.roomCode), p=playerBySocket(socket), g=room?.game;
    if(!g||p?.token!==g.drawerToken||!['그림','자유표현'].includes(g.mode))return;
    socket.to(room.code).emit('drawUpdate',data);
  });
  socket.on('clearCanvas',()=>{const room=rooms.get(socket.data.roomCode),p=playerBySocket(socket);if(room?.game&&p?.token===room.game.drawerToken)io.to(room.code).emit('canvasCleared');});
  socket.on('nextRound',()=>{const room=rooms.get(socket.data.roomCode),p=playerBySocket(socket);if(room?.game?.phase==='reveal'&&p?.isHost)beginRound(room);});
  socket.on('disconnect',()=>{
    const room=rooms.get(socket.data.roomCode),p=playerBySocket(socket); if(!room||!p)return;
    p.connected=false;p.socketId=null;
    if(p.isHost){const next=room.players.find(x=>x.connected);if(next){p.isHost=false;next.isHost=true;}}
    broadcast(room);
    setTimeout(()=>{if(room.players.every(x=>!x.connected)){cancelTimers(room);rooms.delete(room.code);}},30*60*1000);
  });
});

server.listen(PORT,()=>console.log(`Emotion Detective listening on ${PORT}`));
