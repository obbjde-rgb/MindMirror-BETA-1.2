module.exports = {
  apps: [
    {
      name: "rmx-mindmirror",
      script: "server.ts",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 8080
      }
    }
  ]
};
