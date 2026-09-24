// Original Refresh motion artwork. Run: node scripts/generate-lottie.cjs
// All paths, materials, and keyframes are authored here; no remote assets/fonts.
const fs = require('node:fs');
const path = require('node:path');
const out = path.join(__dirname, '../assets/motion');
fs.mkdirSync(out, { recursive: true });
const C = { cream:'#FFE7C9', peach:'#F6B998', honey:'#EAA167', lilac:'#D7C5FF', purple:'#8971C0', deep:'#443968', ink:'#332E49', mint:'#C7E7C8', green:'#80AD98', white:'#FFF8E8' };
const rgb = h => h.replace('#','').match(/../g).map(x => parseInt(x,16)/255);
const prop = k => ({ a:0, k });
const anim = points => ({ a:1, k:points.map(([t,s],i) => ({t,s:Array.isArray(s)?s:[s], ...(i<points.length-1?{e:Array.isArray(points[i+1][1])?points[i+1][1]:[points[i+1][1]],i:{x:[0.65],y:[1]},o:{x:[0.35],y:[0]}}:{})})) });
const tr = (p=[0,0],s=[100,100],r=0,o=100) => ({ty:'tr',p:prop(p),a:prop([0,0]),s:prop(s),r:prop(r),o:prop(o),sk:prop(0),sa:prop(0)});
const fill = (color,opacity=100) => ({ty:'fl',c:prop([...rgb(color),1]),o:prop(opacity),r:1});
const grad = (a,b,size=100) => ({ty:'gf',o:prop(100),r:1,t:1,s:prop([-size/2,-size/2]),e:prop([size/2,size/2]),g:{p:3,k:prop([0,...rgb(a),0.48,...rgb(a),1,...rgb(b)])}});
const group = (name,items,transform=tr()) => ({ty:'gr',nm:name,it:[...items.slice().reverse(),transform]});
const ellipse = (name,w,h,a,b=a,p=[0,0],opacity=100) => ({ty:'gr',nm:name,it:[{ty:'el',p:prop([0,0]),s:prop([w,h]),d:1},a===b?fill(a):grad(a,b,w),tr(p,[100,100],0,opacity)]});
const rect = (name,w,h,r,a,b=a,p=[0,0]) => ({ty:'gr',nm:name,it:[{ty:'rc',p:prop([0,0]),s:prop([w,h]),r:prop(r),d:1},a===b?fill(a):grad(a,b,w),tr(p)]});
const line = (name,vertices,color,width=4,closed=false) => ({ty:'gr',nm:name,it:[{ty:'sh',ks:prop({v:vertices,i:vertices.map(()=>[0,0]),o:vertices.map(()=>[0,0]),c:closed})},{ty:'st',c:prop([...rgb(color),1]),o:prop(100),w:prop(width),lc:2,lj:2},tr()]});
const star = (size,color) => ({ty:'gr',nm:'hand-shaped sparkle',it:[{ty:'sh',ks:prop({v:[[0,-size],[size*.3,-size*.3],[size,0],[size*.3,size*.3],[0,size],[-size*.3,size*.3],[-size,0],[-size*.3,-size*.3]],i:Array(8).fill([0,0]),o:Array(8).fill([0,0]),c:true})},fill(color),tr()]});
const ks = (p=[160,160]) => ({o:prop(100),r:prop(0),p:prop([...p,0]),a:prop([0,0,0]),s:prop([100,100,100])});
let index=0;
const layer=(name,shapes,p=[160,160],motion={})=>({ddd:0,ind:++index,ty:4,nm:name,sr:1,ks:{...ks(p),...motion},ao:0,shapes,ip:0,op:180,st:0,bm:0});
function save(name,layers,frames=180){
  const data={v:'5.12.2',fr:30,ip:0,op:frames,w:320,h:320,nm:`Refresh · ${name}`,ddd:0,assets:[],layers:layers.reverse().map(l=>({...l,op:frames})),markers:[]};
  fs.writeFileSync(path.join(out,`${name}.json`),JSON.stringify(data));
  console.log(name,`${(Buffer.byteLength(JSON.stringify(data))/1024).toFixed(1)} KB`);
}
const float = (x,y,amount=8) => anim([[0,[x,y,0]],[90,[x,y-amount,0]],[180,[x,y,0]]]);
function sun(size=100){
  return group('soft sunshine',[ellipse('sun underside',size,size,C.honey,C.honey,[0,5]),ellipse('sun clay',size,size,C.cream,C.honey),ellipse('thumbprint highlight',size*.53,size*.18,C.white,C.white,[-size*.12,-size*.28],30)]);
}
function sparkles(){
  return Array.from({length:9},(_,i)=>{
    const a=i*2.4,x=160+Math.cos(a)*(110+(i%2)*24),y=160+Math.sin(a)*110;
    return layer(`twinkle ${i}`,[star(i%3===0?7:4,i%2?C.lilac:C.cream)],[x,y],{p:float(x,y,5),o:anim([[0,20],[30+i*6,85],[110+i*4,20],[180,20]]),r:anim([[0,-12],[90,12],[180,-12]])});
  });
}
// Sunrise: soft rays, a floating clay sun, and its slowly breathing shadow.
{
 const layers=[layer('contact shadow',[ellipse('soft shadow',100,13,'#181629')],[160,248],{s:anim([[0,[100,100,100]],[90,[80,75,100]],[180,[100,100,100]]])}),...sparkles()];
 const rays=Array.from({length:12},(_,i)=>group('rounded ray',[rect('ray',9,23,5,C.cream,C.honey,[0,-88])],tr([0,0],[100,100],i*30)));
 layers.push(layer('sun halo',rays,[160,158],{r:anim([[0,-6],[180,24]]),s:anim([[0,[94,94,100]],[90,[104,104,100]],[180,[94,94,100]]])}));
 layers.push(layer('sun friend',[sun(128)],[160,158],{p:float(160,158,10),r:anim([[0,-5],[90,5],[180,-5]])}));
 save('wake-sun',layers);
}
// Math: a pillowy calculator with tactile keys and a pair of orbiting symbols.
{
 const layers=[...sparkles(),layer('calculator shadow',[ellipse('shadow',120,15,'#151426')],[160,258])];
 const pieces=[rect('case underside',142,174,29,C.deep,C.deep,[0,6]),rect('clay calculator',142,174,29,C.lilac,C.purple),rect('screen recess',113,47,13,'#51466D','#65567C',[0,-45]),rect('screen glow',99,33,9,'#D8E3C9','#AEC4B4',[0,-47])];
 pieces.push(line('plus',[[-27,-47],[-11,-47]],C.deep,4),line('plus upright',[[-19,-55],[-19,-39]],C.deep,4),line('equals one',[[12,-51],[30,-51]],C.deep,4),line('equals two',[[12,-43],[30,-43]],C.deep,4));
 for(let y=0;y<2;y++)for(let x=0;x<3;x++)pieces.push(rect(`key ${x} ${y}`,25,25,9,y===1&&x===2?C.cream:'#E9DCFF',y===1&&x===2?C.honey:'#AC97D5',[-38+x*38,5+y*38]));
 layers.push(layer('calculator', [group('calculator',pieces)],[160,164],{p:float(160,164),r:anim([[0,-6],[90,6],[180,-6]])}));
 layers.push(layer('small sun',[sun(42)],[69,91],{p:anim([[0,[69,91,0]],[90,[78,80,0]],[180,[69,91,0]]])}));
 save('math-friend',layers);
}
// Memory: two rounded clay cards take turns revealing their matching suns.
{
 const layers=[...sparkles(),layer('cards shadow',[ellipse('shadow',168,17,'#151426')],[160,252])];
 for(let i=0;i<2;i++){
  const x=i?210:111,y=i?166:150;
  const pieces=[rect('edge',104,135,23,C.deep,C.deep,[0,6]),rect('card',104,135,23,i?C.cream:C.lilac,i?C.honey:C.purple),sun(53),ellipse('fingerprint highlight',56,7,C.white,C.white,[0,-51],35)];
  layers.push(layer(`matching friend ${i}`, [group('card',pieces)],[x,y],{p:float(x,y,i?12:7),r:anim([[0,i?12:-12],[90,i?6:-6],[180,i?12:-12]]),s:anim([[0,[100,100,100]],[35+i*25,[100,100,100]],[46+i*25,[22,100,100]],[57+i*25,[100,100,100]],[180,[100,100,100]]])}));
 }
 save('memory-friends',layers);
}
// Shake: a friendly, soft phone with a deliberate left-right weight shift.
{
 const layers=[...sparkles(),layer('phone shadow',[ellipse('shadow',100,16,'#151426')],[160,266])];
 for(const side of [-1,1])layers.push(layer('motion ribbon',[line('wave',[[0,-24],[side*7,-10],[side*8,8],[0,23]],C.lilac,5)],[160+side*99,155],{o:anim([[0,20],[45,80],[90,20],[135,80],[180,20]]),p:anim([[0,[160+side*92,155,0]],[90,[160+side*103,155,0]],[180,[160+side*92,155,0]]])}));
 const pieces=[rect('phone edge',111,179,29,C.deep,C.deep,[0,6]),rect('soft phone',111,179,29,C.lilac,C.purple),rect('inset screen',87,144,19,'#4E456C','#2C2A47',[0,-1]),rect('earpiece',32,5,3,C.purple,C.purple,[0,-60]),sun(57),rect('home pill',25,4,2,C.lilac,C.lilac,[0,57])];
 layers.push(layer('phone friend',[group('phone',pieces)],[160,158],{r:anim([[0,-12],[30,12],[60,-12],[90,12],[120,-12],[150,12],[180,-12]]),p:float(160,158,7)}));
 save('shake-friend',layers);
}
// Celebration: a soft sprout opens as paper-like clay flecks arc around it.
{
 const layers=[layer('ground',[ellipse('shadow',131,19,'#19172A')],[160,259])];
 for(let i=0;i<20;i++){
  const a=i*2.399,x=160+Math.cos(a)*110,y=110+Math.sin(a)*83;
  layers.push(layer(`clay confetti ${i}`,[i%3?rect('confetti',5+(i%4),11,3,[C.cream,C.lilac,C.mint][i%3]):star(5,C.cream)],[160,160],{p:anim([[0,[160,170,0]],[36,[x,y,0]],[110,[x+Math.cos(a)*20,y+75,0]],[150,[x,y+95,0]]]),r:anim([[0,i*17],[150,i*17+240]]),o:anim([[0,0],[8,100],[85,100],[145,0],[180,0]])}));
 }
 layers.push(layer('stem',[line('stem',[[0,2],[0,-55],[8,-99]],C.green,10)],[160,226],{s:anim([[0,[100,40,100]],[46,[100,100,100]],[180,[100,100,100]]])}));
 const leaf=(name,p,rotation,delay)=>layer(name,[group('sculpted leaf',[ellipse('leaf underside',70,39,'#58877B','#58877B',[0,3]),ellipse('clay leaf',70,39,C.mint,C.green),line('leaf vein',[[-22,0],[18,0]],'#A7D2B7',2)])],p,{r:anim([[0,rotation-25],[50+delay,rotation],[120,rotation+4],[180,rotation]]),s:anim([[0,[35,35,100]],[50+delay,[100,100,100]],[180,[100,100,100]]])});
 layers.push(leaf('left leaf',[132,165],30,0),leaf('right leaf',[185,136],-35,9));
 layers.push(layer('seed pot',[group('pot',[rect('pot shadow',106,63,22,C.honey,C.honey,[0,5]),rect('peach pot',106,63,22,C.cream,C.peach),rect('rounded rim',119,18,9,C.cream,C.honey,[0,-25]),group('pot geometric inlay',[star(12,C.purple)],tr([0,4]))])],[160,230]));
 save('morning-bloom',layers);
}
// Transparent accent scene for the existing raster clay landscapes.
save('stardust',sparkles());

