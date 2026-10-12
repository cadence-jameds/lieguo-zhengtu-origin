"""Compile independently supplied v85 Markdown; never import game balance values."""
import sys,re,json,hashlib
from pathlib import Path
source=Path(sys.argv[1]); raw=source.read_bytes(); lines=raw.decode().splitlines()
EXPECTED='fac5536c86935ccd99ee41cd58076bd1f1a401b4b3bc091c8195728a432439d9'
assert hashlib.sha256(raw).hexdigest()==EXPECTED, 'v85 content changed: review before replacing reference'
def clean(s): return s.replace('**','').replace('`','').strip()
def num(s):
 s=clean(s).replace(',',''); m=re.search(r'(\d+(?:\.\d+)?)\s*([kKM]?)',s)
 assert m,s
 return float(m[1])*({'k':1000,'K':1000,'M':1000000}.get(m[2],1))
def time(s):
 s=clean(s).replace('分','m').replace('秒','s').replace('小時','h')
 pairs=re.findall(r'(\d+(?:\.\d+)?)\s*([hms])',s)
 assert pairs,s
 return round(sum(float(n)*{'h':3600000,'m':60000,'s':1000}[u] for n,u in pairs))
tables=[]; i=0
while i<len(lines):
 if lines[i].startswith('|') and i+1<len(lines) and re.match(r'^\|[ :|\-]+$',lines[i+1]):
  header=[clean(c) for c in lines[i].strip('|').split('|')]; start=i+1; i+=2; rows=[]
  while i<len(lines) and lines[i].startswith('|'):
   rows.append({'line':i+1,'cells':[clean(c) for c in lines[i].strip('|').split('|')]}); i+=1
  tables.append({'line':start,'header':header,'rows':rows})
 else:i+=1
def table(lo,hi,first=None):
 ts=[t for t in tables if lo<=t['line']<=hi and (first is None or first in t['header'][0])]
 assert len(ts)==1,(lo,hi,len(ts)); return ts[0]
build_names={'城市中心':'center','民居':'residence','倉庫':'warehouse','地洞':'bunker','兵營':'barracks','城牆':'wall','射箭場':'archery','馬廄':'stable','鐵匠鋪':'blacksmith','學院':'academy','市場':'market','市政廳':'townhall','使館':'embassy','磨坊':'mill','鋸木場':'lumbermill','石匠工坊':'masonry','石匠':'masonry','鑄幣所':'mint','攻城工坊':'workshop','城堡':'castle','修道院':'monastery'}
ages={'黑暗':0,'封建':1,'城堡':2,'帝王':3}
def prereqs(s):
 out={}
 for name,lv in re.findall(r'(城市中心|鐵匠鋪|攻城工坊|鑄幣所|鋸木場|石匠工坊|市政廳|射箭場|學院|兵營|磨坊|石匠|馬廄|倉庫|民居|城堡|使館|市場)\s*(?:Lv)?\s*(\d+)',s):out[build_names[name]]=int(lv)
 return out
