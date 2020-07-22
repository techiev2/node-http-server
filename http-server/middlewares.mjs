'use strict';

export const httpResponder = (response, status, data) => {
  response.statusCode = status;
  let key = status > 199 && status < 400 ? 'data' : 'message';
  data = {
    [key]: data
  };
  response.write(JSON.stringify(data));
  response.end();
};

export function serialize(request, response) {
  return new Promise(resolve => {
    response.respond = (status, data) => {
      httpResponder(response, status, data);
    };
    let content = '';
    request.on('data', chunk => content += chunk);
    request.on('end', () => {
      try {
        request.data = JSON.parse(content);
      } catch (err) {
        let data = {};
        content.split('&').map(_ => {
          _ = _.split('=');
          if (_.length !== 2) return;
          data[_[0]] = _[1];
        });
        request.data = Object.keys(data).length < 1 ? null : data;
      }
      if (request.data) {
        Object.entries(request.data).map(([key, val]) => {
          try {
            val = JSON.parse(val);
          } catch (err) {
            //
          }
          Object.assign(request.data, {[`${key}`]: val});
        });
      }
      resolve(request, response);
    });
  });
}
