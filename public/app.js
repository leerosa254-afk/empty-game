const socket=io({reconnection:true,reconnectionAttempts:Infinity});
const $=id=>document.getElementById(id), screens=['lobby','waiting','game','reveal','finished'];
const EMOTIONS=[['분노','😡'],['억울함','😤'],['서운함','😞'],['배신감','💔'],['소외감','😔'],['외로움','🥺'],['질투','😒'],['당황스러움','😳'],['창피함','🫣'],['불안함','😰'],['부담감','😣'],['막막함','😵‍💫'],['답답함','😩'],['미안함','😔'],['안도감','😌'],['뿌듯함','😊'],['설렘','🤩'],['기대감','😆'],['놀라움','😮'],['고마움','🥹']];
const emoji=name=>EMOTIONS.find(x=>x[0]===name)?.[1]||'💭';
let state=null, selectedGuess='',selectedReason='',selfSelected=[],countdown=null,lastRound=0;
const avatars=['🦊','🐶','🐱','🐼','🐯','🐰','🐹','🐨'];

function show(id){screens.forEach(x=>$(x).classList.toggle('active',x===id));}
function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2500);}
function saveSession(data){localStorage.setItem('emotionSession',JSON.stringify(data));}
function session(){try{return JSON.parse(localStorage.getItem('emotionSession'));}catch{return null}}
function safe(s){return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

$('create').onclick=()=>{const name=$('name').value.trim();if(!name)return toast('이름을 입력해 주세요.');socket.emit('createRoom',{name,avatar:avatars[Math.floor(Math.random()*avatars.length)]});};
$('join').onclick=()=>{const name=$('name').value.trim(),code=$('code').value.trim().toUpperCase();if(!name||!code)return toast('이름과 참여 코드를 입력해 주세요.');socket.emit('joinRoom',{name,code,avatar:avatars[Math.floor(Math.random()*avatars.length)]});};
$('start').onclick=()=>socket.emit('startGame',{rounds:Number($('rounds').value)});
$('sendClue').onclick=()=>{const clue=$('clue').value.trim();if(clue)socket.emit('submitClue',{clue});};
$('submitGuess').onclick=()=>{if(!selectedGuess||!selectedReason)return toast('감정과 판단 단서를 모두 선택해 주세요.');socket.emit('guess',{emotion:selectedGuess,reason:selectedReason});};
$('submitSelf').onclick=()=>{if(!selfSelected.length)return toast('나라면 느낄 감정을 1~2개 골라 주세요.');socket.emit('selfChoice',{emotions:selfSelected});};
$('next').onclick=()=>socket.emit('nextRound');
$('resume').onclick=()=>{const s=session();if(s)socket.emit('resume',s);};
$('reasons').onclick=e=>{if(e.target.tagName!=='BUTTON')return;selectedReason=e.target.textContent;[...$('reasons').children].forEach(b=>b.classList.toggle('selected',b===e.target));};

socket.on('connect',()=>{const s=session();if(s)socket.emit('resume',s);});
socket.on('session',s=>saveSession(s));
socket.on('resumeFailed',()=>{localStorage.removeItem('emotionSession');$('resume').classList.add('hidden');show('lobby');});
socket.on('errorMsg',toast);
socket.on('state',s=>{state=s;render();});

function render(){
  if(!state)return;
  if(state.status==='waiting'){renderWaiting();return;}
  if(state.status==='finished'){renderFinished();return;}
  const g=state.game;if(!g)return;
  if(g.round!==lastRound){lastRound=g.round;selectedGuess='';selectedReason='';selfSelected=[];clearCanvasLocal();}
  if(g.phase==='reveal'){renderReveal();return;} renderGame();
}
function renderWaiting(){show('waiting');$('roomCode').textContent=state.code;$('count').textContent=`(${state.players.length}명)`;
  $('players').innerHTML=state.players.map(p=>`<div class="player ${p.connected?'':'offline'}"><i>${p.avatar}</i><div>${p.isHost?'👑 ':''}${safe(p.name)}${p.id===state.me.id?' (나)':''}</div></div>`).join('');
  $('start').classList.toggle('hidden',!state.me.isHost);$('waitMsg').classList.toggle('hidden',state.me.isHost);
}
function renderGame(){show('game');const g=state.game,isDrawer=state.me.id===g.drawerId;
  $('round').textContent=`${g.round}/${g.maxRounds}`;$('drawer').textContent=g.drawerName;$('situation').textContent=g.situation;$('mode').textContent=g.mode;$('roleLabel').textContent=isDrawer?'당신이 이번 표현자예요':'친구의 감정을 추리해 보세요';
  $('secret').classList.toggle('hidden',!isDrawer);$('emotion').textContent=g.emotion||'';$('choiceArea').classList.toggle('hidden',isDrawer);
  const drawing=['그림','자유표현'].includes(g.mode);$('canvasBox').classList.toggle('hidden',!drawing);$('clueBox').classList.toggle('hidden',drawing&&g.mode==='그림');
  $('clueView').textContent=g.clue?`“${g.clue}”`:(isDrawer?'표현을 입력해 주세요.':'표현자의 단서를 기다리는 중…');
  $('clue').disabled=!isDrawer;$('sendClue').disabled=!isDrawer;
  if(drawing)setTimeout(resizeCanvas,30);
  renderChoices(g);startCountdown(g.endsAt);
}
function renderChoices(g){
  const guessed=g.myGuess,selfDone=g.mySelfChoice;
  $('choices').innerHTML=g.choices.map(e=>`<button class="choice ${selectedGuess===e?'selected':''}" data-e="${e}">${emoji(e)} ${e}</button>`).join('');
  $('choices').onclick=e=>{if(guessed)return;const b=e.target.closest('[data-e]');if(!b)return;selectedGuess=b.dataset.e;renderChoices(g);};
  $('allEmotions').innerHTML=EMOTIONS.map(([e,em])=>`<button class="emotion-chip ${selfSelected.includes(e)?'selected':''}" data-self="${e}">${em} ${e}</button>`).join('');
  $('allEmotions').onclick=e=>{if(selfDone)return;const b=e.target.closest('[data-self]');if(!b)return;const v=b.dataset.self;if(selfSelected.includes(v))selfSelected=selfSelected.filter(x=>x!==v);else if(selfSelected.length<2)selfSelected.push(v);else return toast('감정은 최대 2개까지 선택할 수 있어요.');renderChoices(g);};
  $('submitGuess').classList.toggle('hidden',guessed);$('submitSelf').classList.toggle('hidden',selfDone);
  $('guessDone').classList.toggle('hidden',!guessed);$('selfDone').classList.toggle('hidden',!selfDone);
}
function startCountdown(endsAt){clearInterval(countdown);const tick=()=>{$('timer').textContent=Math.max(0,Math.ceil((endsAt-Date.now())/1000));};tick();countdown=setInterval(tick,500);}
function renderReveal(){show('reveal');clearInterval(countdown);const g=state.game,total=Math.max(1,g.distribution.reduce((a,x)=>a+x.count,0));$('answer').innerHTML=`표현자가 전하려던 핵심 감정은 <b>${emoji(g.emotion)} ${safe(g.emotion)}</b>`;
  $('bars').innerHTML=g.distribution.length?g.distribution.map(x=>`<div class="bar-row"><b>${emoji(x.emotion)} ${safe(x.emotion)}</b><div class="track"><div class="fill" style="width:${Math.round(x.count/total*100)}%"></div></div><span>${Math.round(x.count/total*100)}%</span></div>`).join(''):'<p>아직 선택 결과가 없어요.</p>';
  renderScores('scores');$('next').classList.toggle('hidden',!state.me.isHost);startCountdown(g.endsAt);
}
function renderScores(id){$(id).innerHTML=[...state.players].sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="score">${i+1}. ${p.avatar} ${safe(p.name)} <b>${p.score}점</b></div>`).join('');}
function renderFinished(){show('finished');renderScores('finalScores');localStorage.removeItem('emotionSession');}

const canvas=$('canvas'),ctx=canvas.getContext('2d');let drawing=false,last=null,color='#172554',eraser=false;
function resizeCanvas(){const r=canvas.getBoundingClientRect(),snapshot=canvas.width?canvas.toDataURL():null;if(Math.round(r.width)===canvas.width&&Math.round(r.height)===canvas.height)return;canvas.width=Math.round(r.width);canvas.height=Math.round(r.height);ctx.lineCap='round';ctx.lineJoin='round';ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);if(snapshot){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);img.src=snapshot;}}
function pos(e){const r=canvas.getBoundingClientRect(),p=e.touches?.[0]||e;return{x:p.clientX-r.left,y:p.clientY-r.top};}
function line(d){ctx.beginPath();ctx.moveTo(d.x0*canvas.width,d.y0*canvas.height);ctx.lineTo(d.x1*canvas.width,d.y1*canvas.height);ctx.strokeStyle=d.erase?'#fff':d.color;ctx.lineWidth=d.erase?24:5;ctx.stroke();}
function down(e){if(state?.me.id!==state?.game?.drawerId)return;e.preventDefault();drawing=true;last=pos(e);}
function move(e){if(!drawing)return;e.preventDefault();const p=pos(e),d={x0:last.x/canvas.width,y0:last.y/canvas.height,x1:p.x/canvas.width,y1:p.y/canvas.height,color,erase:eraser};line(d);socket.emit('draw',d);last=p;}
function up(){drawing=false;last=null;}['mousedown','touchstart'].forEach(x=>canvas.addEventListener(x,down,{passive:false}));['mousemove','touchmove'].forEach(x=>canvas.addEventListener(x,move,{passive:false}));['mouseup','mouseleave','touchend'].forEach(x=>canvas.addEventListener(x,up));
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color;eraser=false;});$('eraser').onclick=()=>eraser=true;$('clear').onclick=()=>{clearCanvasLocal();socket.emit('clearCanvas');};socket.on('drawUpdate',line);socket.on('canvasCleared',clearCanvasLocal);function clearCanvasLocal(){if(!canvas.width)return;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}window.addEventListener('resize',resizeCanvas);

const s=session();if(s)$('resume').classList.remove('hidden');