ranges={'center':(1060,1080,1.44),'residence':(1157,1187,1.41),'warehouse':(599,632,1.28),'bunker':(696,724,1.28),'market':(1671,1701,1.36),'townhall':(1702,1732,1.40),'embassy':(1733,1763,1.34),'blacksmith':(1242,1272,1.39),'academy':(1273,1303,1.40),'workshop':(1789,1819,1.39),'castle':(1820,1850,1.40),'monastery':(1851,1883,1.38),'wall':(1884,1914,1.38)}
buildings=[]
for row in table(985,1009)['rows']:
 name,age,req,desc=row['cells']; key=build_names[name.replace('（建築）','')]
 d={'id':key,'name':name,'age':ages[age],'buildings':prereqs(req),'condition':req,'effect':desc,'line':row['line'],'maxLevel':8 if key in ['mill','lumbermill','masonry','mint'] else 15}
 if key in ranges:
  lo,hi,growth=ranges[key]; ts=table(lo,hi); cs=ts['header']; d['growth']=growth;d['baseCost']={r:num(ts['rows'][0]['cells'][cs.index(n)]) for r,n in zip(['food','wood','stone','gold'],['糧','木','石','金'])}
  durationcol=next(j for j,n in enumerate(cs) if '工期' in n or '升級時間' in n)
  d['levels']=[{'level':int(num(r['cells'][0])),'cost':{k:num(r['cells'][cs.index(n)]) for k,n in zip(['food','wood','stone','gold'],['糧','木','石','金'])},'durationMs':time(r['cells'][durationcol]),'line':r['line']} for r in ts['rows']]
 elif key in ['barracks','archery','stable']:
  ts=table(2833,2840); rr=next(r for r in ts['rows'] if build_names[r['cells'][0]]==key);d['baseCost']={k:num(rr['cells'][j+1]) for j,k in enumerate(['food','wood','stone','gold'])};d['growth']=1.37
  ts=table(2841,2874); dc={'barracks':3,'archery':5,'stable':7}[key];d['levels']=[{'level':int(num(r['cells'][0])),'durationMs':time(r['cells'][dc]),'line':r['line']} for r in ts['rows']]
 else:
  ts=table(923,938);rr=next(r for r in ts['rows'] if build_names[r['cells'][0]]==key);d['baseCost']={k:num(rr['cells'][j+1]) for j,k in enumerate(['food','wood','stone','gold'])};d['growth']=1.67
  d['levels']=[{'level':int(num(r['cells'][0])),'durationMs':time(r['cells'][3]),'line':r['line']} for r in table(939,955)['rows']]
 buildings.append(d)
# Name-to-ID adapters contain identifiers only, not balance numbers.
tech_names={'城鎮警戒':'intel.watch','巡邏制度':'intel.patrol','軍情研判':'intel.analysis','戰場情報網':'intel.network','軍事操典':'military.drill','馬術訓練':'military.horsemanship','馬匹育種':'military.breeding','徵兵制度':'military.conscription','運輸組織':'logistics.transport','商路管理':'logistics.auto','車隊調度':'logistics.dispatch','輜重標準化':'logistics.baggage','軍糧配給':'logistics.rations','石造工程':'engineering.masonry','建築學':'engineering.architecture','行政統籌':'administration.coordination','領地帳冊':'administration.register','步兵精銳化':'elite.infantry','遠程精銳化':'elite.ranged','騎兵精銳化':'elite.cavalry','文明衛隊精銳化':'elite.guard','考工制度':'civilization.kaogong','連弩操典':'civilization.crossbow','軍區制度':'civilization.themes','帝都城防':'civilization.imperial-wall','騎士制度':'civilization.knighthood','重騎衝鋒':'civilization.charge','郡民弓役':'civilization.archer-levy','戰狼投石':'civilization.warwolf','武家動員':'civilization.mobilization','投石術':'civilization.sling','遊牧補給':'civilization.nomadic','疾行攻城':'civilization.swift-siege','現代步兵武裝':'modern.infantry-weapons','個人防護裝備':'modern.personal-protection','複合裝甲':'modern.composite-armor','數位火控系統':'modern.digital-fire-control','機械化後勤':'modern.mechanized-logistics','戰場補給體系':'modern.supply-system','現代動員制度':'modern.mobilization','現代攻城工程':'modern.siege-engineering','戰術資料鏈':'modern.data-link'}
for stem,key in [('近戰武器','blacksmith.melee'),('遠程武器','blacksmith.ranged'),('步兵護具','blacksmith.infantry-armor'),('遠程護具','blacksmith.ranged-armor'),('騎兵護具','blacksmith.cavalry-armor'),('農業','economy.food'),('林業','economy.wood'),('採石','economy.stone'),('採礦','economy.gold'),('破城工程','siege.ram'),('投射工程','siege.projection'),('強化機架','siege.frame')]:
 for i,roman in enumerate(['I','II','III'],1):tech_names[stem+' '+roman]=key+'.'+str(i)
