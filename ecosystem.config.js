module.exports = {
  apps: [
    {
      name: 'csv-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'csv-worker',
      script: 'npx',
      args: 'tsx src/lib/jobs/worker.ts',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
