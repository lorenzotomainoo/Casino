/* =========================================================
   LOTA CASINO - Script principale
   ========================================================= */

// ===== STATO =====
const state = {
  playerName: localStorage.getItem('lota_name') || null,
  balance: parseInt(localStorage.getItem('lota_balance') || '1000'),
  wins: JSON.parse(localStorage.getItem('lota_wins') || '{"wheel":0,"aviator":0,"slots":0}')
};

// ===== LEADERBOARD CONFIG =====
const LB = {
  binId: '6a636fceda38895dfe8a127f',
  apiKey: '$2a$10$xw5lW3OSxYgPwFIZrYcbPuXXeyjof6/FdyfV5QItat6K0lR0bL24O',
  apiBase: 'https://api.jsonbin.io/v3/b'
};

// ===== UTILS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function formatLote(n){
  n = Math.floor(n);
  return n.toLocaleString('it-IT') + (n === 1 ? ' lota' : ' lote');
}

function toast(msg, type='info'){
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  $('#toastContainer').appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

function celebrate(amount){
  const colors = ['#FFD700','#ff2e63','#0fff95','#08d9d6','#9d4edd','#ff6b9d'];
  const count = Math.min(120, 30 + Math.floor(Math.log(amount + 1) * 8));
  for(let i = 0; i < count; i++){
    const p = document.createElement('div');
    p.className = 'confetti';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay = (Math.random() * 0.5) + 's';
    p.style.animationDuration = (1.8 + Math.random() * 2) + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 4500);
  }
  const flash = document.createElement('div');
  flash.className = 'win-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 600);
}

function updateBalance(){
  $('#balanceAmount').textContent = state.balance.toLocaleString('it-IT');
  $('#homeBalance').textContent = state.balance.toLocaleString('it-IT');
  $('#homeWheelWins').textContent = state.wins.wheel.toLocaleString('it-IT');
  $('#homeAviatorWins').textContent = state.wins.aviator.toLocaleString('it-IT');
  $('#homeSlotsWins').textContent = state.wins.slots.toLocaleString('it-IT');
  localStorage.setItem('lota_balance', state.balance);
  localStorage.setItem('lota_wins', JSON.stringify(state.wins));
}

function placeBet(amount, betInput){
  if(betInput){
    const current = parseInt(betInput.value) || 0;
    betInput.value = amount === 0 ? 10 : current + amount;
  }
}

// ===== ROUTING =====
function route(){
  const hash = location.hash.slice(2) || 'home';
  $$('.page').forEach(p => p.classList.remove('active'));
  const page = $('#page-' + hash);
  if(page) page.classList.add('active');
  $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.route === hash));
  if(hash === 'leaderboard') renderLeaderboard();
  if(hash === 'aviator') drawAviator();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ===== WELCOME / LOGIN =====
function checkWelcome(){
  if(!state.playerName){
    $('#welcomeModal').classList.add('show');
    $('#nameInput').focus();
  } else {
    $('#welcomeModal').classList.remove('show');
    $('#playerTag').textContent = state.playerName;
    $('#homePlayerName').textContent = state.playerName;
  }
}
 $('#startBtn').addEventListener('click', () => {
  const name = $('#nameInput').value.trim();
  if(name.length < 2){
    $('#nameInput').classList.add('shake');
    setTimeout(() => $('#nameInput').classList.remove('shake'), 400);
    toast('Inserisci un nome di almeno 2 caratteri', 'lose');
    return;
  }
  state.playerName = name;
  localStorage.setItem('lota_name', name);
  checkWelcome();
  toast(`Benvenuto ${name}! Hai ${formatLote(state.balance)} da puntare.`, 'win');
});
 $('#nameInput').addEventListener('keydown', e => { if(e.key === 'Enter') $('#startBtn').click(); });

// ===== LEADERBOARD =====
async function fetchLeaderboard(){
  if(LB.binId && LB.apiKey){
    try{
      const r = await fetch(`${LB.apiBase}/${LB.binId}/latest`, {
        headers: { 'X-Master-Key': LB.apiKey }
      });
      if(!r.ok) throw new Error('Network');
      const data = await r.json();
      return Array.isArray(data.record) ? data.record : [];
    } catch(e){
      console.error('LB fetch error:', e);
      return JSON.parse(localStorage.getItem('lota_localLb') || '[]');
    }
  }
  return JSON.parse(localStorage.getItem('lota_localLb') || '[]');
}

