import type {FormalWorld} from './model';
import {enableAutonomy} from './autonomy';
import {EventScheduler} from './scheduler';
/** B4/B5 domain fixtures already have persisted AI metadata. Defer strategic decisions so a queue/combat deadline test remains isolated. Real AI and migration have independent integration tests. */
export function isolatedAutonomyFixture(w:FormalWorld){enableAutonomy(w);for(const a of w.autonomy?.agents??[]){if(!a.eventId)continue;a.nextAt=w.time+30*86400000+(a.nextAt-w.time);const e=w.events.find(e=>e.id===a.eventId);if(e)e.at=a.nextAt;}w.events=new EventScheduler(w.events).snapshot();return w;}