civs={'中國':'civ_zhongguo','拜占庭':'civ_byzantium','法蘭克':'civ_frankia','不列顛':'civ_britannia','日本':'civ_japan','蒙古':'civ_mongolia'}
techs=[]
for ts in tables:
 if not(1403<=ts['line']<=1614 or 4450<=ts['line']<=4462):continue
 if '科技' not in ts['header']:continue
 for row in ts['rows']:
  cs=row['cells'];h=ts['header'];name=cs[h.index('科技')];ident=tech_names.get(name)
  assert ident,name
  d={'id':ident,'name':name,'line':row['line'],'cost':{k:num(cs[h.index(n)]) for k,n in zip(['food','wood','stone','gold'],['糧','木','石','金'])},'buildings':{},'milestone':0,'civilizationId':None,'age':0,'effect':cs[h.index('效果')] if '效果' in h else ''}
  if h[0]=='文明':
   d['civilizationId']=civs[cs[0]];second=(row['line']-ts['rows'][0]['line'])%2==1;d.update(age=3 if second else 2,buildings={'academy':15 if second else 10,'castle':10 if second else 5},baseDurationMs=(9 if second else 5)*3600000)
   if second:d['prerequisites']=[techs[-1]['id']]
  else:
   req=cs[h.index('前置')] if '前置' in h else cs[h.index('時代／前置')] if '時代／前置' in h else ''
   age=cs[h.index('時代')] if '時代' in h else req
   d['age']=next((v for k,v in ages.items() if k in age),0);d['buildings']=prereqs(req)
   if '鐵匠鋪' in h:d['buildings']['blacksmith']=int(num(cs[h.index('鐵匠鋪')]))
   ms=re.search(r'曾達(\d+)k',req);d['milestone']=int(ms[1])*1000 if ms else 0
   tc=next(j for j,n in enumerate(h) if '時間' in n);d['baseDurationMs']=time(cs[tc])
  d['category']='elite' if ident.startswith('elite.') else 'blacksmith' if ident.startswith('blacksmith.') else 'civilization' if ident.startswith('civilization.') else 'general'
  d['scope']='modern-common' if ident.startswith('modern.') else 'traditional'
  if d['scope']=='modern-common':d['prerequisites']=['research.cooperation']
  techs.append(d)
# Cooperation explicitly in prose, not a table.
techs.append({'id':'research.cooperation','name':'科研協同體系','line':4405,'age':0,'buildings':{'academy':15},'cost':{'food':60000,'wood':80000,'stone':70000,'gold':90000},'baseDurationMs':14400000,'milestone':0,'civilizationId':None,'category':'general','scope':'research-cooperation','effect':'解鎖同一 Faction 後續現代科技多城投入'})
# Six modern exclusive entries, read directly from their v85 table.
for row in table(4545,4559)['rows']:
 cs=row['cells'];civ=civs[cs[0]]
 techs.append({'id':'modern.'+civ+'.exclusive','name':cs[1],'line':row['line'],'age':0,'buildings':{'academy':15,'castle':15},'cost':{k:num(cs[j+3]) for j,k in enumerate(['food','wood','stone','gold'])},'baseDurationMs':36000000,'milestone':0,'civilizationId':civ,'category':'civilization','scope':'modern-civilization','prerequisites':['research.cooperation'],'effect':cs[2]})
unit_names={'民兵':'militia','槍兵':'spearman','弓兵':'archer','戰矛兵':'skirmisher','斥候':'scout','輕騎兵':'light-cavalry','騎士':'knight','衝撞車':'ram','投石機':'catapult','輜重車':'baggage'}
units=[]
for row in table(2951,2964)['rows']:
 cs=row['cells'];name=cs[0];id=unit_names[name];producer={'militia':'barracks','spearman':'barracks','archer':'archery','skirmisher':'archery','scout':'center','light-cavalry':'stable','knight':'stable','ram':'workshop','catapult':'workshop'}[id]
 d={'id':id,'name':name,'line':row['line'],'producer':producer,'age':0 if id in ['militia','spearman','scout'] else 1 if id in ['archer','skirmisher','light-cavalry','knight'] else 2,'cost':{k:num(cs[j+1]) for j,k in enumerate(['food','wood','stone','gold'])},'upkeepPerHour':num(cs[6]),'population':num(cs[6]),'milestone':0,'civilizationId':None,'eliteTech':None}
 tr=next(r for r in table(2754,2773)['rows'] if r['cells'][0]==name);d['baseDurationMs']=time(tr['cells'][1])
 cr=next(r for r in table(3136,3163)['rows'] if r['cells'][0]==name);d['carry']=num(cr['cells'][1])
 mr=next(r for r in table(3123,3135)['rows'] if name in r['cells'][0]);d['secondsPerTile']=num(mr['cells'][1])
 if id!='scout':
  sr=next(r for r in table(3321,3334)['rows'] if r['cells'][0]==name)
  d.update({k:num(sr['cells'][j+1]) for j,k in enumerate(['hp','attack','meleeDefense','rangedDefense','attackIntervalSeconds'])})
 units.append(d)
