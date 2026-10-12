import {assetURL} from './presentation/artMap';
export function BrandMark({small=false}:{small?:boolean}){
  return <img className={'seal brand-emblem'+(small?' small':'')} src={assetURL("icons/lieguo-crimson-lion.png")} alt="列國征途猩紅獅王戰旗標誌"/>;
}