// Onboarding: sculpted moon resting in a billowy cloud cradle.
function cloud(name, x, y, scale=1) {
 return layer(name,[group('pillowy cloud',[
  ellipse('cloud contact',160,35,'#494461','#494461',[0,9]),
  ellipse('left pillow',80,53,'#E0D5F4','#8C83AB',[-48,0]),
  ellipse('right pillow',80,53,'#DED2F1','#8C83AB',[48,0]),
  ellipse('center pillow',98,78,'#F3EAFD','#AEA0CA',[0,-15]),
  ellipse('front pillow',135,35,'#E9DFF7','#B2A1CF',[0,14]),
 ],tr([0,0],[scale*100,scale*100]))],[x,y],{p:float(x,y,5)});
}
{
 const layers=[layer('ambient halo',[ellipse('halo',267,267,'#141729')],[160,151]),...sparkles(),cloud('back cloud',215,215,.72)];
 const crescent={ty:'gr',nm:'sculpted crescent',it:[{ty:'sh',ks:prop({
  v:[[29,-78],[-63,-28],[-51,56],[30,78],[79,22]],
  i:[[-80,25],[12,-32],[-18,-20],[-30,13],[0,27]],
  o:[[-42,-12],[-18,32],[24,34],[31,-14],[-80,30]],c:true})},grad(C.cream,C.honey,160),tr()]};
 layers.push(layer('sleeping moon',[group('moon',[crescent,ellipse('thumbprint',20,39,C.white,C.white,[-45,-8],24)])],[151,135],{p:float(151,135,9),r:anim([[0,-9],[90,-2],[180,-9]])}));
 layers.push(layer('little lantern',[group('clay lantern',[
  ellipse('lantern dome',32,24,C.cream,C.honey,[0,-18]),
  rect('lantern body',32,39,8,C.cream,C.peach),
  rect('arched light',13,29,7,C.white,C.honey),
  rect('lantern base',38,7,3,C.cream,C.honey,[0,20]),
  ellipse('lantern finial',6,9,C.cream,C.honey,[0,-33]),
 ])],[241,218]));
 layers.push(cloud('front cloud',124,239,1.12));
 layers.push(layer('dangling little star',[star(14,C.cream)],[244,112],{p:float(244,112,12),r:anim([[0,-12],[90,12],[180,-12]])}));
 save('moon-cradle',layers);
}
// Onboarding: sunrise above a miniature, layered clay garden.
{
 const layers=[layer('ambient halo',[ellipse('halo',272,272,'#191827')],[160,151]),...sparkles()];
 const rays=Array.from({length:10},(_,i)=>group('soft ray',[rect('ray',7,18,4,C.cream,C.peach,[0,-63])],tr([0,0],[100,100],i*36)));
 layers.push(layer('rising sun',[group('sun and rays',[...rays,sun(88)])],[163,104],{p:anim([[0,[163,112,0]],[90,[163,93,0]],[180,[163,112,0]]]),r:anim([[0,-4],[90,4],[180,-4]])}));
 layers.push(layer('garden base',[group('layered little world',[
  ellipse('shadow',222,37,'#0D1020','#0D1020',[0,36]),
  ellipse('lilac underside',246,86,'#625789','#453B68',[0,16]),
  ellipse('lilac island',246,76,'#C2ACDE','#87709F',[0,1]),
  ellipse('green edge',207,64,'#80AC9D','#507D79',[0,-3]),
  ellipse('moss pillow',207,58,'#C7E0C3','#7EAD9B',[0,-12]),
  ellipse('garden path',105,26,C.cream,C.peach,[13,-4]),
 ])],[160,224]));
 for(const [x,y,s] of [[81,183,.8],[234,173,1],[202,211,.5]]){
  layers.push(layer('little clay tree',[group('tree',[rect('trunk',9,57,5,C.cream,C.honey,[0,17]),ellipse('canopy underside',49,69,'#527F7D','#527F7D',[0,-19]),ellipse('canopy',49,65,C.mint,C.green,[-2,-23]),ellipse('leaf highlight',12,27,'#E6F1D6','#E6F1D6',[-11,-31],35)],tr([0,0],[s*100,s*100]))],[x,y],{r:anim([[0,-3],[90,3],[180,-3]])}));
 }
 layers.push(cloud('passing cloud',71,126,.42));
 save('dawn-garden',layers);
}
// Onboarding: a rounded bedside clock with rocking bells and moving hands.
{
 const layers=[layer('ambient halo',[ellipse('halo',260,260,'#171629')],[160,151]),...sparkles(),cloud('clock cushion',160,252,1.2)];
 const pieces=[line('left foot',[[-42,55],[-54,80]],C.purple,15),line('right foot',[[42,55],[54,80]],C.purple,15),
  ellipse('clock case edge',161,161,C.deep,C.deep,[0,7]),ellipse('clock case',161,161,C.lilac,C.purple),
  ellipse('face inset',137,137,'#7E679D','#7E679D'),ellipse('clock face',125,125,C.white,'#EDD2AF'),
  ...Array.from({length:12},(_,i)=>group('hour marker',[rect('tick',i%3?3:5,i%3?5:9,2,C.purple,C.purple,[0,-51])],tr([0,0],[100,100],i*30)))];
 layers.push(layer('clock body',[group('clock',pieces)],[160,165],{p:float(160,165,4)}));
 for(const side of [-1,1]) layers.push(layer('soft alarm bell',[group('bell',[rect('bell edge',65,34,17,C.honey,C.honey,[0,4]),rect('clay bell',65,34,17,C.cream,C.peach)],tr())],[160+side*61,83],{r:anim([[0,side*29],[60,side*29],[68,side*18],[76,side*38],[84,side*18],[92,side*29],[180,side*29]]),p:float(160+side*61,83,4)}));
 layers.push(layer('hour hand',[line('hour',[[0,0],[-23,-20]],C.deep,6)],[160,165],{p:float(160,165,4)}));
 layers.push(layer('minute hand',[line('minute',[[0,0],[0,-37]],C.purple,4)],[160,165],{r:anim([[0,0],[90,18],[180,0]]),p:float(160,165,4)}));
 layers.push(layer('center pin',[ellipse('pin',11,11,C.peach,C.honey)],[160,165],{p:float(160,165,4)}));
 save('cloud-clock',layers);
}

