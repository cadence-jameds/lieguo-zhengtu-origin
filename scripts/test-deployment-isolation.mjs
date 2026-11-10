// User decision 2026-11-10: retain automatic main Pages publication.
import {readFileSync} from 'node:fs';
import {it} from 'node:test';
import assert from 'node:assert/strict';
const workflow=readFileSync(new URL('../.github/workflows/deploy-pages.yml',import.meta.url),'utf8'),deploy=workflow.split('\n  deploy:\n')[1];
it('retains automatic main push and manual dispatch triggers without a release token',()=>{
 assert.ok(workflow.includes('push:\n    branches: [main]'));assert.ok(workflow.includes('workflow_dispatch:'));assert.ok(!workflow.includes('PUBLISH_B10'));assert.ok(!workflow.includes('inputs.release_sha'));
});
it('publication is limited to official main and requires a successful build',()=>{
 assert.ok(deploy.includes("if: github.ref == 'refs/heads/main' && github.repository == 'cadence-jameds/lieguo-zhengtu-origin'"));assert.ok(deploy.includes('needs: build'));assert.ok(deploy.includes('actions/deploy-pages@v4'));assert.ok(!deploy.includes("github.event_name == 'workflow_dispatch'"));
});
it('retains full regression, typecheck, build, Pages and release checks before publication',()=>{
 for(const check of ['npm ci','npm run typecheck','node scripts/verify-in-isolation.mjs full','npm run build','node scripts/check-pages-build.mjs','node scripts/check-release-build.mjs','actions/upload-pages-artifact@v3']){assert.ok(workflow.includes(check),check);assert.ok(workflow.indexOf(check)<workflow.indexOf('\n  deploy:\n'),check);}
});
