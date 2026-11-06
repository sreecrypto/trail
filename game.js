'use strict';
const el = id => document.getElementById(id);
const ctx = el('arena').getContext('2d');
const ground = 409;
const roster = [
  {name:'Shiva', move:'Trishula', glow:'#71edff', skin:'#8fb8da', cloth:'#df864e'},
  {name:'Vishnu', move:'Sudarshana Chakra', glow:'#ffcf73', skin:'#668df3', cloth:'#eabc55'}
];
const held = new Set(), pressed = new Set();
const stars = Array.from({length:170}, (_, i) => [i * 137.51 % 960, i * 71.39 % 385, i % 11 ? 1 : 2]);
let mode = 'menu', player, cpu, round, time, delay, banner, effects, discs, think, cpuGuard, cpuJump;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function fighter(id, x, face, wins = 0) {
  return {id, ...roster[id], x, face, wins, y:0, vy:0, hp:100, meter:0, stun:0, guard:false, attack:null, flash:0, walking:false};
}
function setup(id, reset) {
  player = fighter(id, 245, 1, reset ? 0 : player.wins);
  cpu = fighter(1-id, 715, -1, reset ? 0 : cpu.wins);
  round = player.wins + cpu.wins + 1;
  mode = 'intro'; time = 60; delay = 1.45; banner = 'ROUND ' + round;
  effects = []; discs = []; think = 0; cpuGuard = 0; cpuJump = 0;
  el('overlay').hidden = true;
  el('status').textContent = player.name + ' • ' + player.move + ' — press L when the meter is full.';
}
function menu() {
  setup(0, true); mode = 'menu';
  el('overlay').hidden = false;
  el('eyebrow').textContent = 'Choose your fighter';
  el('headline').textContent = 'The orbital duel';
  el('detail').textContent = 'Two divine fighters. One arena in orbit.';
}
el('shiva').onclick = () => setup(0, true);
el('vishnu').onclick = () => setup(1, true);
el('menu').onclick = menu;
const keys = new Set(['KeyA','KeyD','KeyW','KeyS','KeyJ','KeyK','KeyL']);
function down(key) { if (!held.has(key)) pressed.add(key); held.add(key); }
addEventListener('keydown', e => { if (keys.has(e.code) && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); down(e.code); } });
addEventListener('keyup', e => held.delete(e.code));
addEventListener('blur', () => { held.clear(); pressed.clear(); });
document.querySelectorAll('[data-key]').forEach(button => {
  const key = button.dataset.key;
  button.onpointerdown = e => { e.preventDefault(); button.setPointerCapture(e.pointerId); down(key); };
  button.onlostpointercapture = () => held.delete(key);
  button.onclick = e => { if (e.detail === 0) pressed.add(key); };
});
const moves = {
  light:{wind:.10, end:.29, range:87, damage:8, knock:20},
  heavy:{wind:.22, end:.51, range:112, damage:15, knock:40},
  astra:{wind:.32, end:.74, range:245, damage:32, knock:77}
};
function attack(f, type) {
  if (f.attack || f.guard || f.stun || (type === 'astra' && f.meter < 100)) return;
  f.attack = {type, age:0, landed:false};
  if (type === 'astra') {
    f.meter = 0;
    el('status').textContent = f.name + ' invokes ' + f.move + '!';
  }
}
function hit(f, target, move, direction) {
  const blocked = target.guard && target.face !== direction;
  const special = move === moves.astra;
  const damage = blocked ? (special ? 9 : 0) : move.damage;
  target.hp = Math.max(0, target.hp - damage);
  target.flash = .14;
  target.stun = blocked ? .09 : .24;
  target.attack = null;
  target.x = clamp(target.x + direction * move.knock * (blocked ? .4 : 1), 38, 922);
  if (!special) f.meter = Math.min(100, f.meter + (blocked ? 8 : 27));
  target.meter = Math.min(100, target.meter + (blocked ? 24 : 13));
  effects.push({x:target.x, y:ground + target.y - 80, age:0, color:blocked ? '#c9e6ff' : f.glow, reach:blocked ? 32 : 56});
}
function control(f, direction, jump, guard, dt) {
  f.guard = guard && !f.attack && !f.stun && f.y === 0;
  f.walking = !!direction && !f.guard && !f.attack && !f.stun;
  if (f.walking) f.x = clamp(f.x + direction * 255 * dt, 38, 922);
  if (jump && f.y === 0 && !f.guard && !f.attack && !f.stun) f.vy = -590;
  f.vy += 1530 * dt;
  f.y = Math.min(0, f.y + f.vy * dt);
  if (!f.y) f.vy = 0;
}
function advanceAttack(f, target, dt) {
  const a = f.attack;
  if (!a) return;
  const move = moves[a.type];
  a.age += dt;
  if (!a.landed && a.age >= move.wind) {
    a.landed = true;
    if (a.type === 'astra' && f.id === 1) {
      discs.push({owner:f, target, x:f.x + f.face * 35, y:ground + f.y - 82, dir:f.face, age:0});
    } else {
      const special = a.type === 'astra';
      effects.push({x:f.x + f.face * (special ? 115 : 49), y:ground + f.y - 81, age:0, color:f.glow, reach:special ? 135 : 37, slash:true});
      const distance = (target.x-f.x)*f.face;
      if (distance >= -8 && distance < move.range && Math.abs(f.y-target.y) < (special ? 104 : 67)) hit(f,target,move,f.face);
    }
  }
  if (a.age >= move.end) f.attack = null;
}
function finish() {
  if (player.hp === cpu.hp) banner = 'DRAW • ROUND REPLAY';
  else {
    const winner = player.hp > cpu.hp ? player : cpu;
    winner.wins++;
    banner = winner.name.toUpperCase() + (winner.wins === 2 ? ' WINS THE DUEL' : ' WINS THE ROUND');
  }
  mode = 'result'; delay = 2.25;
  el('status').textContent = banner;
}
function update(dt) {
  if (mode === 'intro' || mode === 'result') {
    delay -= dt;
    if (delay <= 0) {
      if (mode === 'intro') mode = 'fight';
      else if (player.wins === 2 || cpu.wins === 2) {
        mode = 'end'; el('overlay').hidden = false;
        el('eyebrow').textContent = 'Match complete';
        el('headline').textContent = (player.wins === 2 ? player.name : cpu.name) + ' wins';
        el('detail').textContent = player.name + ' ' + player.wins + ' – ' + cpu.wins + ' ' + cpu.name + ' · Play again';
      } else setup(player.id, false);
    }
  }
  effects = effects.filter(e => (e.age += dt) < .36);
  if (mode !== 'fight') return;
  time = Math.max(0, time-dt);
  for (const f of [player,cpu]) {
    f.stun = Math.max(0,f.stun-dt); f.flash = Math.max(0,f.flash-dt);
  }
  const direction = Math.sign(cpu.x-player.x) || player.face;
  if (!player.attack) player.face = direction;
  if (!cpu.attack) cpu.face = -direction;
  const distance = Math.abs(cpu.x-player.x);
  think -= dt; cpuGuard -= dt; cpuJump -= dt;
  let cpuMove;
  if (think <= 0) {
    think = .17 + Math.random()*.19;
    if (player.attack && distance < 135 && Math.random() < .48) cpuGuard = .27;
    else if (cpu.meter === 100 && distance < (cpu.id ? 550 : 220)) cpuMove = 'astra';
    else if (distance < 109 && Math.random() < .8) cpuMove = distance < 82 && Math.random() < .64 ? 'light' : 'heavy';
    else if (distance > 130 && Math.random() < .12) cpuJump = .1;
  }
  control(player, Number(held.has('KeyD'))-Number(held.has('KeyA')), pressed.has('KeyW'), held.has('KeyS'), dt);
  control(cpu, distance > 72 ? -direction : 0, cpuJump > 0, cpuGuard > 0, dt);
  const overlap = 48 - (cpu.x - player.x) * direction;
  if (overlap > 0 && Math.abs(player.y-cpu.y) < 75) {
    player.x = clamp(player.x - direction*overlap/2,38,922);
    cpu.x = clamp(player.x + direction*48,38,922);
    player.x = cpu.x - direction*48;
  }
  if (pressed.has('KeyL')) attack(player,'astra');
  else if (pressed.has('KeyK')) attack(player,'heavy');
  else if (pressed.has('KeyJ')) attack(player,'light');
  if (cpuMove) attack(cpu,cpuMove);
  advanceAttack(player,cpu,dt);
  advanceAttack(cpu,player,dt);
  discs = discs.filter(d => {
    d.x += d.dir*660*dt; d.age += dt;
    if (Math.abs(d.x-d.target.x) < 31 && Math.abs(d.y-(ground+d.target.y-79)) < 55) {
      hit(d.owner,d.target,moves.astra,d.dir);
      return false;
    }
    return d.x > -50 && d.x < 1010;
  });
  if (time === 0 || player.hp === 0 || cpu.hp === 0) finish();
}
function line(points, color, width = 2) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function shape(points, color) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function circle(x,y,r,color,fill = false) {
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  if (fill) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); }
}
function rect(x,y,w,h,color) { ctx.fillStyle = color; ctx.fillRect(x,y,w,h); }
function label(value,x,y,size,color,align = 'left') {
  ctx.font = '800 ' + size + 'px system-ui';
  ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(value,x,y);
}
function space(now) {
  const sky = ctx.createLinearGradient(0,0,0,510);
  sky.addColorStop(0,'#08091e'); sky.addColorStop(.63,'#342255'); sky.addColorStop(1,'#12122a');
  rect(0,0,960,510,sky);
  for (const [x,y,r] of stars) rect(x,y,r,r,'#e2ddff99');
  ctx.save(); ctx.translate(480,254); ctx.rotate(-.21);
  ctx.beginPath(); ctx.ellipse(0,0,330,63,0,0,7); ctx.strokeStyle='#9f8add77'; ctx.lineWidth=15; ctx.stroke();
  ctx.restore();
  const planet = ctx.createRadialGradient(445,191,16,480,250,148);
  planet.addColorStop(0,'#c59de2'); planet.addColorStop(.43,'#7a60aa'); planet.addColorStop(1,'#20183e');
  circle(480,250,145,planet,true);
  ctx.save(); ctx.translate(480,254); ctx.rotate(-.21);
  ctx.beginPath(); ctx.ellipse(0,0,330,63,0,0,Math.PI); ctx.strokeStyle='#c3b1f180'; ctx.lineWidth=12; ctx.stroke();
  ctx.restore();
  for (const x of [105,855]) {
    shape([[x-54,409],[x-40,259],[x-17,231],[x+17,231],[x+40,259],[x+54,409]],'#161631');
    line([[x-42,398],[x-29,267],[x-12,248],[x+12,248],[x+29,267],[x+42,398]],'#7463a3',4);
    circle(x,288,17,'#7bf0ff');
    rect(x-3,320,6,45,'#7bf0ff');
  }
  const ship = (now*.027)%1120-80;
  shape([[ship-38,176],[ship-12,166],[ship+20,166],[ship+44,174],[ship+13,180]],'#a8a4d8');
  rect(ship-34,174,24,3,'#75efff');
  shape([[0,409],[960,409],[960,510],[0,510]],'#151427');
  for (let x=-240;x<=1200;x+=105) line([[480+(x-480)*.63,409],[x,510]],'#45365f');
  for (const y of [409,421,442,475,509]) line([[0,y],[960,y]], y===409 ? '#8feaff' : '#473560');
  for (let x=16;x<960;x+=62) rect(x,416,32,3,'#7cd4e3');
}
function chakra(x,y,r,angle,color) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
  ctx.shadowColor=color; ctx.shadowBlur=14;
  circle(0,0,r,color); circle(0,0,r*.65,color);
  for(let i=0;i<8;i++){
    ctx.rotate(Math.PI/4);
    shape([[r-4,-4],[r+7,0],[r-4,4]],color);
    line([[4,0],[r*.65,0]],color);
  }
  circle(0,0,4,'#fff3d1',true); ctx.restore();
}
function paintFighter(f,now) {
  ctx.save(); ctx.translate(f.x,ground);
  ctx.scale(1,.23); circle(0,0,41,'#070716aa',true); ctx.restore();
  ctx.save(); ctx.translate(f.x,ground+f.y); ctx.scale(f.face,1);
  if (f.hp === 0) ctx.rotate(-1.12);
  const stride = f.walking ? Math.sin(now*.019)*14 : 0;
  const bob = Math.sin(now*.006+f.id)*2;
  ctx.translate(0,bob);
  const reach = f.attack ? Math.sin(Math.PI*Math.min(1,f.attack.age/moves[f.attack.type].end))*30 : 0;
  ctx.shadowColor=f.glow; ctx.shadowBlur=12;
  circle(-4,-114,34,f.glow);
  ctx.shadowBlur=0;
  const skin = f.flash > 0 ? '#ecfaff' : f.skin;
  for (const side of [-1,1]) {
    const foot = side*(20+stride);
    line([[side*10,-57],[side*15,-31],[foot,-4]],skin,14);
    line([[foot-6,-3],[foot+10,-3]],'#e5bd78',6);
  }
  shape([[-21,-68],[21,-68],[27,-46],[13,-33],[4,-47],[-8,-34],[-26,-46]],f.cloth);
  shape([[-27,-95],[-15,-104],[14,-104],[28,-92],[16,-67],[-17,-67]],skin);
  shape([[-20,-102],[-12,-101],[16,-69],[6,-68]],f.id ? '#e5b84f' : '#59403d');
  rect(-20,-71,40,6,'#f1c773');
  circle(0,-68,5,'#fff1b2',true);
  line([[-19,-96],[-28,-83],[-12,-76]],skin,11);
  line([[19,-96],[25+reach*.6,-87],[34+reach,-90]],skin,11);
  line([[29+reach,-91],[35+reach,-90]],'#f4c477',9);
  circle(1,-117,16,'#1b1534',true);
  shape([[-12,-124],[11,-128],[17,-116],[10,-103],[-5,-102],[-13,-110]],skin);
  line([[6,-117],[13,-117]],'#faf0da',2);
  if (f.id === 0) {
    circle(-5,-137,10,'#24192f',true);
    ctx.beginPath(); ctx.arc(-10,-141,9,.2,2.65); ctx.strokeStyle='#e3f4ff'; ctx.stroke();
    for (let y=-126;y<=-122;y+=2) line([[-2,y],[9,y]],'#f1ebed',1);
    const x = 36+reach;
    line([[x,-40],[x,-143]],'#e8ba73',5);
    line([[x-12,-153],[x-10,-137],[x,-131],[x+10,-137],[x+12,-153]],f.glow,3);
    line([[x,-132],[x,-158]],f.glow,4);
  } else {
    shape([[-13,-124],[-16,-134],[-7,-133],[-2,-151],[6,-143],[12,-134],[17,-136],[14,-125]],'#ffcc6b');
    circle(1,-133,4,'#9e4acb',true);
    chakra(43+reach,-103,14,now*.004,f.glow);
  }
  if (f.guard) {
    ctx.beginPath(); ctx.ellipse(18,-74,42,62,0,-1.25,1.25);
    ctx.strokeStyle='#c2f8ff'; ctx.lineWidth=4; ctx.stroke();
  }
  ctx.restore();
}
function hud(f,right) {
  const x=right ? 556 : 44, w=360;
  const start = fill => right ? x+w-fill : x;
  label(f.name.toUpperCase(),right ? 916 : 44,38,23,f.glow,right?'right':'left');
  rect(x,48,w,15,'#3c314e'); rect(start(w*f.hp/100),48,w*f.hp/100,15,f.hp<30?'#f67279':f.glow);
  rect(x,70,w,6,'#3c314e'); rect(start(w*f.meter/100),70,w*f.meter/100,6,'#f0ba68');
  label(f.meter===100 ? 'ASTRA READY' : f.move.toUpperCase(),right?916:44,94,12,f.meter===100?'#ffdb85':'#ddd2f0',right?'right':'left');
  for(let i=0;i<2;i++) circle(right?570+i*16:390-i*16,90,5,i<f.wins?f.glow:'#66577c',true);
}
function render(now) {
  space(now);
  paintFighter(player,now); paintFighter(cpu,now);
  for (const d of discs) chakra(d.x,d.y,23,d.age*22,d.owner.glow);
  for (const e of effects) {
    ctx.save(); ctx.globalAlpha=1-e.age/.36; ctx.shadowColor=e.color; ctx.shadowBlur=20;
    if (e.slash) {
      ctx.beginPath(); ctx.ellipse(e.x,e.y,e.reach,17+e.age*80,-.18,0,Math.PI*2);
      ctx.strokeStyle=e.color; ctx.lineWidth=5; ctx.stroke();
    } else for(let i=0;i<10;i++) {
      const angle=i*Math.PI/5, r=e.reach*(.4+e.age*2);
      line([[e.x+Math.cos(angle)*r*.55,e.y+Math.sin(angle)*r*.55],[e.x+Math.cos(angle)*r,e.y+Math.sin(angle)*r]],e.color,3);
    }
    ctx.restore();
  }
  hud(player,false); hud(cpu,true);
  label(String(Math.ceil(time)).padStart(2,'0'),480,64,41,'#faf2ff','center');
  label('ROUND '+round,480,87,12,'#ddd2f0','center');
  if (mode==='intro' || mode==='result') {
    rect(0,210,960,72,'#0b091ddc');
    label(mode==='intro' && delay < .55 ? 'FIGHT!' : banner,480,258,36,'#fff1c3','center');
  }
}
let previous;
function frame(now) {
  update(previous === undefined ? 0 : Math.min(.033,(now-previous)/1000));
  previous=now; pressed.clear();
  render(now);
  requestAnimationFrame(frame);
}
menu();
requestAnimationFrame(frame);
