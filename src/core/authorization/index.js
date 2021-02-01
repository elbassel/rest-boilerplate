const _ = require('lodash');
const AccessControl = require('accesscontrol');

const { aclRoles, aclResources } = require('./accessList');
const { UnauthorizedError, ValidationError } = require('../../common/errors');

const ACCESS_TYPES = ['createOwn', 'createAny', 'readOwn', 'readAny', 'updateOwn', 'updateAny', 'deleteOwn', 'deleteAny'];
const acl = new AccessControl(aclRoles);

class Authorization {
  static async getAccess(roles, resource, access, predicate) {
    let permission;
    let allowed = false;
    let userAccess;
    let nAccess = access;

    if (_.isString(access)) {
      nAccess = [access];
    }

    if (!nAccess || _.intersection(nAccess, ACCESS_TYPES).length !== nAccess.length) {
      throw new ValidationError('Missing or invalid authorization access type');
    }

    for (let i = 0; i < nAccess.length; i += 1) {
      permission = acl.can(roles)[nAccess[i]](resource);
      if (permission.granted) {
        userAccess = nAccess[i];
        if (!_.isNil(predicate)) {
          if (userAccess.toLowerCase().endsWith('own')) {
            // eslint-disable-next-line no-await-in-loop
            const result = await predicate();

            if (result) {
              allowed = true;
              break;
            }

            break;
          }
        }

        allowed = true;
        break;
      }
    }

    return { permission, allowed };
  }

  static async authorize(ctx, access, predicate) {
    const { user, resource } = ctx._locals;

    if (_.isNil(user)) {
      throw new UnauthorizedError();
    }

    const { roles } = user;
    const { permission, allowed } = await this.getAccess(roles, resource, access, predicate);

    if (permission.granted === true && allowed === true) {
      _.set(ctx, '_locals.permission', permission);
    }

    throw new UnauthorizedError();
  }

  static async filterByPermission(permission, object, path) {
    if (permission && permission.granted) {
      if (path) {
        _.set(object, path, permission.filter(_.get(object, path)));
      }
    }
  }
}

module.exports = Authorization;
