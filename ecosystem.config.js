module.exports = {
  apps: [
    {
      name: 'comic-picture-book',
      script: 'npm',
      args: 'run start',
      cwd: '.',
      env: {
        NODE_ENV: 'production',
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      exp_backoff_restart_delay: 1000,
    },
  ],
};

