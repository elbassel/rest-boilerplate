const _ = require('lodash');
const {NotFoundError} = require('../core/common/errors');

const ObjectId = require('mongodb').ObjectID;


class BaseService {
    constructor(model, useCache = false) {
        this.ObjectId = ObjectId;
        this._model = model;
    }

    get storage() {
        return this._storage;
    }

    _getDocumentJSON(document){
        for(let k in document) {
            if(document[k] instanceof ObjectId) {
                document[k] = String(document[k]);
                continue;
            }

            if(_.isObject(document[k])) {
                document[k] = this._getDocumentJSON(document[k]);
            }
        }

        return document;
    }

    _parseDocuments(documents) {
        if(_.isArray(documents)){
            for(let i=0; i < documents.length; i += 1){
                documents[i] = this._getDocumentJSON(documents[i]);
            }

            return documents;
        }

        return this._getDocumentJSON(documents);
    }

    /**
     * Populate single document
     * @param options
     * [{
     *     field: path,
     *     collection: String
     * }]
     * @returns document
     * @private
     */
    async _populateDocument(document, options) {
        if (_.isNil(options)) {
            return document;
        }

        for (let i = 0; i < options.length; i += 1) {
            const rId = _.get(document, options[i].field);
            if (_.isNil(rId)) {
                continue;
            }
            const rModel = this._model.database.collection(options[i].collection);
            const rDocument = await rModel.findOne({_id: new ObjectId(rId)});
            if(!_.isNil(rDocument)) {
                _.set(document, options[i].field, rDocument);
            }
        }

        return document;
    }

    /**
     * Populate array of documents
     * @param opts
     * [{
     *     field: path,
     *     collection: String
     * }]
     * @returns documents
     * @private
     */
    async _populate(documents, opts) {
        if (_.isNil(opts)) {
            return documents;
        }

        if (!_.isArray(documents)) {
            return this._populateDocument(documents, opts);
        }

        for (let i = 0; i < documents.length; i += 1) {
            documents[i] = await this._populateDocument(documents[i], opts);
        }

        return documents;
    }

    /**
     * Parse opts into params & options
     * params: Non mongodb params passed to service
     * {
     *     paginate: boolean,
     *     validate: boolean, [true]
     *     page: number,
     *     limit: number,
     *     sort: {
     *         field: 0 || 1
     *     },
     *     fields: {
     *         field: 0 || 1
     *     },
     *     populate:
     *     [{
     *        field: path,
     *        collection: String
     *     }]
     * }
     * options: mongodb compatible options attributes
     * {
     *      sort: object,
     *      projection: object
     * }
     * @param opts: object [All options]
     * @param multiple: boolean [multiple documents]
     * @returns {*}
     * @private
     */
    _parseOptions(opts, multiple = false) {
        const params = {};
        const options = {};
        const {paginate, validate, page, limit, projection, sort, populate} = opts;

        // Params
        params.validate = _.isNil(validate) ? true : validate;
        if (!_.isNil(paginate) && multiple) {
            params.paginate = paginate;
        }
        if (!_.isNil(page) && multiple) {
            params.page = page;
        }
        if (populate) {
            params.populate = populate;
        }

        // Options
        if (!_.isNil(sort) && multiple) {
            options.sort = sort;
        }
        if (!_.isNil(limit) && multiple) {
            options.limit = limit;
        }
        if (!_.isNil(projection)) {
            options.projection = projection;
        }

        return {params, options};
    }

    async _validateUniqueness(document, id) {
        try {
            const {unique} = this._options || {};
            if (unique) {
                const options = {};
                if (unique.ignoreCase) {
                    options['collation'] = {locale: 'en', strength: 2};
                }

                const query = {[unique.field]: document[unique.field]};
                if(id){
                    query['_id'] = { $ne: this.ObjectId(id) };
                }
                const exists = await this._model.exists(query, options);
                if (exists) {
                    throw new ValidationError(`Document with the same ${unique.field} already exists`);
                }
            }
        } catch (e) {
            throw e;
        }
    }

