"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fbfunctions = require("firebase-functions");
const elasticsearch = require('elasticsearch');
const _ = require('lodash');
const request = require('request-promise');
// Function d'indexation des annonces
exports.indexAnnonceToElastic = fbfunctions.database.ref('/annonces/{annonceId}/')
    .onWrite(event => {
    const annonceData = event.data.val();
    const annonceId = event.params.annonceId;
    console.log('Indexing annonce ', annonceId, annonceData);
    const elasticSearchConfig = fbfunctions.config().elasticsearch;
    const elasticSearchUrl = elasticSearchConfig.url + 'annonces/annonce/' + annonceId;
    const elasticSearchMethod = annonceData ? 'POST' : 'DELETE';
    console.log('Body compiled ', annonceData);
    const elasticsearchRequest = {
        method: elasticSearchMethod,
        uri: elasticSearchUrl,
        auth: {
            username: elasticSearchConfig.username,
            password: elasticSearchConfig.password,
        },
        body: annonceData,
        json: true
    };
    return request(elasticsearchRequest).then(response => {
        console.log('Elasticsearch response', response);
    });
});
// Observe /requests child on Firebase Database.
// Call ElasticSearch with the query parameters and write the result from ES to /requests/{requestId}/results in Firebase Database.
// This way the mobile application never talk to ES directly
exports.observeRequest = fbfunctions.database.ref('/requests/{requestId}/')
    .onWrite(event => {
    // Récupération de la requête et de son Id
    const requestData = event.data.val();
    const requestId = event.params.requestId;
    // We want avoid infinite loop, so we continue only if results === null
    console.log('Request ', requestId, requestData);
    const elasticSearchConfig = fbfunctions.config().elasticsearch;
    // Récupération des paramètres de notre recherche
    const pageNum = requestData.page;
    const perPage = requestData.perPage;
    const search_query = requestData.searchQuery;
    console.log(pageNum, perPage, search_query);
    // Lancement de la recherche
    const elasticSearchUrl = elasticSearchConfig.url + 'annonces/_search';
    const elasticsearchRequest = {
        method: 'POST',
        uri: elasticSearchUrl,
        auth: {
            username: elasticSearchConfig.username,
            password: elasticSearchConfig.password,
        },
        body: {
            from: (pageNum - 1) * perPage,
            size: perPage,
            query: {
                multi_match: {
                    query: search_query,
                    fields: ['titre', 'description']
                }
            }
        },
        json: true
    };
    return request(elasticsearchRequest).then(resp => {
        // Récupération du résultat et écriture dans notre FirebaseDatabase
        const hits = resp.hits.hits;
        console.log('Response', resp);
        console.log("Here are the hits => " + hits._source);
        if (hits !== null) {
            event.data.ref.child('results').set(hits)
                .then(value => console.log('Insertion réussie'))
                .catch(a => console.log('Insertion dans results échouée : ' + a.message));
        }
        else {
            console.log('Rien a retourner');
        }
    }).catch(reason => console.log('Houla ca va pas du tout la !' + reason.message));
});
//# sourceMappingURL=index.js.map