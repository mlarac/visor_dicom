import * as esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin para shim de módulos de Node y reemplazo seguro de import.meta.url
const cornerstoneFixPlugin = {
  name: 'cornerstone-fix',
  setup(build) {
    // 1. Shims de Node.js
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

    // 2. Transformar cualquier archivo que contenga import.meta.url
    build.onLoad({ filter: /\.(js|mjs|ts)$/ }, async args => {
      // Omitir nuestros propios archivos de entrada en src/client
      if (args.path.includes('src/client') || args.path.includes('src\\client')) {
        return null;
      }
      try {
        let source = await fs.readFile(args.path, 'utf8');
        if (source.includes('import.meta.url')) {
          source = source
            .replace(/new URL\('@cornerstonejs\/codec-libjpeg-turbo-8bit\/decodewasm'[^)]*\)/g, '"/js/libjpegturbowasm_decode.wasm"')
            .replace(/new URL\('@cornerstonejs\/codec-openjpeg\/decodewasm'[^)]*\)/g, '"/js/openjpegwasm_decode.wasm"')
            .replace(/new URL\('@cornerstonejs\/codec-charls\/decodewasm'[^)]*\)/g, '"/js/charlswasm_decode.wasm"')
            .replace(/new URL\('@cornerstonejs\/codec-openjph\/wasm'[^)]*\)/g, '"/js/openjphjs.wasm"')
            .replace(/new URL\('\.\/decodeImageFrameWorker\.js'[^)]*\)/g, '"/js/decodeImageFrameWorker.js"')
            .replace(/new URL\('\.\.\/workers\/computeWorker\.js'[^)]*\)/g, '"/js/computeWorker.js"')
            .replace(/import\.meta\.url/g, '"http://localhost:3000/js/"');
          return { contents: source, loader: 'js' };
        }
      } catch (err) {
        // Dejar que esbuild lo procese normalmente
      }
      return null;
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
      plugins: [cornerstoneFixPlugin],
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
      plugins: [cornerstoneFixPlugin],
      logLevel: 'info',
    });

    // 3. Compilar Web Worker de cómputo (tools)
    const computeWorkerEntry = path.join(__dirname, 'node_modules/@cornerstonejs/tools/dist/esm/workers/computeWorker.js');
    if (existsSync(computeWorkerEntry)) {
      await esbuild.build({
        entryPoints: [computeWorkerEntry],
        bundle: true,
        minify: false,
        sourcemap: true,
        format: 'esm',
        outfile: path.join(__dirname, 'public/js/computeWorker.js'),
        target: ['es2022', 'chrome100', 'firefox100', 'safari15'],
        define: {
          'process.env.NODE_ENV': '"production"',
        },
        plugins: [cornerstoneFixPlugin],
        logLevel: 'info',
      });
    }

    // 4. Copiar decodificadores WASM
    await copyWasmFiles();

    console.log('✓ Cornerstone3D client bundle, Web Workers y codecs WASM generados exitosamente en public/js/');
  } catch (err) {
    console.error('Error al compilar bundles de cliente:', err);
    process.exit(1);
  }
}

build();
