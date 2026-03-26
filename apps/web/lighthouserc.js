module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx next start -p 3007',
      startServerReadyPattern: 'ready on',
      url: [
        'http://localhost:3007/',
        'http://localhost:3007/dashboard/marketplace',
        'http://localhost:3007/dashboard',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': ['warn', { minScore: 0.85 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
