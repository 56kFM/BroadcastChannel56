import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  astro: true,
  test: false,
  ignores: ['src/assets/style.css'],
  rules: {
    'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
  },
})
