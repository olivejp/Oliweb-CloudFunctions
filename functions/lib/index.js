"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fbfunctions = require("firebase-functions");
const util_1 = require("util");
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
    console.log('Request ', requestId, requestData);
    // We want avoid infinite loop, so we continue only if requestData !== null && results has not been set already.
    if (requestData && util_1.isUndefined(requestData.results) && util_1.isUndefined(requestData.no_results)) {
        const elasticSearchConfig = fbfunctions.config().elasticsearch;
        // Lancement de la recherche
        const elasticSearchUrl = elasticSearchConfig.url + 'annonces/_search';
        const elasticsearchRequest = {
            method: 'POST',
            uri: elasticSearchUrl,
            auth: {
                username: elasticSearchConfig.username,
                password: elasticSearchConfig.password,
            },
            body: requestData,
            json: true
        };
        return request(elasticsearchRequest).then(resp => {
            // Récupération du résultat et écriture dans notre FirebaseDatabase
            const hits = resp.hits.hits;
            console.log("Response", resp);
            if (resp.hits.total > 0) {
                event.data.ref.child('results').set(hits)
                    .then(value => console.log('Insertion réussie'))
                    .catch(a => console.log('Insertion dans results échouée : ' + a.message));
            }
            else {
                event.data.ref.child('no_results').set(true)
                    .then(value => console.log('Insertion réussie : aucun élément trouvé'))
                    .catch(a => console.log('Insertion dans results échouée : ' + a.message));
            }
        }).catch(reason => console.log('Houla ca va pas du tout la !' + reason.message));
    }
    else {
        return true;
    }
});
//# sourceMappingURL=index.js.map