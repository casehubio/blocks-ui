import '@casehubio/pages-ui-tokens/dist/init.js';
import { applyTheme } from '@casehubio/pages-ui-tokens';
import './pages/diagram-export-page.js';

applyTheme('casehub-dark');

const app = document.getElementById('app')!;
app.appendChild(document.createElement('blocks-example-diagram-export'));
