import {expect,it} from 'vitest';
import {persistenceTime} from './persistenceTime';
import {SaveHealth} from './saveStatus';
import {playerMessage} from './playerMessage';
it.each([0,.25,1.999,1_700_000_000_001.75,Number.MAX_SAFE_INTEGER])('floors %s once without moving the wall boundary forward',value=>{const at=persistenceTime(value);expect(Number.isSafeInteger(at)).toBe(true);expect(at).toBeGreaterThanOrEqual(0);expect(at).toBeLessThanOrEqual(value);expect(value-at).toBeLessThan(1);});
it.each([NaN,Infinity,-Infinity,-.01,-1,Number.MAX_SAFE_INTEGER+1])('rejects illegal wall time %s without substituting zero',value=>expect(()=>persistenceTime(value)).toThrow('SAVE_TIME_INVALID'));
it('reports retries and persistent failure once per transition; only an actual commit restores save health',()=>{
 const health=new SaveHealth(),error=new DOMException('synthetic','AbortError');expect(health.committed()).toBeUndefined();expect(health.failure(error,true)).toMatchObject({state:'retrying'});expect(health.failure(error,true)).toBeUndefined();expect(health.failure(error,true)).toMatchObject({state:'blocked'});expect(health.failure(error,true)).toBeUndefined();expect(health.status.state).toBe('blocked');expect(health.committed()).toMatchObject({state:'recovered'});expect(health.committed()).toBeUndefined();
});
it('quota, validation and a suspended background save require a persistent recovery entry',()=>{for(const [error,foreground] of [[new DOMException('full','QuotaExceededError'),true],[new Error('schema'),true],[new DOMException('abort','AbortError'),false]] as const){const health=new SaveHealth();expect(health.failure(error,foreground)).toMatchObject({state:'blocked',recovery:foreground?'save':'reload'});}});
it.each(['[{"code":"invalid_type","expected":"integer","received":"float","path":["savedAt"]}]','TypeError: broken\n at worker.ts:15:3','無法處理：'+('診斷\n'.repeat(100)),new Error('unexpected failure'),{issues:[{code:'invalid_type'}]}])('technical details never become player copy',value=>expect(playerMessage(value,'操作未完成，請重試。')).toBe('操作未完成，請重試。'));
it('retains concise rules copy and resource shortages while empty clears remain empty',()=>{expect(playerMessage('石材不足，還缺 80')).toBe('石材不足，還缺 80');expect(playerMessage('命令已提交。')).toBe('命令已提交。');expect(playerMessage('')).toBe('');});