// Four one-shot, button-sized compositions. The 360 × 72 stage fills the CTA;
// these are decorative illustrations, never the source of navigation state.
function saveButton(name, layers) {
 const frames=24;
 const data={v:'5.12.2',fr:30,ip:0,op:frames,w:360,h:72,nm:`Refresh · ${name}`,ddd:0,assets:[],layers:layers.reverse().map(l=>({...l,op:frames})),markers:[]};
 fs.writeFileSync(path.join(out,`${name}.json`),JSON.stringify(data));
 console.log(name,`${(Buffer.byteLength(JSON.stringify(data))/1024).toFixed(1)} KB`);
}
const vanish = anim([[0,0],[2,100],[18,100],[24,0]]);
function buttonDust(color, mode) {
 return Array.from({length:9},(_,i)=>{
  const x=55+i*29, y=i%2?53:18, start=2+i%4;
  return layer(`tiny ${mode} sparkle ${i}`,[star(i%3?2.5:4,color)],[x,y],{
   o:anim([[0,0],[start,0],[start+3,85],[start+10,0],[24,0]]),
   p:anim([[0,[x-10,y+8,0]],[18,[x+12,y-6,0]],[24,[x+12,y-6,0]]]),
   r:anim([[0,-20],[24,60]])});
 });
}
{
 const layers=[];
 for(let i=0;i<4;i++) layers.push(layer(`comet ribbon ${i}`,[rect('rounded stardust ribbon',72-i*13,4,2,i%2?C.purple:C.white)], [28,36],{
  p:anim([[0,[-70-i*19,36+i*5,0]],[9,[110-i*19,31+i*5,0]],[18,[307-i*19,36+i*5,0]],[24,[390,36,0]]]),o:vanish}));
 layers.push(...buttonDust(C.purple,'night'));
 layers.push(layer('sculpted shooting star',[group('lilac star',[group('soft edge',[star(16,C.deep)],tr([0,3])),star(16,C.lilac),star(7,C.white)])],[35,36],{
  p:anim([[0,[27,41,0]],[7,[95,24,0]],[15,[270,32,0]],[24,[343,37,0]]]),r:anim([[0,-24],[12,85],[24,165]]),o:vanish}));
 saveButton('button-starlight',layers);
}
{
 const layers=[layer('sweeping dawn ribbon',[ellipse('warm dawn',220,66,C.cream,C.honey)],[38,64],{
  p:anim([[0,[-110,66,0]],[12,[175,64,0]],[24,[460,66,0]]]),o:anim([[0,0],[4,40],[18,40],[24,0]])}),...buttonDust(C.honey,'sunrise')];
 const rays=Array.from({length:10},(_,i)=>group('sunbeam',[rect('soft ray',3,8,2,C.purple,C.purple,[0,-24])],tr([0,0],[100,100],i*36)));
 layers.push(layer('little sunrise',[group('sunrise',[...rays,sun(32)])],[36,53],{
  p:anim([[0,[37,65,0]],[8,[110,31,0]],[16,[247,30,0]],[24,[330,43,0]]]),r:anim([[0,-20],[24,35]]),o:vanish}));
 saveButton('button-sunrise',layers);
}
{
 const layers=buttonDust(C.purple,'matching');
 for(let i=0;i<2;i++) layers.push(layer(`matching clay tile ${i}`,[group('tile',[rect('tile edge',30,35,8,C.deep,C.deep,[0,3]),rect('tile face',30,35,8,i?C.mint:C.lilac,i?C.green:C.purple),star(7,C.white)])],[i?285:65,36],{
  p:anim([[0,[i?286:74,36,0]],[8,[i?207:153,36,0]],[14,[i?196:164,36,0]],[24,[i?325:300,36,0]]]),
  r:anim([[0,i?24:-24],[8,i?-10:10],[14,0],[24,i?20:-20]]),
  s:anim([[0,[100,100,100]],[5,[30,100,100]],[10,[100,100,100]],[24,[100,100,100]]]),o:vanish}));
 layers.push(layer('pair spark',[star(12,C.purple)],[180,15],{o:anim([[0,0],[9,0],[12,100],[18,0],[24,0]]),r:anim([[0,-30],[24,50]])}));
 saveButton('button-match',layers);
}
{
 const layers=buttonDust(C.purple,'bell');
 for(const side of [-1,1]) for(let i=0;i<3;i++) layers.push(layer(`bell ripple ${side} ${i}`,[line('rounded sound wave',[[0,-12],[side*5,0],[0,12]],C.purple,3)], [180+side*(36+i*16),36],{
  p:anim([[0,[180+side*25,36,0]],[18,[180+side*(65+i*25),36,0]],[24,[180+side*(80+i*25),36,0]]]),o:anim([[0,0],[3+i*2,0],[7+i*2,80],[20,0],[24,0]])}));
 const bell=[ellipse('bell contact',33,8,C.deep,C.deep,[0,15]),rect('clay bell',29,32,14,C.lilac,C.purple,[0,-2]),rect('bell lip',37,7,4,C.lilac,C.purple,[0,12]),ellipse('clapper',8,8,C.honey,C.honey,[0,20]),ellipse('handle',9,7,C.purple,C.purple,[0,-22]),ellipse('thumbprint',6,14,C.white,C.white,[-7,-6],45)];
 layers.push(layer('ringing clay bell',[group('bell',bell)],[180,34],{r:anim([[0,-16],[4,16],[8,-13],[12,10],[16,-5],[20,0],[24,0]]),o:vanish}));
 saveButton('button-bell',layers);
}

