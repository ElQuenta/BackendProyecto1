require('reflect-metadata');
const fs = require('fs');
const path = require('path');
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD'];
function inventory() {
  const root = path.join(__dirname, '..', 'dist');
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  const rows = [];
  for (const file of walk(root).filter(f => f.endsWith('.controller.js')).sort()) {
    for (const C of Object.values(require(file))) {
      if (typeof C !== 'function' || Reflect.getMetadata('path', C) === undefined) continue;
      for (const name of Object.getOwnPropertyNames(C.prototype)) {
        const fn = C.prototype[name];
        const method = typeof fn === 'function' && Reflect.getMetadata('method', fn);
        if (method === undefined || method === false) continue;
        const route = '/' + ['api/v1', Reflect.getMetadata('path', C), Reflect.getMetadata('path', fn)].join('/').replace(/\/+/g, '/').replace(/\/$/, '');
        rows.push({ method: METHODS[method], route, handler: name,
          source: path.relative(root, file).replace(/\\/g, '/').replace(/\.js$/, '.ts'),
          tag: (Reflect.getMetadata('swagger/apiUseTags', C) || [path.basename(file, '.controller.js')])[0],
          roles: Reflect.getMetadata('roles', fn) || Reflect.getMetadata('roles', C) || [],
          public: Reflect.getMetadata('isPublic', fn) === true,
          status: Reflect.getMetadata('__httpCode__', fn) ?? (method === 1 ? 201 : 200),
          summary: (Reflect.getMetadata('swagger/apiOperation', fn) || {}).summary || name,
        });
      }
    }
  }
  return rows;
}
module.exports = { inventory };
