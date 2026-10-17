import type {Game} from './types';
const first=Array.from('青白雲長安永清玉金松竹洛平北南東西龍鳳春秋河海山天寧景盛明新高');
const last=Array.from('林川城溪谷原陽陵州安嶺泉江湖港山橋澤田浦關京營津');
export function uniqueCityName(g:Game,offset=0){const used=new Set(g.nodes.map(n=>n.name));for(let i=0;i<first.length*last.length;i++){const k=(g.seed+g.next+offset+i)%(first.length*last.length),name=first[Math.floor(k/last.length)]+last[k%last.length];if(!used.has(name))return name;}for(const a of first)for(const b of first)for(const c of last){const name=a+b+c;if(!used.has(name))return name;}throw new Error('城名已用盡');}
export function normalizeCityNames(g:Game){const seen=new Set(g.nodes.filter(n=>n.owner===g.player).map(n=>n.name));for(const n of g.nodes){if(!['capital','village','ruins'].includes(n.kind))continue;const generated=/^新府(?:\s*[(（]\d+[,，]\s*\d+[)）])?$/.test(n.name);if((generated&&!n.customName)||(n.owner!==g.player&&seen.has(n.name)))n.name=uniqueCityName(g);seen.add(n.name);}}
