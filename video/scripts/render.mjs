// Runs `remotion render` on a free port. A fixed port breaks when a previous render is still
// shutting down, and Remotion's own default (3000) is often taken by the game's dev server here.
//
//   node scripts/render.mjs <out.mp4> [extra remotion flags...]
import net from 'node:net';
import {spawn} from 'node:child_process';

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const {port} = srv.address();
      srv.close(() => resolve(port));
    });
  });

const [out, ...flags] = process.argv.slice(2);
const port = await freePort();
const p = spawn('npx', ['remotion', 'render', 'src/index.ts', 'VesperDrift', out, `--port=${port}`, ...flags], {stdio: 'inherit', shell: true});
p.on('close', (code) => process.exit(code ?? 1));
