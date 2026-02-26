module.exports = {
  apps: [
    {
      name: 'scorer-frontend',
      cwd: '/home/silver/projects/dissertation-experiment-scorer/frontend',
      script: 'npm',
      args: 'start -- -p 3002',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'https://scorer-api.kaiwyk.xyz'
      }
    },
    {
      name: 'scorer-backend',
      cwd: '/home/silver/projects/dissertation-experiment-scorer/backend',
      script: '/home/silver/projects/dissertation-experiment-scorer/backend/venv/bin/python',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8001',
      interpreter: 'none',
      env: {
        JWT_SECRET: 'dissertation-scorer-2026-prod-key'
      }
    }
  ]
};