    async create(document) {
        try {
            return this._validateUniqueness(document)
                .then(() => {
                    return this._model.create(document);
                }).then((result) => {
                    return this._parseDocuments(result);
                });
        } catch (err) {
            throw err;
        }
    }

    async updateById(id, update, opts = {}) {
        try {
            const nQuery = {
                $set: update
            };
            const nOptions = _.merge(opts, {
                returnOriginal: false
            });

            await this._validateUniqueness(update, id);
            return this._model.updateById(id, nQuery, nOptions)
                .then((result) => {
                    if (_.isNil(result)) {
                        throw new NotFoundError();
                    }

                    return this._parseDocuments(result);
                });
        } catch (err) {
            throw err;
        }
    }

    async updateOne(filter, update, opts = {}) {
        try {
            const nQuery = {
                $set: update
            };
            const nOptions = _.merge(opts, {
                returnOriginal: false
            });

            await this._validateUniqueness(update, id);
            return this._model.updateOne(filter, nQuery, nOptions)
                .then((result) => {
                    if (_.isNil(result)) {
                        throw new NotFoundError();
                    }

                    return this._parseDocuments(result);
                });
        } catch (err) {
            throw err;
        }
    }

    async findById(id, opts = {}) {
        try {
            const {params, options} = this._parseOptions(opts);
            return this._model.findById(id, options)
                .then((result) => {
                    if (_.isNil(result) && params.validate) throw new NotFoundError();
                    return result;
                }).then((result) => {
                    if (params.populate) {
                        return this._populate(result, params.populate);
                    }
                    return this._parseDocuments(result);
                });
        } catch (err) {
            throw err;
        }
    }

    async findOne(filter = {}, opts = {}) {
        try {
            const {params, options} = this._parseOptions(opts);
            return this._model.findOne(filter, options)
                .then((result) => {
                    if (_.isNil(result) && params.validate) throw new NotFoundError();
                    return result;
                }).then((result) => {
                    if (params.populate) {
                        return this._populate(result, params.populate);
                    }
                    return this._parseDocuments(result);
                });
        } catch (err) {
            throw err;
        }
    }

    async find(filter = {}, opts = {}, modelName) {
        try {
            const {params, options} = this._parseOptions(opts, true);
            const collectionName = modelName || this._model.name;
            const result = {
                [collectionName]: [],
                page: 0,
                pages: 0
            };

            const {limit} = options;
            const {paginate, page, populate} = params;
            if (paginate) {
                const count = await this._model.count(filter);
                const pages = Math.ceil(count / limit);
                const pIndex = page > 0 ? page - 1 : 0;

                options.limit = limit;
                options.skip = limit * pIndex;

                result.pages = pages;
                result.page = pages === 0 ? 0 : page;
            }

            const query = await this._model.find(filter, options);
            return query.toArray()
                .then((docs) => {
                    if (params.populate) {
                        return this._populate(docs, populate);
                    }
                    return docs;
                }).then((docs) => {
                    return this._parseDocuments(docs);
                }).then((docs) => {
                    if(paginate) {
                        result[collectionName] = docs;
                        return result;
                    }

                    return docs;
                });
        } catch (err) {
            throw err;
        }
    }

    async deleteOne(filter, opts = {}) {
        try {
            return this._model.deleteOne(filter, opts)
                .then((result) => {
                    if (_.isNil(result)) {
                        throw new NotFoundError();
                    }

                    return this._parseDocuments(result);
                });
        } catch (err) {
            throw err;
        }
    }

    async deleteById(id, opts = {}) {
        try {
            return this._model.deleteById(id, opts)
                .then((result) => {
                    if (_.isNil(result)) {
                        throw new NotFoundError();
                    }

                    return this._parseDocuments(result);
                });
        } catch (err) {
            throw err;
        }
    }

    async exists(filter) {
        try {
            return this._model.exists(filter);
        } catch (err) {
            throw err;
        }
    }

    get utcTimestamp() {
        return new Date(Date.now());
    }
}

module.exports = BaseService;
