'use strict';

const { readFile, readFileSync } = require('fs');
const { dirname, normalize } = require('path');


const renderTemplateWithData = async (path, data) => {
  return new Promise(async (resolve, reject) => {
    readFile(path, (err, page) => {
      if (err) { return reject(err); }
      data = data || {};
      page = page.toString();
      const includeMatcher = new RegExp(
          `\{\%include\s*(.*?)\s*\}`, 'gmi',
      );
      let $include;
      let $file;
      const $root = dirname(path);
      do {
        $include = includeMatcher.exec(page);
        if ($include) {
          try {
            $file = $include[1].trim();
            let $$file = normalize(`${$root}/${$file}`);
            $file = readFileSync($$file);
            page = page.replace($include[0], $file);
          } catch (error) {
            let $msg;
            if (error.code === 'ENOENT') {
              $msg = `Unable to read from ${$file}`;
              page = page.replace(
                $include[0],
                `${$include[0]}<script>console.error("${$msg}");</script>`,
              );
              console.log({error});
            } else {
              console.log(error.message);
            }
          }
        }
      } while ($include);
      Object.keys(data).map(key => {
        let val = data[key];
        const includeMatcher = new RegExp(
            `\{\%\s*(.*?)\s*\}`, 'gmi',
        );
        let $includes;
        do {
          $includes = includeMatcher.exec(page);
        } while ($includes);
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
