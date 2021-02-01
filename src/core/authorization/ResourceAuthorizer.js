const _ = require('lodash');

const { UnauthorizedError, ValidationError } = require('../../common/errors');
const Authorization = require('./index');

class ResourceAuthorizer {
  static async authorize(ctx, access, predicate) {
    if (_.isNil(ctx)) {
      throw new Error('Invalid context object passed');
    }

    const permission = await Authorization.authorize(ctx, access, predicate);
    // Store permission for "afterAction" to be used for filtering
    _.set(ctx, '_locals.permission', permission);
    await Authorization.filterByPermission(permission, ctx.request, 'body');
  }
}

module.exports = ResourceAuthorizer;
