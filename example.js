'use strict';

function RootController(request, response) {
  response.respond(200, {});
}

const { Server } = require('./http-server/');
Server.create({
  '/': RootController
}).start(3000);