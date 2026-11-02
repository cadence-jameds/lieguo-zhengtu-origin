import {memo,useMemo,type ComponentProps} from 'react';
import FormalCityPanel from './FormalCityPanel';
import {usePresentationSelector} from './usePresentation';
import {cityScreenSelector} from './presentationSelectors';
import type {PresentationStore} from './presentationStore';
type Props=Omit<ComponentProps<typeof FormalCityPanel>,'world'>&{store:PresentationStore};
export const ConnectedCityPanel=memo(function ConnectedCityPanel({store,...props}:Props){
 const select=useMemo(()=>cityScreenSelector(props.cityId),[props.cityId]),world=usePresentationSelector(store,select);
 return world?<FormalCityPanel key={world.campaignId+':'+world.projection.branch+':'+world.projection.writerEpoch} {...props} world={world}/>:null;
});
