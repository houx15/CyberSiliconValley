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
      name: 'csv-api',
      cwd: './backend',
      script: 'uv',
      args: 'run uvicorn csv_api.main:app --host 0.0.0.0 --port 8000',
      env: {
        APP_ENV: 'production',
      },
    },
    {
      name: 'csv-worker',
      cwd: './backend',
      script: 'uv',
      args: 'run python -m csv_worker.main',
      env: {
        APP_ENV: 'production',
      },
    },
  ],
};
