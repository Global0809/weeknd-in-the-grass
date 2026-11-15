import {build} from 'vite';
import {writeFile} from 'node:fs/promises';
await build();
await writeFile(new URL('./docs/.nojekyll',import.meta.url),'');
