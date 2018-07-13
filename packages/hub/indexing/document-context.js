const authLog = require('@cardstack/logger')('cardstack/auth');
const log = require('@cardstack/logger')('cardstack/indexers');
const Model = require('../model');
const { uniqBy } = require('lodash');

module.exports = class DocumentContext {

  constructor({ read, schema, type, id, branch, sourceId, generation, upstreamDoc, additionalIncludes=[] }) {
    this.schema = schema;
    this.type = type;
    this.id = id;
    this.branch = branch;
    this.sourceId = sourceId;
    this.generation = generation;
    this.upstreamDoc = upstreamDoc;
    this.additionalIncludes = additionalIncludes;
    this._read = read;
    this.isCollection = upstreamDoc && upstreamDoc.data && Array.isArray(upstreamDoc.data);

    // included resources that we actually found
    this.pristineIncludes = [];

    // references to included resource that were both found or
    // missing. We track the missing ones so that if they later appear
    // in the data we can invalidate to pick them up.
    this._references = [];

    // special case for the built-in implicit relationship between
    // user-realms and the underlying user record it is tracking
    if (type === 'user-realms') {
      let user = upstreamDoc.relationships.user.data;
      this._references.push(`${user.type}/${user.id}`);
    }
  }

  async searchDoc() {
    if (this.isCollection) { return; }

    let searchDoc = await this._getCachedSearchDoc();
    if (!searchDoc) { return; }

    // TODO adapting the searchdoc response to new structure available to pg-search, still need to refactor this internally to remove these deletes
    delete searchDoc.cardstack_pristine;
    delete searchDoc.cardstack_references;
    delete searchDoc.cardstack_realms;

    return searchDoc;
  }

  async pristineDoc() {
    let searchDoc = await this._getCachedSearchDoc();
    if (!searchDoc) { return; }

    let pristine = searchDoc.cardstack_pristine;

    if (!this.isCollection) {
      pristine.data.meta.source = this.sourceId;
    }

    return pristine;
  }

  async realms() {
    if (this.isCollection) { return; }

    let searchDoc = await this._getCachedSearchDoc();
    if (!searchDoc) { return; }

    return searchDoc.cardstack_realms;
  }

  async references() {
    if (this.isCollection) { return; }

    await this._getCachedSearchDoc(); // side effect builds up the references
    return this._references;
  }

  async read(type, id) {
    this._references.push(`${type}/${id}`);
    //TODO implement some kind of caching here a'la jsonapi middleware's _loadAllIncluded()
    return this._read(type, id);
  }


  // TODO come up with a better way to cache (use Model)
  async _getCachedSearchDoc() {
    let searchTree;
    if (!this.isCollection) {
      let contentType = this.schema.types.get(this.type);
      if (!contentType) { return; }

      searchTree = contentType.includesTree;
    }

    if (!this._searchDoc) {
      this._searchDoc = await this._build(this.type, this.id, this.upstreamDoc, searchTree, 0);
    }
    if (this._searchDoc) {
      return Object.assign({}, this._searchDoc);
    }
  }

  // copies attribues appropriately from jsonapiDoc into
  // pristineDocOut and searchDocOut.
  async _buildAttributes(contentType, jsonapiDoc, userModel, pristineDocOut, searchDocOut) {
    for (let field of contentType.realAndComputedFields.values()) {
      if (field.id === 'id' || field.id === 'type' || field.isRelationship) {
        continue;
      }
      if (contentType.computedFields.has(field.id) ||
          (jsonapiDoc.attributes && jsonapiDoc.attributes.hasOwnProperty(field.id))) {
        let value = await userModel.getField(field.id);
        await this._buildAttribute(field, value, pristineDocOut, searchDocOut);
      }
     }
  }

  async _buildAttribute(field, value, pristineDocOut, searchDocOut) {
    // Write our value into the search doc
    searchDocOut[field.id] = field.searchIndexFormat(value);
    // Write our value into the pristine doc
    ensure(pristineDocOut, 'attributes')[field.id] = value;
  }

  async _buildRelationships(contentType, jsonapiDoc, userModel, pristineDocOut, searchDocOut, searchTree, depth) {
    for (let field of contentType.realAndComputedFields.values()) {
      if (!field.isRelationship) {
        continue;
      }
      if (contentType.computedFields.has(field.id) ||
          (jsonapiDoc.relationships && jsonapiDoc.relationships.hasOwnProperty(field.id))) {
        let value = { data: await userModel.getField(field.id) };
        await this._buildRelationship(field, value, pristineDocOut, searchDocOut, searchTree, depth);
      }
    }
  }

  async _buildRelationship(field, value, pristineDocOut, searchDocOut, searchTree, depth) {
    if (!value || !value.hasOwnProperty('data')) {
      return;
    }
    let related;
    if (value.data && searchTree[field.id]) {
      if (Array.isArray(value.data)) {
        related = await Promise.all(value.data.map(async ({ type, id }) => {
          let resource = await this.read(type, id);
          if (resource) {
            return this._build(type, id, resource, searchTree[field.id], depth + 1);
          }
        }));
        related = related.filter(Boolean);
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value, { data: related.map(r => ({ type: r.type, id: r.id })) });
      } else {
        let resource = await this.read(value.data.type, value.data.id);
        if (resource) {
          related = await this._build(resource.type, resource.id, resource, searchTree[field.id], depth + 1);
        }
        let data = related ? { type: related.type, id: related.id } : null;
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value, { data });
      }
    } else {
      related = value.data;
      ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value);
    }
    searchDocOut[field.id] = related;
  }

  _buildSearchTree(searchTree, contentType, segments) {
    if (!segments.length) { return contentType; }
    if (searchTree[segments[0]]) { return; }

    let field = contentType.realAndComputedFields.get(segments[0]);
    if (!field || !field.relatedTypes) { return contentType; }

    let relatedTypes = Object.keys(field.relatedTypes);
    if (!relatedTypes.length) { return contentType; }

    //TODO how to decide which related type to use?
    searchTree[segments[0]] = this._buildSearchTree(Object.assign({}, searchTree), this.schema.types.get(relatedTypes[0]), segments.slice(1));

    return searchTree;
  }

  async _build(type, id, jsonapiDoc, searchTree, depth) {
    let isCollection = this.isCollection && depth === 0;
    // we store the id as a regular field in elasticsearch here, because
    // we use elasticsearch's own built-in _id for our own composite key
    // that takes into account branches.
    //
    // we don't store the type as a regular field in elasticsearch,
    // because we're keeping it in the built in _type field.
    let searchDoc = isCollection ? {} : { ['id']: id };

    // this is the copy of the document we will return to anybody who
    // retrieves it. It's supposed to already be a correct jsonapi
    // response, as opposed to the searchDoc itself which is mangled
    // for searchability.
    let pristine = isCollection ? { data: [] } : { data: { id, type } };
    let rootItems = [];

    if (isCollection) {
      for (let [index, resource] of jsonapiDoc.data.entries()) {
        let contentType = this.schema.types.get(resource.type);
        if (!contentType) { continue; }

        let additionalIncludes = {};
        for (let segments of this.additionalIncludes) {
          this._buildSearchTree(additionalIncludes, contentType, segments);
        }

        let pristineItem = await this._build(resource.type, resource.id, resource, Object.assign(additionalIncludes, contentType.includesTree), depth + 1);
        assignMeta(pristineItem, jsonapiDoc.data[index]);

        pristine.data.push(pristineItem);
        rootItems.push(`${resource.type}/${resource.id}`);
      }
      assignMeta(pristine, jsonapiDoc);
    } else {
      let contentType = this.schema.types.get(type);
      if (!contentType) {
        log.warn("ignoring unknown document type=%s id=%s", type, id);
        return;
      }
      // we are going inside a parent document's includes, so we need
      // our own type here.
      if (depth > 0) {
        searchDoc['type'] = type;
      }
      let userModel = new Model(contentType, jsonapiDoc, this.schema, this.read.bind(this));
      await this._buildAttributes(contentType, jsonapiDoc, userModel, pristine, searchDoc);
      await this._buildRelationships(contentType, jsonapiDoc, userModel, pristine, searchDoc, searchTree, depth);

      assignMeta(pristine.data, jsonapiDoc);
    }

    if (depth === 0) {
      this.pristineIncludes = this.pristineIncludes.filter(r => !rootItems.includes(`${r.type}/${r.id}`));
    }

    // top level document embeds all the other pristine includes
    if (this.pristineIncludes.length > 0 && depth === 0) {
      pristine.included = uniqBy([pristine].concat(this.pristineIncludes), r => `${r.type}/${r.id}`).slice(1);
    }

    if (depth > 0) {
      this.pristineIncludes.push(pristine.data);
    } else {
      // The next fields in the searchDoc get a "cardstack_" prefix so
      // they aren't likely to collide with the user's attribute or
      // relationship.
      searchDoc.cardstack_pristine = pristine;
      if (!isCollection) {
        searchDoc.cardstack_references = this._references;
        searchDoc.cardstack_realms = this.schema.authorizedReadRealms(type, jsonapiDoc);
        authLog.trace("setting resource_realms for %s %s: %j", type, id, searchDoc.cardstack_realms);
      }
    }
    if (this.isCollection && depth === 1) {
      return pristine.data;
    }
    return searchDoc;
  }

};

function assignMeta(pristine, resource) {
  if (resource.meta) {
    pristine.meta = Object.assign({}, resource.meta);
  } else {
    pristine.meta = {};
  }
}

function ensure(obj, section) {
  if (!obj.data[section]) {
    obj.data[section] = {};
  }
  return obj.data[section];
}
