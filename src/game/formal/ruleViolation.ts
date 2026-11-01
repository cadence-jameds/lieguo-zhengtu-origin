export class RuleViolation extends Error {}
export function requireRule(ok:unknown,message:string):asserts ok {if(!ok)throw new RuleViolation(message);}
