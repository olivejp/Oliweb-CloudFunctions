"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fbfunctions = require("firebase-functions");
const _ = require('lodash');
const request = require('request-promise');
exports.indexAnnonceToElastic = fbfunctions.database.ref('/annonces/{annonceId}/annonceEntity/')
    .onWrite(event => {
    let annonceData = event.data.val();
    let annonceId = event.params.annonceId;
    console.log('Indexing annonce ', annonceId, annonceData);
    let elasticsearchFields = ['uuid', 'titre', 'description', 'prix', 'categorie', 'datePublication', 'photos'];
    let elasticSearchConfig = fbfunctions.config().elasticsearch;
    let elasticSearchUrl = elasticSearchConfig.url + 'annonces/annonce/' + annonceId;
    let elasticSearchMethod = annonceData ? 'POST' : 'DELETE';
    console.log('Body compiled ', annonceData, _.pick(annonceData, elasticsearchFields));
    let elasticsearchRequest = {
        method: elasticSearchMethod,
        uri: elasticSearchUrl,
        auth: {
            username: elasticSearchConfig.username,
            password: elasticSearchConfig.password,
        },
        body: _.pick(annonceData, elasticsearchFields),
        json: true
    };
    return request(elasticsearchRequest).then(response => {
        console.log('Elasticsearch response', response);
    });
});
//# sourceMappingURL=index.js.map