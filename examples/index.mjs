'use strict';

import {Server} from '../http-server';

function UserController(request, response) {
  response.respond(200, request.query);
}

function RootController(request, response) {
  response.renderTemplate('templates/index.html');
}

Server
  .create({
    '/': RootController,
    '/api/users/(?<username>\\w+)\/?': UserController
  })
  .setResponseType('html')
  .start(3000);
