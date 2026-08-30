/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#4f46e5',
        ink: '#0f172a',
        sub: '#334155',   // WCAG-AA secondary on glass
        mut: '#475569',
        info: '#2563eb',
        cyan: '#0891b2',
        critical: '#dc2626',
        gate: '#b45309',
        success: '#15803d',
      },
      fontFamily: {
        display: ['Bricolage Grotesque', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
