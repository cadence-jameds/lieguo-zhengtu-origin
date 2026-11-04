import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
const workflow=readFileSync(new URL('../../.github/workflows/deploy-pages.yml',import.meta.url),'utf8');
const deploy=workflow.split('\n  deploy:\n')[1],condition=/^    if: (.+)$/m.exec(deploy)![1];
function allowed(context:{event:string;actor:string;ref:string;repository:string;head:string;approved:string;confirmation:string}){
 const expression=condition.replaceAll('github.event_name','event').replaceAll('github.actor','actor').replaceAll('github.ref','ref').replaceAll('github.repository','repository').replaceAll('inputs.release_sha','approved').replaceAll('github.sha','head').replaceAll('inputs.confirmation','confirmation');
 // The expression comes from the actual versioned workflow, not a duplicate
 // predicate. Context values are arguments, never interpolated executable text.
 return new Function('event','actor','ref','repository','head','approved','confirmation',`return !!(${expression})`)(context.event,context.actor,context.ref,context.repository,context.head,context.approved,context.confirmation);
}
const approved={event:'workflow_dispatch',actor:'cadence-jameds',ref:'refs/heads/main',repository:'cadence-jameds/lieguo-zhengtu-origin',head:'a'.repeat(40),approved:'a'.repeat(40),confirmation:'PUBLISH_B10'};
it('pushes and PRs cannot publish even when the actor, branch and SHA otherwise match',()=>{for(const event of ['push','pull_request','pull_request_target','schedule','workflow_run'])expect(allowed({...approved,event})).toBe(false);});
it('requires an explicit owner dispatch with the exact reviewed main SHA and confirmation',()=>{expect(allowed(approved)).toBe(true);for(const changed of [{actor:'contributor'},{ref:'refs/heads/fix/b10-release-unblock'},{repository:'fork/lieguo-zhengtu-origin'},{approved:'b'.repeat(40)},{confirmation:''},{confirmation:'PUBLISH_B10; anything'}])expect(allowed({...approved,...changed})).toBe(false);});
it('retains main full regression, production build, Pages artifact and metadata verification before deployment',()=>{expect(workflow).toContain('push:\n    branches: [main]');for(const check of ['npm ci','npm run typecheck','node scripts/verify-in-isolation.mjs full','npm run build','node scripts/check-pages-build.mjs','node scripts/check-release-build.mjs','actions/upload-pages-artifact@v3'])expect(workflow.indexOf(check)).toBeLessThan(workflow.indexOf('\n  deploy:\n'));expect(deploy).toContain('needs: build');expect(deploy).toContain('actions/deploy-pages@v4');expect(workflow).toContain('test "$B10_APPROVED_SHA" = "$GITHUB_SHA"');expect(workflow).toContain('test "$B10_RELEASE_CONFIRMATION" = \'PUBLISH_B10\'');});
