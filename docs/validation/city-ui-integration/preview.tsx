import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createArtPreviewWorld} from '/scripts/art-preview-world';
import {Shell,type View} from '/src/game/presentation/Shell';
import FormalCityPanel from '/src/game/FormalCityPanel';
import FormalWorldMap from '/src/game/FormalWorldMap';
import {validateFormalWorld} from '/src/game/formal/schema';
import {displayClock} from '/src/game/presentation/liveClock';
import '/src/game/game.css';
import '/src/game/presentation/playable.css';
import '/src/game/presentation/parity.css';
import '/src/game/presentation/integrationV94.css';
const p=new URLSearchParams(location.search),mobile=innerWidth<=932;
let initial=createArtPreviewWorld(p.get('civ')??'civ_zhongguo',Number(p.get('age')??3),p.get('state')??'complete');
const city=initial.cities[0];city.name='河谷東方長城名稱驗收城';
if(!p.has('state')){city.buildings.residence=1;city.buildings['warehouse.0']=9;city.buildings['bunker.0']=10;city.population=300;city.housing=600;city.stock={food:1000,wood:1000,stone:1000,gold:1000};}
if(p.has('vacant')){delete city.buildings.mint;delete city.economy.slots.mint;}
initial=validateFormalWorld(initial);displayClock.adopt({campaignId:initial.campaignId,time:initial.time,speed:initial.speed,running:false});
function Preview(){const [world,setWorld]=useState(initial),[view,setView]=useState<View>(p.get('mode')==='map'?'map':'city'),[centerRequest,setCenterRequest]=useState(0);
 window.setReviewAge=(age)=>setWorld(w=>({...w,factions:w.factions.map(f=>f.id===w.playerFactionId?{...f,age}:f)}));
 const c=world.cities[0],noop=()=>{};
 return <Shell world={world} city={c} cities={[c]} mobile={mobile} view={view} onView={setView} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false} onEra={()=>{setView('city');setCenterRequest(n=>n+1);}}>{view==='city'?<div className="view-scroll city-view"><FormalCityPanel world={world} cityId={c.id} issue={noop} busy={false} mobile={mobile} onRename={()=>{window.renameClicked=true;}} centerRequest={centerRequest}/></div>:<FormalWorldMap world={world} mobile={mobile}/>}</Shell>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
