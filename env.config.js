const {networkInterfaces} = require('node:os');

function localIpv4Address() {
  for (const addresses of Object.values(networkInterfaces())) {
    const address = addresses?.find(({family, internal}) => family === 'IPv4' && !internal);

    if (address) return address.address;
  }

  return '127.0.0.1';
}

module.exports = {
  env: {
    options: {
      // Global options
      EXTERNAL_NAME: process.env.DF_EXTERNAL_NAME || 'Doubtfire',
    },

    development: {
      // Use the computer's IP address -- if using localhost then
      // testing on mobile devices will fail as it cannot point to
      // localhost (this would be the device itself!)
      API_URL: 'http://' + localIpv4Address() + ':3000/api',
    },

    production: {
      // Provide a set API_URL, otherwise window.location will be used
      // to locate the API dynamically (see api-url.coffee)
      API_URL: process.env.DF_API_URL,
    },

    docker: {
      // API URL should use the DF_DOCKER_MACHINE_IP set
      API_URL: 'http://' + process.env.DF_DOCKER_MACHINE_IP + ':3000/api',
    },

    devcontainer: {
      // API URL should use the DF_DOCKER_MACHINE_IP set
      API_URL: 'http://' + process.env.DF_DOCKER_MACHINE_IP + ':4200/api',
    },
  },
};
