'use strict';

const { readFile } = require('fs');


const renderTemplateWithData = (path, data) => {
  return new Promise((resolve, reject) => {
    readFile(path, (err, page) => {
      if (err) { return reject(err); }
      data = data || {};
      page = page.toString();
      Object.keys(data).map(key => {
        let val = data[key];
        let matcher = new RegExp(`{{\\s*${key}\\s*}}`, 'gmi');
        let match;
        do {
          match = matcher.exec(page);
          if (match) { page = page.replace(matcher, val); }
        } while (match);
      });
      resolve(page);
    });
  });
};


module.exports = { renderTemplateWithData };