async function pushLeaderboard(board){
  if(LB.binId && LB.apiKey){
    try{
      await fetch(`${LB.apiBase}/${LB.binId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': LB.apiKey },
        body: JSON.stringify(board)
      });
    } catch(e){ console.error('LB push error:', e); }
  } else {
    localStorage.setItem('lota_localLb', JSON.stringify(board));
  }
}

async function recordWin(game, amount){
  if(!state.playerName || amount <= 0) return;
  state.wins[game] = (state.wins[game] || 0) + amount;
  updateBalance();
  let board = await fetchLeaderboard();
  let entry = board.find(e => e.name === state.playerName);
  if(!entry){
    entry = { name: state.playerName, wheel: 0, aviator: 0, slots: 0, last: 0 };
    board.push(entry);
  }
  entry[game] = (entry[game] || 0) + amount;
  entry.last = Date.now();
  await pushLeaderboard(board);
  if($('#page-leaderboard').classList.contains('active')) renderLeaderboard();
}

let currentLbGame = 'total';
async function renderLeaderboard(){
  const list = $('#lbList');
  list.innerHTML = '<div class="lb-empty">Caricamento classifica...</div>';
  const board = await fetchLeaderboard();
  const sorted = [...board].sort((a, b) => {
    if(currentLbGame === 'total') return ((b.wheel||0)+(b.aviator||0)+(b.slots||0)) - ((a.wheel||0)+(a.aviator||0)+(a.slots||0));
    return (b[currentLbGame]||0) - (a[currentLbGame]||0);
  }).slice(0, 20);
  if(sorted.length === 0){
    list.innerHTML = '<div class="lb-empty">Nessun punteggio ancora. Gioca per apparire in classifica!</div>';
    return;
  }
  list.innerHTML = '';
  sorted.forEach((entry, i) => {
    const score = currentLbGame === 'total'
      ? ((entry.wheel||0)+(entry.aviator||0)+(entry.slots||0))
      : (entry[currentLbGame]||0);
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
    const row = document.createElement('div');
    row.className = 'lb-row' + (entry.name === state.playerName ? ' me' : '');
    row.innerHTML = `<div class="lb-rank">${medal}</div><div class="lb-name">${entry.name}</div><div class="lb-score">${score.toLocaleString('it-IT')} lote</div>`;
    list.appendChild(row);
  });
}

 $$('.lb-tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.lb-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentLbGame = tab.dataset.game;
  renderLeaderboard();
}));

/* =========================================================
   GIOCO 1: RUOTA CRAZY TIME
   ========================================================= */

// Sostituito 1x con 0x (perdita) per rendere il gioco sfidante
const wheelSegmentsConfig = [
  { type: 'mult', value: 0, count: 21, color: '#2a2a2a' }, // 0x PERDITA SECCA
  { type: 'mult', value: 2, count: 13, color: '#e6b800' }, // 2x
  { type: 'mult', value: 5, count: 7,  color: '#9d4edd' }, // 5x
  { type: 'mult', value: 10,count: 4,  color: '#ff2e63' }, // 10x
  { type: 'bonus', name: 'Coin Flip', count: 4, color: '#ff6b9d' },
  { type: 'bonus', name: 'Cash Hunt', count: 2, color: '#06ffa5' },
  { type: 'bonus', name: 'Pachinko', count: 2, color: '#ffd60a' },
  { type: 'bonus', name: 'Crazy Time', count: 1, color: '#c77dff' }
];

let wheelSegments = [];
let wheelRotation = 0;
let wheelSpinning = false;
let wheelHistory = [];

function buildWheel(){
  const mults = [];
  wheelSegmentsConfig.forEach(seg => {
    if(seg.type === 'mult') {
      for(let i=0; i<seg.count; i++) mults.push({ type:'mult', value: seg.value, color: seg.color });
    }
  });
  for(let i = mults.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [mults[i], mults[j]] = [mults[j], mults[i]];
  }
  
  const bonuses = [];
  wheelSegmentsConfig.forEach(seg => {
    if(seg.type === 'bonus') {
      for(let i=0; i<seg.count; i++) bonuses.push({ type:'bonus', name: seg.name, color: seg.color });
    }
  });
  for(let i = bonuses.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [bonuses[i], bonuses[j]] = [bonuses[j], bonuses[i]];
  }
  
  wheelSegments = [];
  let bIdx = 0, mIdx = 0;
  const bonusPositions = [0, 6, 12, 18, 24, 30, 36, 42, 48];
  for(let i = 0; i < 54; i++){
    if(bonusPositions.includes(i)) {
      wheelSegments.push(bonuses[bIdx++]);
    } else {
      wheelSegments.push(mults[mIdx++]);
    }
  }
  drawWheel();
}

function drawWheel(){
  const svg = $('#wheelSvg');
  svg.innerHTML = '';
  const NS = 'http://www.w3.org/2000/svg';
  const radius = 95;
  const segAngle = 360 / wheelSegments.length;
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<radialGradient id="centerGrad"><stop offset="0%" stop-color="#FFE958"/><stop offset="100%" stop-color="#B8860B"/></radialGradient>`;
  svg.appendChild(defs);

  wheelSegments.forEach((seg, i) => {
    const startA = i * segAngle - 90 - segAngle / 2;
    const endA = startA + segAngle;
    const sR = startA * Math.PI / 180, eR = endA * Math.PI / 180;
    const x1 = radius * Math.cos(sR), y1 = radius * Math.sin(sR);
    const x2 = radius * Math.cos(eR), y2 = radius * Math.sin(eR);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} L 0 0 Z`);
    path.setAttribute('fill', seg.color);
    path.setAttribute('stroke', '#000');
    path.setAttribute('stroke-width', '0.4');
    if(seg.type === 'bonus'){
      path.setAttribute('stroke', '#fff');
      path.setAttribute('stroke-width', '1.2');
    }
    svg.appendChild(path);
    
    const midA = startA + segAngle / 2;
    const midR = midA * Math.PI / 180;
    const tr = radius * 0.68;
    const tx = tr * Math.cos(midR), ty = tr * Math.sin(midR);
    
    let textAngle = midA;
    if (textAngle > 90 && textAngle < 270) {
      textAngle += 180;
    }

    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', tx);
    text.setAttribute('y', ty);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('transform', `rotate(${textAngle}, ${tx}, ${ty})`);
    text.setAttribute('fill', '#fff');
    text.setAttribute('font-weight', '900');
    text.setAttribute('font-size', seg.type === 'bonus' ? '4.5' : '7');
    text.setAttribute('font-family', 'Russo One, sans-serif');
    text.setAttribute('paint-order', 'stroke');
    text.setAttribute('stroke', '#000');
    text.setAttribute('stroke-width', '0.8');
    text.setAttribute('stroke-linejoin', 'round');
    text.textContent = seg.type === 'bonus' ? seg.name : seg.value;
    svg.appendChild(text);
  });
}

function spinWheel(){
  if(wheelSpinning) return;
  const bet = parseInt($('#wheelBet').value) || 0;
  if(bet < 1){ toast('Puntata minima: 1 lota', 'lose'); return; }
  if(state.balance < bet){ toast('Saldo insufficiente', 'lose'); return; }
  state.balance -= bet;
  updateBalance();
  wheelSpinning = true;
  $('#wheelSpinBtn').disabled = true;

  const winIndex = Math.floor(Math.random() * 54);
  const result = wheelSegments[winIndex];
  
  const segAngle = 360 / wheelSegments.length;
  const targetMod = ((360 - winIndex * segAngle) % 360 + 360) % 360;
  const offset = (Math.random() - 0.5) * segAngle * 0.6;
  const currentMod = ((wheelRotation % 360) + 360) % 360;
  let delta = targetMod - currentMod + offset;
  if(delta < 0) delta += 360;
  delta += 360 * 6;
  wheelRotation += delta;
  $('#wheelSvg').style.transition = 'transform 6s cubic-bezier(.17,.67,.21,.99)';
  $('#wheelSvg').style.transform = `rotate(${wheelRotation}deg)`;

  setTimeout(() => {
    wheelSpinning = false;
    $('#wheelSpinBtn').disabled = false;
    handleWheelResult(result, bet);
  }, 6100);
}

function handleWheelResult(result, bet){
  let historyLabel, historyColor;
  if(result.type === 'mult'){
    const win = Math.floor(bet * result.value);
    historyLabel = result.value + 'x';
    if(win > 0){
      state.balance += win;
      updateBalance();
      toast(`+${formatLote(win)} (${result.value}x)`, 'win');
      recordWin('wheel', win);
      celebrate(win);
    } else {
      // Se il moltiplicatore è 0, la puntata è già stata sottratta, quindi il giocatore perde i soldi
      toast(`${result.value}x · Hai perso la puntata!`, 'lose');
    }
    wheelHistory.unshift({ label: historyLabel, color: result.value >= 5 ? 'var(--gold)' : (result.value === 0 ? 'var(--red-bright)' : 'var(--text-dim)') });
  } else {
    wheelHistory.unshift({ label: result.name, color: result.color });
    activateBonus(result.name, bet);
  }
  if(wheelHistory.length > 12) wheelHistory.pop();
  renderWheelHistory();
}

function renderWheelHistory(){
  const c = $('#wheelHistory');
  if(wheelHistory.length === 0){
    c.innerHTML = '<span style="color:var(--text-dim);font-size:.85rem">Nessun giro ancora</span>';
    return;
  }
  c.innerHTML = wheelHistory.map(h => `<div class="history-item" style="color:${h.color};border-color:${h.color}">${h.label}</div>`).join('');
}

 $('#wheelSpinBtn').addEventListener('click', spinWheel);
 $$('#page-wheel .bet-chip').forEach(c => c.addEventListener('click', () => placeBet(parseInt(c.dataset.add), $('#wheelBet'))));

// ===== BONUS GAMES =====
function activateBonus(name, bet){
  $('#bonusTitle').textContent = name + '!';
  $('#bonusModal').classList.add('show');
  const content = $('#bonusContent');
  content.innerHTML = '<p style="color:var(--gold-bright);font-size:1.1rem">Caricamento bonus...</p>';
  if(name === 'Coin Flip') return bonusCoinFlip(bet, content);
  if(name === 'Cash Hunt') return bonusCashHunt(bet, content);
  if(name === 'Pachinko') return bonusPachinko(bet, content);
  if(name === 'Crazy Time') return bonusCrazyTime(bet, content);
}

function bonusCoinFlip(bet, container){
  const redMult = pickWeighted([2,3,4,5,8,10,15,20,25], [10,15,18,18,15,10,8,4,2]);
  const blueMult = pickWeighted([2,3,4,5,8,10,15,20,25], [10,15,18,18,15,10,8,4,2]);
  container.innerHTML = `
    <p>Scegli un colore. La moneta decide il tuo moltiplicatore.</p>
    <div class="coin-flip">
      <div>
        <div class="coin-3d red" data-side="red">ROSSO</div>
        <span class="coin-mult">${redMult}x</span>
      </div>
      <div>
        <div class="coin-3d blue" data-side="blue">BLU</div>
        <span class="coin-mult">${blueMult}x</span>
      </div>
    </div>
  `;
  container.querySelectorAll('.coin-3d').forEach(coin => {
    coin.addEventListener('click', () => {
      const side = coin.dataset.side;
      const winner = Math.random() < 0.5 ? 'red' : 'blue';
      const winMult = winner === 'red' ? redMult : blueMult;
      container.querySelectorAll('.coin-3d').forEach(c => c.style.pointerEvents = 'none');
      coin.classList.add('flipping');
      setTimeout(() => {
        const win = Math.floor(bet * winMult);
        state.balance += win;
        updateBalance();
        const chosen = side === winner ? 'Hai vinto!' : 'Hai perso il colore, ma vinci comunque!';
        container.innerHTML = `
          <p style="font-size:1.2rem;color:var(--gold-bright);margin:20px 0">È uscito <strong>${winner === 'red' ? 'ROSSO' : 'BLU'}</strong> · ${winMult}x</p>
          <p style="font-size:1.6rem;color:var(--green);font-weight:800;margin:10px 0">+${formatLote(win)}</p>
          <p style="color:var(--text-dim);font-size:.9rem">${chosen}</p>
          <button class="btn-primary" style="margin-top:20px" onclick="closeBonus()">Riscuoti</button>
        `;
        recordWin('wheel', win);
        celebrate(win);
      }, 1500);
    });
  });
}

function bonusCashHunt(bet, container){
  const mults = [];
  const pool = [5,8,10,15,20,25,30,40,50,75,100];
  for(let i = 0; i < 9; i++) mults.push(pickWeighted(pool, [20,18,15,12,10,8,6,5,3,2,1]));
  for(let i = mults.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [mults[i], mults[j]] = [mults[j], mults[i]];
  }
  container.innerHTML = `
    <p>Memorizza i moltiplicatori, poi scegline uno quando vengono nascosti.</p>
    <div class="cash-grid" id="cashGrid">
      ${mults.map((m, i) => `<div class="cash-cell peek" data-idx="${i}">${m}x</div>`).join('')}
    </div>
    <p id="cashStatus" style="color:var(--gold-bright);font-weight:700">Memorizza... 3</p>
  `;
  let countdown = 3;
  const interval = setInterval(() => {
    countdown--;
    if(countdown > 0){
      $('#cashStatus').textContent = `Memorizza... ${countdown}`;
    } else {
      clearInterval(interval);
      $('#cashStatus').textContent = 'Scegli una casella!';
      container.querySelectorAll('.cash-cell').forEach((c, i) => {
        c.classList.remove('peek');
        c.textContent = '?';
        c.addEventListener('click', () => {
          container.querySelectorAll('.cash-cell').forEach(cc => {
            cc.classList.add('revealed');
            const idx = parseInt(cc.dataset.idx);
            cc.textContent = mults[idx] + 'x';
            cc.style.pointerEvents = 'none';
          });
          c.style.background = 'linear-gradient(135deg,#0fff95,#0a8060)';
          c.style.color = '#000';
          const win = Math.floor(bet * mults[i]);
          state.balance += win;
          updateBalance();
          $('#cashStatus').innerHTML = `Hai scelto ${mults[i]}x · <span style="color:var(--green)">+${formatLote(win)}</span>`;
          setTimeout(() => {
            container.innerHTML += `<button class="btn-primary" style="margin-top:20px" onclick="closeBonus()">Riscuoti</button>`;
          }, 600);
          recordWin('wheel', win);
          celebrate(win);
        });
      });
    }
  }, 1000);
}

function bonusPachinko(bet, container){
  const slots = [5, 10, 15, 20, 50, 100, 200, 50, 20, 15, 10, 5];
  const weights = [22, 18, 14, 10, 6, 3, 1, 6, 10, 14, 18, 22];
  container.innerHTML = `
    <p>La pallina cade... dove arriverà?</p>
    <div class="pachinko-stage">
      <canvas id="pachinkoCanvas" width="540" height="240" style="display:block;width:100%;height:240px"></canvas>
      <div class="pachinko-slots" id="pachinkoSlots">
        ${slots.map((s, i) => `<div class="pachinko-slot ${s >= 100 ? 'big' : ''}">${s}x</div>`).join('')}
      </div>
    </div>
    <p id="pachinkoStatus" style="color:var(--gold-bright);font-weight:700;text-align:center">In caduta...</p>
  `;
  const canvas = $('#pachinkoCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const finalSlot = pickWeightedIndex(weights);
  let ballX = W / 2, ballY = 10;
  let ballVX = (finalSlot - slots.length / 2 + 0.5) * (W / slots.length) / 60;
  let ballVY = 0;
  let frame = 0;
  const pegs = [];
  for(let row = 0; row < 5; row++){
    for(let col = 0; col < 8; col++){
      pegs.push({
        x: (col + (row % 2 ? 0.5 : 0)) * (W / 7) - 30,
        y: 30 + row * 35
      });
    }
  }
  function animate(){
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#9d4edd';
    pegs.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x + 30, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ballVY += 0.3;
    ballX += ballVX;
    ballY += ballVY;
    if(ballY >= H - 20){
      ballY = H - 20;
      ballVY *= -0.4;
    }
    if(ballX < 10 || ballX > W - 10) ballVX *= -1;
    ctx.fillStyle = '#FFD700';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FFD700';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    frame++;
    if(frame < 90){
      requestAnimationFrame(animate);
    } else {
      const finalX = (finalSlot + 0.5) * (W / slots.length);
      ballX = finalX;
      ballY = H - 15;
      ctx.clearRect(0, 0, W, H);
      pegs.forEach(p => { ctx.beginPath(); ctx.arc(p.x + 30, p.y, 3, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#FFD700';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#FFD700';
      ctx.beginPath();
      ctx.arc(finalX, ballY, 9, 0, Math.PI * 2);
      ctx.fill();
      const winMult = slots[finalSlot];
      const win = Math.floor(bet * winMult);
      state.balance += win;
      updateBalance();
      $('#pachinkoStatus').innerHTML = `La pallina è atterrata su ${winMult}x · <span style="color:var(--green)">+${formatLote(win)}</span>`;
      setTimeout(() => {
        container.innerHTML += `<button class="btn-primary" style="margin-top:20px" onclick="closeBonus()">Riscuoti</button>`;
      }, 800);
      recordWin('wheel', win);
      celebrate(win);
    }
  }
  animate();
}

function bonusCrazyTime(bet, container){
  const megaSegments = [
    { value: 20,  color: '#9d4edd', prob: 0.35 },
    { value: 50,  color: '#08d9d6', prob: 0.25 },
    { value: 100, color: '#0fff95', prob: 0.18 },
    { value: 250, color: '#ffd60a', prob: 0.12 },
    { value: 500, color: '#ff8c00', prob: 0.07 },
    { value: 1000,color: '#FFD700', prob: 0.03 }
  ];
  container.innerHTML = `
    <p>Mini-ruota con moltiplicatori giganti. Spin automatico.</p>
    <div class="mega-wheel">
      <div class="mega-pointer"></div>
      <svg id="megaWheelSvg" viewBox="-100 -100 200 200"></svg>
    </div>
    <p id="megaStatus" style="color:var(--gold-bright);font-weight:700;text-align:center">Spin in corso...</p>
  `;
  const svg = $('#megaWheelSvg');
  const NS = 'http://www.w3.org/2000/svg';
  const segAngle = 360 / megaSegments.length;
  megaSegments.forEach((seg, i) => {
    const sA = i * segAngle - 90 - segAngle / 2;
    const eA = sA + segAngle;
    const sR = sA * Math.PI / 180, eR = eA * Math.PI / 180;
    const x1 = 95 * Math.cos(sR), y1 = 95 * Math.sin(sR);
    const x2 = 95 * Math.cos(eR), y2 = 95 * Math.sin(eR);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M ${x1} ${y1} A 95 95 0 0 1 ${x2} ${y2} L 0 0 Z`);
    path.setAttribute('fill', seg.color);
    path.setAttribute('stroke', '#000');
    path.setAttribute('stroke-width', '0.5');
    svg.appendChild(path);
    const midA = sA + segAngle / 2;
    const midR = midA * Math.PI / 180;
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', 65 * Math.cos(midR));
    text.setAttribute('y', 65 * Math.sin(midR));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('transform', `rotate(${midA + 90}, ${65 * Math.cos(midR)}, ${65 * Math.sin(midR)})`);
    text.setAttribute('fill', '#fff');
    text.setAttribute('font-weight', '900');
    text.setAttribute('font-size', '12');
    text.setAttribute('font-family', 'Russo One, sans-serif');
    text.textContent = seg.value + 'x';
    svg.appendChild(text);
  });
  const r = Math.random();
  let cum = 0, winner = megaSegments[0];
  for(const s of megaSegments){
    cum += s.prob;
    if(r <= cum){ winner = s; break; }
  }
  const winIndex = megaSegments.indexOf(winner);
  const targetMod = (360 - winIndex * segAngle) % 360;
  setTimeout(() => {
    svg.style.transition = 'transform 5s cubic-bezier(.17,.67,.21,.99)';
    svg.style.transform = `rotate(${360 * 8 + targetMod}deg)`;
  }, 100);
  setTimeout(() => {
    const win = Math.floor(bet * winner.value);
    state.balance += win;
    updateBalance();
    $('#megaStatus').innerHTML = `Uscito ${winner.value}x · <span style="color:var(--green)">+${formatLote(win)}</span>`;
    container.innerHTML += `<button class="btn-primary" style="margin-top:20px" onclick="closeBonus()">Riscuoti</button>`;
    recordWin('wheel', win);
    celebrate(win);
  }, 5200);
}

function closeBonus(){
  $('#bonusModal').classList.remove('show');
}
window.closeBonus = closeBonus;

function pickWeighted(values, weights){
  const total = weights.reduce((a,b) => a+b, 0);
  let r = Math.random() * total;
  for(let i = 0; i < values.length; i++){
    r -= weights[i];
    if(r <= 0) return values[i];
  }
  return values[values.length - 1];
}
function pickWeightedIndex(weights){
  const total = weights.reduce((a,b) => a+b, 0);
  let r = Math.random() * total;
  for(let i = 0; i < weights.length; i++){
    r -= weights[i];
    if(r <= 0) return i;
  }
  return weights.length - 1;
}

/* =========================================================
   GIOCO 2: AVIATOR
   ========================================================= */
const av = {
  flying: false, crashed: false, cashedOut: false,
  multiplier: 1.0, crashPoint: 1.0, bet: 0,
  startTime: 0, history: []
};

function generateCrashPoint(){
  const r = Math.random();
  if(r < 0.03) return 1.00;
  const cp = 0.97 / (1 - r);
  return Math.max(1.00, Math.floor(cp * 100) / 100);
}

function startAviator(){
  if(av.flying) return;
  const bet = parseInt($('#aviatorBet').value) || 0;
  if(bet < 1){ toast('Puntata minima: 1 lota', 'lose'); return; }
  if(state.balance < bet){ toast('Saldo insufficiente', 'lose'); return; }
  state.balance -= bet;
  updateBalance();
  av.bet = bet;
  av.flying = true;
  av.crashed = false;
  av.cashedOut = false;
  av.multiplier = 1.0;
  av.crashPoint = generateCrashPoint();
  av.startTime = performance.now();
  $('#aviatorBetBtn').disabled = true;
  $('#aviatorCashoutBtn').disabled = false;
  $('#cashoutAmount').textContent = '';
  aviatorLoop();
}

function aviatorLoop(){
  if(!av.flying) return;
  const elapsed = (performance.now() - av.startTime) / 1000;
  av.multiplier = Math.pow(Math.E, elapsed * 0.18);
  if(av.multiplier >= av.crashPoint){
    av.multiplier = av.crashPoint;
    crashAviator();
    return;
  }
  drawAviator();
  if(!av.cashedOut){
    $('#cashoutAmount').textContent = `Cashout ora: ${formatLote(Math.floor(av.bet * av.multiplier))}`;
  }
  requestAnimationFrame(aviatorLoop);
}

function cashoutAviator(){
  if(!av.flying || av.cashedOut) return;
  av.cashedOut = true;
  const win = Math.floor(av.bet * av.multiplier);
  state.balance += win;
  updateBalance();
  $('#cashoutAmount').textContent = `Riscosso a ${av.multiplier.toFixed(2)}x · +${formatLote(win)}`;
  toast(`Cashout a ${av.multiplier.toFixed(2)}x · +${formatLote(win)}`, 'win');
  recordWin('aviator', win);
  if(win > av.bet * 3) celebrate(win);
  $('#aviatorCashoutBtn').disabled = true;
}

function crashAviator(){
  av.flying = false;
  av.crashed = true;
  drawAviator(true);
  av.history.unshift(av.crashPoint);
  if(av.history.length > 15) av.history.pop();
  renderAviatorHistory();
  if(!av.cashedOut){
    toast(`Crash a ${av.crashPoint.toFixed(2)}x · -${formatLote(av.bet)}`, 'lose');
    $('#cashoutAmount').textContent = `Crash a ${av.crashPoint.toFixed(2)}x`;
  }
  setTimeout(() => {
    av.crashed = false;
    drawAviator();
    $('#aviatorBetBtn').disabled = false;
    $('#aviatorCashoutBtn').disabled = true;
    $('#cashoutAmount').textContent = '';
  }, 1800);
}

function renderAviatorHistory(){
  $('#aviatorHistory').innerHTML = av.history.map(h => {
    const cls = h >= 2 ? 'high' : 'low';
    return `<div class="aviator-history-item ${cls}">${h.toFixed(2)}x</div>`;
  }).join('');
}

function drawAviator(showCrash = false){
  const canvas = $('#aviatorCanvas');
  if(!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if(canvas.width !== rect.width * dpr){
    canvas.width = rect.width * dpr;
    canvas.height = 400 * dpr;
    canvas.getContext('2d').scale(dpr, dpr);
  }
  const ctx = canvas.getContext('2d');
  const W = rect.width, H = 400;
  ctx.clearRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a0a2e');
  grad.addColorStop(1, '#0a0511');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.04)';
  ctx.lineWidth = 1;
  for(let i = 1; i < 10; i++){
    ctx.beginPath();
    ctx.moveTo(0, H * i / 10);
    ctx.lineTo(W, H * i / 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W * i / 10, 0);
    ctx.lineTo(W * i / 10, H);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,215,0,.2)';
  ctx.beginPath();
  ctx.moveTo(40, H - 40);
  ctx.lineTo(W - 20, H - 40);
  ctx.moveTo(40, H - 40);
  ctx.lineTo(40, 20);
  ctx.stroke();
  
  const mult = av.flying ? av.multiplier : (av.crashed ? av.crashPoint : 1);
  if(mult <= 1.01 && !av.flying){
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = '20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Piazza una scommessa e premi AVVIA VOLO', W/2, H/2);
    return;
  }
  
  const maxMult = Math.max(2, mult * 1.15);
  const xStart = 40, yStart = H - 40;
  const xEnd = W - 20, yEnd = 20;
  const plotW = xEnd - xStart, plotH = yStart - yEnd;
  
  function getXY(m){
    const xR = (Math.log(m) / Math.log(maxMult));
    const yR = (1 - 1/m) / (1 - 1/maxMult);
    return [xStart + xR * plotW, yStart - yR * plotH];
  }
  
  ctx.beginPath();
  ctx.moveTo(xStart, yStart);
  const steps = 60;
  for(let i = 0; i <= steps; i++){
    const m = 1 + (mult - 1) * i / steps;
    const [x, y] = getXY(m);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(xStart + (Math.log(mult) / Math.log(maxMult)) * plotW, yStart);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(0, yEnd, 0, yStart);
  if(showCrash){
    fillGrad.addColorStop(0, 'rgba(255,46,99,.4)');
    fillGrad.addColorStop(1, 'rgba(255,46,99,0)');
  } else {
    fillGrad.addColorStop(0, 'rgba(255,92,138,.4)');
    fillGrad.addColorStop(1, 'rgba(255,92,138,0)');
  }
  ctx.fillStyle = fillGrad;
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(xStart, yStart);
  for(let i = 0; i <= steps; i++){
    const m = 1 + (mult - 1) * i / steps;
    const [x, y] = getXY(m);
    ctx.lineTo(x, y);
  }
  ctx.strokeStyle = showCrash ? '#ff2e63' : '#ff5c8a';
  ctx.lineWidth = 3;
  ctx.shadowBlur = 15;
  ctx.shadowColor = showCrash ? '#ff2e63' : '#ff5c8a';
  ctx.stroke();
  ctx.shadowBlur = 0;
  
  const [px, py] = getXY(mult);
  ctx.save();
  ctx.translate(px, py);
  if(showCrash){
    ctx.fillStyle = '#ff2e63';
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ff2e63';
    ctx.beginPath();
    ctx.arc(0, 0, 18 + Math.random() * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const next = getXY(Math.min(mult * 1.05, maxMult));
    const angle = Math.atan2(next[1] - py, next[0] - px);
    ctx.rotate(angle);
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FFD700';
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -5);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-10, 5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -1);
    ctx.lineTo(-4, -12);
    ctx.lineTo(-10, -1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, 1);
    ctx.lineTo(-4, 12);
    ctx.lineTo(-10, 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -1);
    ctx.lineTo(-15, -6);
    ctx.lineTo(-12, 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  
  ctx.shadowBlur = 25;
  ctx.shadowColor = showCrash ? '#ff2e63' : '#FFD700';
  ctx.fillStyle = showCrash ? '#ff2e63' : '#FFD700';
  ctx.font = 'bold 56px Russo One, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mult.toFixed(2) + 'x', W/2, H/2 + 20);
  ctx.shadowBlur = 0;
  
  if(showCrash){
    ctx.fillStyle = '#ff2e63';
    ctx.font = 'bold 18px Montserrat, sans-serif';
    ctx.fillText('CRASH!', W/2, H/2 - 30);
  }
}

 $('#aviatorBetBtn').addEventListener('click', startAviator);
 $('#aviatorCashoutBtn').addEventListener('click', cashoutAviator);
 $$('#page-aviator .bet-chip').forEach(c => c.addEventListener('click', () => placeBet(parseInt(c.dataset.add), $('#aviatorBet'))));

/* =========================================================
   GIOCO 3: SLOT MACHINE - Tesoro dei Faraoni
   ========================================================= */
const slotSymbols = [
  { id: 'pyramid',   emoji: '🔺', weight: 1,  payout: 200 },
  { id: 'eye',       emoji: '👁️', weight: 2,  payout: 80  },
  { id: 'scarab',    emoji: '🪲', weight: 3,  payout: 45  },
  { id: 'vase',      emoji: '⚱️', weight: 5,  payout: 22  },
  { id: 'dagger',    emoji: '🗡️', weight: 7,  payout: 13  },
  { id: 'amphora',   emoji: '🏺', weight: 9,  payout: 8   },
  { id: 'wheat',     emoji: '🌾', weight: 11, payout: 4   },
  { id: 'coin',      emoji: '🪙', weight: 13, payout: 3   }
];
const totalSlotWeight = slotSymbols.reduce((s, sym) => s + sym.weight, 0);
const slotLines = [
  [[0,0],[1,0],[2,0]], // top
  [[0,1],[1,1],[2,1]], // middle
  [[0,2],[1,2],[2,2]], // bottom
  [[0,0],[1,1],[2,2]], // diag \
  [[0,2],[1,1],[2,0]]  // diag /
];
let slotsSpinning = false;

function pickSlotSymbol(){
  let r = Math.random() * totalSlotWeight;
  for(const sym of slotSymbols){
    r -= sym.weight;
    if(r <= 0) return sym;
  }
  return slotSymbols[slotSymbols.length - 1];
}

function spinSlots(){
  if(slotsSpinning) return;
  const bet = parseInt($('#slotsBet').value) || 0;
  if(bet < 1){ toast('Puntata minima: 1 lota', 'lose'); return; }
  if(state.balance < bet){ toast('Saldo insufficiente', 'lose'); return; }
  state.balance -= bet;
  updateBalance();
  slotsSpinning = true;
  $('#slotsSpinBtn').disabled = true;
  $('#slotMessage').textContent = '🌀 Giro dei rulli...';
  $$('.slot-symbol').forEach(s => s.classList.remove('win'));
  
  const result = [
    [pickSlotSymbol(), pickSlotSymbol(), pickSlotSymbol()],
    [pickSlotSymbol(), pickSlotSymbol(), pickSlotSymbol()],
    [pickSlotSymbol(), pickSlotSymbol(), pickSlotSymbol()]
  ];
  
  const reels = $$('.slot-reel');
  reels.forEach((reel, i) => {
    const symbols = reel.querySelectorAll('.slot-symbol');
    const duration = 1200 + i * 500;
    const interval = setInterval(() => {
      symbols.forEach(s => { s.textContent = pickSlotSymbol().emoji; });
    }, 70);
    setTimeout(() => {
      clearInterval(interval);
      symbols.forEach((s, idx) => {
        s.textContent = result[i][idx].emoji;
        s.dataset.id = result[i][idx].id;
      });
      if(i === reels.length - 1){
        slotsSpinning = false;
        $('#slotsSpinBtn').disabled = false;
        checkSlotWins(result, bet);
      }
    }, duration);
  });
}

function checkSlotWins(result, bet){
  let totalWin = 0;
  const winningCells = new Set();
  slotLines.forEach((line, lineIdx) => {
    const symbols = line.map(([x, y]) => result[x][y]);
    if(symbols[0].id === symbols[1].id && symbols[1].id === symbols[2].id){
      const win = Math.floor(bet * symbols[0].payout);
      totalWin += win;
      line.forEach(([x, y]) => winningCells.add(`${x}-${y}`));
    }
  });
  
  if(totalWin > 0){
    state.balance += totalWin;
    updateBalance();
    const reels = $$('.slot-reel');
    winningCells.forEach(key => {
      const [x, y] = key.split('-').map(Number);
      const cell = reels[x].querySelectorAll('.slot-symbol')[y];
      cell.classList.add('win');
    });
    $('#slotMessage').textContent = `🏆 +${formatLote(totalWin)}`;
    toast(`+${formatLote(totalWin)} di vincita!`, 'win');
    recordWin('slots', totalWin);
    celebrate(totalWin);
  } else {
    $('#slotMessage').textContent = 'Nessuna vincita · Riprova!';
    setTimeout(() => { $('#slotMessage').textContent = 'Piazza la scommessa e gira i rulli'; }, 2000);
  }
}

 $('#slotsSpinBtn').addEventListener('click', spinSlots);
 $$('#page-slots .bet-chip').forEach(c => c.addEventListener('click', () => placeBet(parseInt(c.dataset.add), $('#slotsBet'))));

// ===== INIT =====
function init(){
  buildWheel();
  checkWelcome();
  updateBalance();
  renderAviatorHistory();
  drawAviator();
  route();
}
window.addEventListener('resize', () => { if($('#page-aviator').classList.contains('active')) drawAviator(); });
init();