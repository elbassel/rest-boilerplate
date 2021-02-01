const { ObjectID } = require('mongodb');
const AJV = require('ajv');
const transformDef = require('ajv-keywords/dist/definitions/transform');
const instanceofDef = require('ajv-keywords/dist/definitions/instanceof');
const addFormats = require('ajv-formats');
const keywords = require('ajv-keywords');

const ajvOptions = { allErrors: true, removeAdditional: true, useDefaults: true };

const { ValidationError } = require('../../common/errors');

class Validation {
  constructor() {
    // eslint-disable-next-line new-cap
    this.validator = new AJV.default(ajvOptions);

    instanceofDef.CONSTRUCTORS.ObjectID = ObjectID;
    transformDef.transform.toDate = (dateString) => {
      if (dateString instanceof Date) return dateString;
      return new Date(dateString);
    };

    addFormats(this.validator);
    keywords(this.validator, ['transform', 'instanceof']);
  }

  validate(schema, data) {
    const valid = this.validator.validate(schema, data);
    if (!valid) {
      throw new ValidationError(null, this.validator.errors);
    }
    console.log(data);
  }
}

module.exports = new Validation();

// const Ajv = require('ajv');
// const { ValidationError } = require('../../common/errors');
//
// class Validator {
//   constructor() {
//     this.ajv = new Ajv();
//   }
//
//   validate(schema, data, strict = true) {
//     const nSchema = schema;
//
//     if (!strict) {
//       delete nSchema.required;
//     }
//
//     const valid = this.ajv.validate(nSchema, data);
//     if (!valid) {
//       throw new ValidationError(null, this.ajv.errors);
//     }
//   }
// }
//
// module.exports = new Validator();
