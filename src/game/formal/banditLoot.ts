import {resourceKeys,zeroResources,type Resources} from './model';
import {seedHash} from './terrain';

/** Generation identity only: no wall clock or mutable RNG state. */
export function banditShares(seed:number,slot:number,generation:number){
 const shares:number[]=[];let remaining=100;
 for(let i=0;i<3;i++){
  const left=3-i,low=Math.max(15,remaining-35*left),high=Math.min(35,remaining-15*left);
  const share=low+seedHash(seed,slot,generation,700+i)%(high-low+1);
  shares.push(share);remaining-=share;
 }
 shares.push(remaining);
 // Shuffle so the sequential feasible ranges do not privilege a resource.
 for(let i=3;i>0;i--){const j=seedHash(seed,slot,generation,710+i)%(i+1);[shares[i],shares[j]]=[shares[j],shares[i]];}
 return Object.fromEntries(resourceKeys.map((r,i)=>[r,shares[i]])) as Resources;
}

/** Largest remainders, with resource order as the deterministic tie-break. */
export function proportionalResources(weights:Resources,total:number,minShare=0,maxShare=1){
 const sum=resourceKeys.reduce((n,r)=>n+weights[r],0),out=zeroResources();
 if(!sum||total<=0)return out;
 const target=Math.floor(total),lower=Math.ceil(target*minShare),upper=Math.floor(target*maxShare),rank=resourceKeys.map((r,i)=>{const exact=weights[r]*target/sum;out[r]=Math.max(lower,Math.min(upper,Math.floor(exact)));return {r,i,exact};});
 let remainder=target-resourceKeys.reduce((n,r)=>n+out[r],0);
 
 while(remainder!==0){
 const candidates=[...rank].sort((a,b)=>remainder>0?(b.exact-out[b.r])-(a.exact-out[a.r])||a.i-b.i:(a.exact-out[a.r])-(b.exact-out[b.r])||a.i-b.i);
 const item=candidates.find(({r})=>remainder>0?out[r]<upper:out[r]>lower);
 if(!item)throw new Error('Infeasible integer resource bounds');
 const step=remainder>0?1:-1;out[item.r]+=step;remainder-=step;
}
 return out;
}
