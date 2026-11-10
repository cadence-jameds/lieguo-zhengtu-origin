import {WorldStream} from '../worldStream';
import {fixtureProjection} from './projectionTestSupport';
export function fixtureStream(){return new WorldStream(crypto.randomUUID(),{build:fixtureProjection,reset:()=>{}});}
