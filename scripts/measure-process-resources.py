"""Linux child-process resource summary; not retained game-only memory."""
import json,resource,subprocess,sys,time
started=time.monotonic()
result=subprocess.run(sys.argv[2:],stdin=subprocess.DEVNULL)
usage=resource.getrusage(resource.RUSAGE_CHILDREN)
with open(sys.argv[1],'w') as f:json.dump({'exitCode':result.returncode,'elapsedSec':time.monotonic()-started,'maxRssKiB':usage.ru_maxrss,'userSec':usage.ru_utime,'systemSec':usage.ru_stime,'caveat':'Linux child maximum RSS of the whole instrumented Node/Vite/fake-IDB process, not pure storage or summed parallel-child memory.'},f,indent=2)
sys.exit(result.returncode)
