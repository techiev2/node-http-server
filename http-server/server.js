'use strict';
const { createServer } = require('http');
const { readFile, existsSync } = require('fs');
const { resolve } = require('path');

const { httpResponder } = require('./middlewares');

const { renderTemplateWithData } = require('./helpers');


function renderTemplate(response, template, data) {
  renderTemplateWithData(template, data)
    .then(page => {
      response.statusCode = 200;
      response.write(page);
      return response.end();
    })
    .catch(error => {
      response.statusCode = 500;
      response.write(`
        Server error: <br >
        ${error}
        Error opening template at ${template}
      `);
      return response.end();
    })
}


class Server {

  setResponder(response) {
    response.respond = (status, data) => {
      httpResponder(response, status, data);
    };
  }

  setResponseType(resType) {
    this._responseType = resType;
    return this;
  }

  addStaticRoot(staticPath) {
    this._staticRoots.push(staticPath);
    return this;
  }

  staticHandler(path, response) {
    // TODO: Find these start paths from this._staticRoots and run a loop
    if (path.startsWith('/js/')) {
      path = path.split('/js/')[1];
    }
    if (path.startsWith('/css/')) {
      path = path.split('/css/')[1];
    }
    if (path.startsWith('/assets/')) {
      path = path.split('/assets/')[1];
    }
    //TEMP
    if (path.startsWith('/')) {
      path = path.split('/').slice(1).join('/');
    }

    this._staticRoots = this._staticRoots.map(_ => resolve(_))
    let validPaths = this._staticRoots
      .map(_ => `${_}/${path}`)
      .filter(_ => existsSync(_) || existsSync(`${_}/${path}`))

    path = validPaths.length > 0 ? validPaths[0] : null;
    if (!path) {
      response.statusCode = 404;
      return response.end();
    }

    readFile(path, (err, content) => {
      if (err) {
        response.statusCode = 404;
        return response.end();
      }
      // Find a way to detect this a la codecs in Python
      let contentType = path.endsWith('.js') ? 'application/json' :
        path.endsWith('.css') ? 'text/css' :
        path.endsWith('.svg') ? 'image/svg+xml': 'text/plain';
      response.setHeader('Content-Type', contentType);
      response.statusCode = 200;
      response.write(content);
      response.end();
    });
  }

  addCORSHeaders(headers) {
    if (headers && headers.constructor === Array) {
      this.corsHeaders.push(...headers);
    }
    return this;
  }

  setProperty(name, value) {
    Object.assign(this._props, { [name]: value });
    return this;
  }

  constructor(routes) {
    this._routes = {};
    this._responseType = 'json';
    this._staticRoots = [];
    routes = routes || {};
    this.corsHeaders = [];
    Object.keys(routes).map(route => {
      let handler = routes[route];
      if (route === '/') {
        route = '^(/)$';
      }
      let $route = new RegExp(route);
      this._routes[route] = handler;
    });
    this._middlewares = [];
    this._props = {};

    this._server = createServer((request, response) => {

      if (this._responseType === 'html') {
        response.renderTemplate = (template, data) => {
          renderTemplate(response, template, data);
        };
      }

      let headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS, PUT, POST',
        'Server': 'NodeJS HTTP API v1.0.0'
      };
      if (this.corsHeaders.length > 0) {
        headers['Access-Control-Allow-Headers'] = this.corsHeaders.join(',');
      }
      Object.keys(headers).map(key => {
        response.setHeader(key, headers[key]);
      });

      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        return response.end();
      }

      if (!response.render) {
        response.render = (status, data) => { httpResponder(response, status, data); }
      }

      let cookies = {};
      const cookie = request.headers && request.headers.cookie ?
        request.headers.cookie || '' : '';
      cookie.split('; ').map(cookieEl => {
        let cookieVal;
        cookieEl = cookieEl.split('=');
        if (cookieEl.length !== 2) return;
        // TODO: Parse the cookie value
        cookieVal =  cookieEl[1];
        try {
          cookieVal = JSON.parse(cookieVal);
        } catch (err) {
          //
        }
        cookies[cookieEl[0]] = cookieVal;
      });
      request.cookies = cookies;

      const { rawHeaders } = request;
      let hKeys =
        rawHeaders.filter(_ => rawHeaders.indexOf(_) % 2 === 0)
          .map(_ => [_, rawHeaders[rawHeaders.indexOf(_) + 1]])
      hKeys = hKeys || [];
      request.headers = {};
      const oldKeys = Object.keys(
        request.headers
      ).map((k) => k.toLowerCase());
      hKeys.map((headerMap) => {
        let [key, val] = headerMap;
        Object.assign(request.headers, {[key]: val});
      });
      const server = this;

      Promise.all(this._middlewares.map(_ => _(request, response)))
        .then(() => {
          // Fallback if responder has not been added to middlewares
          // via the serialize middleware

          Object.keys(server._props).map(key => {
            request[`${key}`] = server._props[`${key}`];
          });

          if (!response.respond) {
            this.setResponder(response);
          }
          let { url } = request;
          let isStatic = url.endsWith('.js') || url.endsWith('.css') ||
            url.endsWith('.svg') || url.endsWith('.ttf') ||
            url.endsWith('.woff') || url.endsWith('jpg') ||
            url.endsWith('png') || url.endsWith('webp') ||
            url.endsWith('ico');
          let handler, matcher, match;
          if (isStatic) {
            return this.staticHandler(url, response);
          }
          Object.keys(this._routes).map(route => {
            if (handler) return;
            matcher = new RegExp(route);
            match = matcher.exec(url);
            if (match) {
              handler = this._routes[route];
              request.query = request.query || {};
              Object.assign(request.query, match.groups || {});
            }
          });
          response.redirect = (status, location) => {
            if (status.constructor !== Number) {
              location = status;
              status = 301;
            }
            response.writeHead(status, {"Location": location});
            response.end();
          };
          handler = handler || this.handler404.bind(this);
          handler(request, response);
        })
        .catch(error => {
          response.respond(500, `Server error: ${error}`);
        });
    });
    return this;
  }

  handler404(request, response) {
    if (!response.respond) {
      setResponder(response);
    }
    if (this._responseType === 'html') {
      response.writeHead(404, {
        'Content-Type': 'text/html'
      });
      return response.end(`Route ${request.url} not found`);
    }
    response.respond(404, 'Route not found');
  }

  start(port=5000) {
    console.log(`Listening on http://localhost:${port}`);
    this._server.listen(port, '0.0.0.0');
  }

  addMiddleware(middlware) {
    if (middlware instanceof Function) {
      this._middlewares.push(middlware);
    }
    return this;
  }

  static create(routes) {
    return new Server(routes);
  }

}


module.exports = { Server };

