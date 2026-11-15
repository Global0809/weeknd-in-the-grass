import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'/weeknd-in-the-grass/',plugins:[react()],build:{outDir:'docs'}});
