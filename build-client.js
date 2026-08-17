import * as esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
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

async function copyWasmFiles() {
  const codecsDir = path.join(__dirname, 'node_modules/@cornerstonejs');
  const targetDir = path.join(__dirname, 'public/js');

  try {
    const entries = await fs.readdir(codecsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('codec-')) {
        const distDir = path.join(codecsDir, entry.name, 'dist');
        if (existsSync(distDir)) {
          const files = await fs.readdir(distDir);
          for (const f of files) {
            if (f.endsWith('.wasm')) {
              const src = path.join(distDir, f);
              const dest = path.join(targetDir, f);
              await fs.copyFile(src, dest);
              console.log(`✓ Copiado codec WASM: ${f} -> public/js/`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Aviso al copiar archivos WASM:', err);
  }
}

async function build() {
  try {
    // 1. Compilar bundle principal del visor
    await esbuild.build({
      entryPoints: [path.join(__dirname, 'src/client/viewer.js')],
      bundle: true,
      minify: false,
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

    // 2. Compilar Web Worker de decodificación
    await esbuild.build({
      entryPoints: [path.join(__dirname, 'node_modules/@cornerstonejs/dicom-image-loader/dist/esm/decodeImageFrameWorker.js')],
      bundle: true,
      minify: false,
      sourcemap: true,
      format: 'esm',
      outfile: path.join(__dirname, 'public/js/decodeImageFrameWorker.js'),
      target: ['es2022', 'chrome100', 'firefox100', 'safari15'],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      plugins: [nodeShimsPlugin],
      logLevel: 'info',
    });

    // 3. Copiar decodificadores WASM
    await copyWasmFiles();

    console.log('✓ Cornerstone3D client bundle, Web Worker y codecs WASM generados exitosamente en public/js/');
  } catch (err) {
    console.error('Error al compilar bundles de cliente:', err);
    process.exit(1);
  }
}

build();
