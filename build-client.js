import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin para shim de módulos de Node (fs, path, url, etc.) usados en fallbacks de Emscripten
const nodeShimsPlugin = {
  name: 'node-shims',
  setup(build) {
    build.onResolve({ filter: /^(fs|path|crypto|url|http|https|stream|zlib)$/ }, args => ({
      path: args.path,
      namespace: 'empty-node-module',
    }));
    build.onLoad({ filter: /.*/, namespace: 'empty-node-module' }, args => {
      if (args.path === 'url') {
        return {
          contents: 'export const URL = globalThis.URL; export const URLSearchParams = globalThis.URLSearchParams; export default { URL: globalThis.URL, URLSearchParams: globalThis.URLSearchParams };',
          loader: 'js',
        };
      }
      return {
        contents: 'export default {}; export const readFileSync = () => {}; export const existsSync = () => false;',
        loader: 'js',
      };
    });
  },
};

async function build() {
  try {
    const result = await esbuild.build({
      entryPoints: [path.join(__dirname, 'src/client/viewer.js')],
      bundle: true,
      minify: true,
      sourcemap: true,
      format: 'iife',
      globalName: 'VisorApp',
      outfile: path.join(__dirname, 'public/js/viewer-cornerstone3d.bundle.js'),
      target: ['es2022', 'chrome100', 'firefox100', 'safari15'],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      plugins: [nodeShimsPlugin],
      logLevel: 'info',
    });

    console.log('✓ Cornerstone3D client bundle generado exitosamente en public/js/viewer-cornerstone3d.bundle.js');
  } catch (err) {
    console.error('Error al compilar bundle de cliente:', err);
    process.exit(1);
  }
}

build();
