import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /(@radix-ui\/react-[^@]+)@\d+\.\d+\.\d+/, replacement: "$1" },
      { find: /(lucide-react)@\d+\.\d+\.\d+/, replacement: "$1" },
      { find: /(class-variance-authority)@\d+\.\d+\.\d+/, replacement: "$1" },
      { find: /(cmdk)@\d+\.\d+\.\d+/, replacement: "$1" },
      { find: /(vaul)@\d+\.\d+\.\d+/, replacement: "$1" },
      { find: /(sonner)@\d+\.\d+\.\d+/, replacement: "$1" },
      { find: /(recharts)@\d+\.\d+\.\d+/, replacement: "$1" },
      { find: /(next-themes)@\d+\.\d+\.\d+/, replacement: "$1" },
    ],
  },
}); 

