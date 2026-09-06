import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';

/** Stamp the build into the page, so a stale copy can be identified on sight. */
function buildStamp(): Plugin {
  let stamp: string;
  return {
    name: 'build-stamp',
    buildStart() {
      let sha = 'unknown';
      try {
        sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      } catch {
        // Not a git checkout; the date alone still distinguishes builds.
      }
      stamp = `${sha} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    },
    transformIndexHtml(html) {
      return html.replace(/__BUILD__/g, stamp);
    },
  };
}

// Relative base: the site works wherever it is mounted -- a project path like
// /fof/, a domain root, anywhere -- so the deployment target cannot break it.
export default defineConfig({
  base: './',
  plugins: [buildStamp()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    reportCompressedSize: true,
  },
});
