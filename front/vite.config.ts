import { defineConfig } from 'vite';

// No GitHub Pages o site fica em /RB-PROJETOS/. Caminhos relativos ('./') funcionam
// tanto ali quanto localmente, em outro repositório ou abrindo o build por um servidor simples.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
});