units.append({'id':'baggage','name':'輜重車','line':3082,'age':2,'producer':'workshop','cost':{'food':0,'wood':600,'stone':0,'gold':200},'population':2,'upkeepPerHour':2,'attack':0,'carry':1000,'secondsPerTile':60,'baseDurationMs':600000,'milestone':0,'civilizationId':None,'eliteTech':None})
for row in table(3027,3038)['rows']:
 cs=row['cells'];civ=civs[cs[0]];d={'id':'guard.'+civ,'name':cs[1],'line':row['line'],'age':2,'producer':'castle','civilizationId':civ,'eliteTech':None,'milestone':0}
 d.update({k:num(cs[j+2]) for j,k in enumerate(['hp','attack','meleeDefense','rangedDefense','attackIntervalSeconds','population','upkeepPerHour'])});d['baseDurationMs']=time(cs[9])
 cr=next(r for r in table(3054,3066)['rows'] if r['cells'][0]==d['name']);d['cost']={k:num(cr['cells'][j+1]) for j,k in enumerate(['food','wood','stone','gold'])};d['secondsPerTile']=num(cr['cells'][6]);d['carry']=num(cr['cells'][7]);units.append(d)
elites={'militia':('swordsman','劍士','elite.infantry',22000),'spearman':('pikeman','長槍兵','elite.infantry',22000),'archer':('crossbowman','弩手','elite.ranged',25000),'skirmisher':('heavy-skirmisher','重裝戰矛兵','elite.ranged',25000),'light-cavalry':('ranger','遊騎兵','elite.cavalry',25000),'knight':('heavy-knight','重甲騎兵','elite.cavalry',25000)}
for base in list(units):
 if base['id'] not in elites and not base['id'].startswith('guard.'):continue
 ident,name,tech,ms=elites.get(base['id'],('elite.'+base['id'],'精銳'+base['name'],'elite.guard',30000));d={**base,'id':ident,'name':name,'baseId':base['id'],'line':3002,'age':3,'eliteTech':tech,'milestone':ms,'hp':base['hp']*1.15,'attack':base['attack']*1.15,'meleeDefense':base['meleeDefense']+1,'rangedDefense':base['rangedDefense']+1};units.append(d)
# Capture entire original for per-rule source inspection, including unmapped/future content.
sections=[];heads=[(i,l) for i,l in enumerate(lines) if l.startswith('#')]
for pos,(idx,title) in enumerate(heads):
 end=heads[pos+1][0] if pos+1<len(heads) else len(lines)
 sections.append({'id':'line-'+str(idx+1),'line':idx+1,'title':clean(title.lstrip('# ')),'text':'\n'.join(lines[idx:end])})
ref={'version':'v85','sha256':EXPECTED,'fileName':source.name,'buildings':buildings,'techs':techs,'units':units,'tables':tables,'sections':sections,'fieldProduction':[num(r['cells'][1]) for r in table(405,428)['rows']],'housing':[0]+[num(r['cells'][1]) for r in table(1127,1156)['rows']],'warehouseCapacity':[0]+[num(r['cells'][1]) for r in table(518,539)['rows']],'bunkerProtection':[0]+[num(r['cells'][1]) for r in table(667,695)['rows']]}
out=Path('src/game/developer/reference/v85.json');out.write_text(json.dumps(ref,ensure_ascii=False,indent=2)+'\n');print({'buildings':len(buildings),'techs':len(techs),'sections':len(sections),'tables':len(tables),'bytes':out.stat().st_size})
