export type EngineStatus='loading'|'ready'|'error'|'locked';
export type CampaignStatus='checking'|'empty'|'stored'|'incompatible'|'unreadable'|'active'|'historical';
export class UpdateSafetyError extends Error {constructor(message:string){super(message);this.name='UpdateSafetyError';}}
export function updateEligibility(p:{status:EngineStatus;hasWorld:boolean;busy:boolean;updating:boolean;campaignStatus:CampaignStatus}){
 const label=p.hasWorld?'保存進度並載入新版':p.campaignStatus==='historical'?'保留歷史資料並載入新版':'載入新版';
 const blocked=(code:string,reason:string)=>({disabled:true,code,reason,label});
 if(p.updating)return blocked('updating','正在準備或載入新版，請勿重複操作。');
 if(p.busy)return blocked('busy','正在處理指令或保存，完成後才能更新。');
 if(p.status==='loading')return blocked('loading','正在讀取或推進戰役，完成後才能更新。');
 if(p.status==='locked')return blocked('locked','另一分頁正在使用戰役，請先關閉該分頁再重新讀取。');
 if(p.hasWorld){if(p.status!=='ready')return blocked('engine-error','引擎發生異常，請先重新讀取；原始資料保留。');return {disabled:false,code:'save',reason:'更新前會等待正式保存完成。',label};}
 if(p.campaignStatus==='empty')return {disabled:false,code:'empty',reason:'已確認本機沒有戰役資料，可直接載入新版。',label};
 if(p.campaignStatus==='historical')return {disabled:false,code:'historical',reason:'當前戰役資料為空，舊戰役僅作唯讀封存；確認保留歷史資料後可載入新版，不會宣告已保存戰役。',label};
 if(p.campaignStatus==='incompatible')return blocked('incompatible','本機戰役版本不相容，更新暫停；請先匯出原始備份或重新讀取，資料保留。');
 if(p.campaignStatus==='stored')return blocked('stored','本機仍有尚未成功載入的戰役或備份；請先重新讀取或匯出原始備份。');
 if(p.campaignStatus==='unreadable')return blocked('read-error','無法確認本機戰役資料，更新暫停；請重試讀取，資料保留。');
 return blocked('checking','正在確認本機戰役資料，尚不能更新。');
}
