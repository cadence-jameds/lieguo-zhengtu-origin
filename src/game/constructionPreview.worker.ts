import {calculatePreviewRequest} from './constructionPreviewCompute';
import type {PreviewRequest} from './constructionPreviewProtocol';
// Dedicated read-only worker: no Runtime, persistence, Inbox or authority imports.
self.onmessage=(e:MessageEvent<PreviewRequest>)=>{self.postMessage(calculatePreviewRequest(e.data));};