// Mission collection: small, faceless clay objects with readable silhouettes.
// Append new scenes so the established assets keep their deterministic layer IDs.
function missionBase(width=170) {
 return [...sparkles(),layer('soft contact shadow',[ellipse('shadow',width,15,'#151426')],[160,269])];
}
function clayTile(name,w,h,color,p=[0,0]) {
 return group(name,[rect('raised underside',w,h,13,C.deep,C.deep,[0,5]),
  rect('soft clay surface',w,h,13,color,color===C.cream?C.honey:C.purple),
  ellipse('soft edge highlight',w*.58,5,C.white,C.white,[-w*.06,-h*.34],28)],tr(p));
}
{
 const layers=missionBase();
 layers.push(layer('winding number path',[line('trail',[[-83,35],[-61,-22],[0,30],[66,-30]],C.purple,9)],[160,162]));
 const digits=[
  [[-10,-9],[0,-17],[0,17]],
  [[-12,-11],[-5,-18],[7,-18],[13,-10],[10,-3],[-12,17],[13,17]],
  [[-12,-16],[12,-16],[0,0],[11,4],[13,12],[6,18],[-12,16]],
 ];
 for(const [i,[x,y]] of [[0,[87,170]],[1,[157,125]],[2,[226,193]]]) {
  layers.push(layer(`number tile ${i+1}`,[group('number stone',[clayTile('stone',75,81,i===1?C.cream:C.lilac),line(`number ${i+1}`,digits[i],i===1?C.deep:C.white,7)])],[x,y],{p:float(x,y,5+i*2),r:anim([[0,i===1?5:-8],[90,i===1?-3:3],[180,i===1?5:-8]])}));
 }
 save('mission-number-trail',layers);
}
{
 const layers=missionBase();
 layers.push(layer('recall board',[group('rounded board',[rect('board edge',211,211,32,C.deep,C.deep,[0,7]),rect('lavender board',211,211,32,C.lilac,C.purple)])],[160,164]));
 for(let i=0;i<9;i++) {
  const x=102+(i%3)*58,y=106+Math.floor(i/3)*58;
  layers.push(layer(`memory tile ${i+1}`,[clayTile('blank tile',46,46,C.purple)],[x,y]));
  if([1,3,8].includes(i)) layers.push(layer(`remembered light ${i+1}`,[clayTile('lit blank tile',46,46,C.cream)],[x,y],{o:anim([[0,100],[60,100],[72,55],[100,55],[112,100],[165,100],[180,100]])}));
 }
 save('mission-tile-recall',layers);
}
{
 const layers=missionBase();
 layers.push(layer('echo board',[group('six-pad board',[rect('base edge',174,221,33,C.deep,C.deep,[0,7]),rect('sculpted base',174,221,33,C.lilac,C.purple)])],[160,165]));
 for(let i=0;i<6;i++) {
  const x=124+(i%2)*72,y=101+Math.floor(i/2)*64;
  layers.push(layer(`echo pad ${i+1}`,[clayTile('pad',58,51,i%3===2?C.mint:C.purple)],[x,y]));
  const order=[0,3,4].indexOf(i);
  if(order>=0) {
   const start=10+order*50;
   layers.push(layer(`echo light ${i+1}`,[clayTile('warm light',58,51,C.cream)],[x,y],{o:anim([[0,0],[start,0],[start+8,100],[start+32,100],[start+42,0],[180,0]])}));
  }
 }
 save('mission-pattern-echo',layers);
}
function littleCrescent() {
 return {ty:'gr',nm:'faceless crescent',it:[{ty:'sh',ks:prop({
  v:[[10,-27],[-22,-10],[-18,20],[10,27],[27,8]],
  i:[[-28,9],[4,-11],[-6,-7],[-10,5],[0,9]],
  o:[[-15,-4],[-6,11],[8,12],[11,-5],[-28,10]],c:true})},grad(C.cream,C.honey,60),tr()]};
}
{
 const layers=missionBase(190);
 const pages=[
  group('left cover',[clayTile('cover',96,121,C.lilac)],tr([-48,8],[100,100],-7)),
  group('right cover',[clayTile('cover',96,121,C.lilac)],tr([48,8],[100,100],7)),
  group('left pages',[rect('page stack',82,104,13,C.cream,C.peach),...[-22,0,22].map(y=>line('page rule',[[-25,y],[23,y+4]],C.honey,4))],tr([-43,0],[100,100],-7)),
  group('right pages',[rect('page stack',82,104,13,C.white,C.cream),...[-22,0,22].map(y=>line('page rule',[[-23,y+4],[25,y]],C.peach,4))],tr([43,0],[100,100],7)),
  line('book spine',[[0,-43],[0,61]],C.purple,5),rect('ribbon bookmark',12,52,4,C.mint,C.green,[62,38]),
 ];
 layers.push(layer('open dua book',[group('open book',pages)],[160,188],{p:float(160,188,5),r:anim([[0,-3],[90,2],[180,-3]])}));
 layers.push(layer('crescent above the pages',[littleCrescent()],[155,85],{p:float(155,85,7),r:anim([[0,-8],[90,4],[180,-8]])}));
 layers.push(layer('small geometric star',[star(10,C.cream)],[214,88],{o:anim([[0,60],[90,100],[180,60]])}));
 save('mission-duas',layers);
}
{
 const layers=missionBase();
 const arch=(name,color,scale=1)=>({ty:'gr',nm:name,it:[{ty:'sh',ks:prop({
  v:[[-80,95],[-80,-10],[0,-103],[80,-10],[80,95]],
  i:[[0,0],[0,35],[-26,28],[0,-45],[0,0]],
  o:[[0,0],[0,-45],[26,28],[0,35],[0,0]],c:true})},grad(color,color===C.lilac?C.purple:C.deep,190),tr([0,0],[scale*100,scale*100])]});
 layers.push(layer('dawn arch',[group('arched window',[arch('outer clay arch',C.lilac),arch('recessed sky',C.deep,.77)])],[160,157]));
 const rays=Array.from({length:7},(_,i)=>group('soft sunrise ray',[rect('ray',5,14,3,C.cream,C.honey,[0,-52])],tr([0,0],[100,100],-90+i*30)));
 layers.push(layer('faceless dawn',[group('sunrise',[...rays,sun(63)])],[160,159],{p:anim([[0,[160,168,0]],[90,[160,152,0]],[180,[160,168,0]]])}));
 layers.push(layer('dawn horizon',[group('quiet morning',[rect('horizon',118,25,11,C.lilac,C.purple,[0,0]),rect('sage horizon',118,24,10,C.mint,C.green,[0,18]),rect('arch sill',185,18,9,C.cream,C.honey,[0,43])])],[160,204]));
 layers.push(layer('lantern beside the arch',[group('morning lantern',[
  ellipse('dome',30,23,C.cream,C.honey,[0,-21]),rect('lantern frame',33,42,8,C.cream,C.honey),
  rect('warm window',15,29,7,C.white,C.peach),rect('foot',39,7,4,C.cream,C.honey,[0,24]),ellipse('finial',6,10,C.cream,C.honey,[0,-36])])],[245,231],{o:anim([[0,82],[90,100],[180,82]])}));
 save('mission-fajr',layers);
}
