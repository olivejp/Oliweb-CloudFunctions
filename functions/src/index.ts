import * as fbfunctions from 'firebase-functions';
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

        console.log('Body compiled ', annonceData, _.pick(annonceData));

        const elasticsearchRequest = {
            method: elasticSearchMethod,
            uri: elasticSearchUrl,
            auth: {
                username: elasticSearchConfig.username,
                password: elasticSearchConfig.password,
            },
            body: _.pick(annonceData),
            json: true
        };

        return request(elasticsearchRequest).then(response => {
            console.log('Elasticsearch response', response);
        })

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
        if (requestData.results === null) {

            console.log('Request ', requestId, requestData);

            const elasticSearchConfig = fbfunctions.config().elasticsearch;

            // Définition d'un client elasticsearch
            const client = new elasticsearch.Client({
                host: [{
                    host: elasticSearchConfig.url,
                    auth: elasticSearchConfig.username + ':' + elasticSearchConfig.password,
                }],
                log: 'debug'
            });


            // Récupération des paramètres de notre recherche
            const pageNum = requestData.page;
            const perPage = requestData.perPage;
            const search_query = requestData.searchQuery;

            // Lancement de la recherche
            client.search({
                index: 'annonces',
                type: 'annonce',
                from: (pageNum - 1) * perPage,
                size: perPage,
                body: {
                    query: {
                        multi_match: {
                            query: search_query,
                            fields: '["titre^3","description"]'
                        }
                    }
                }
            }).then(resp => {
                // Récupération du résultat et écriture dans notre FirebaseDatabase
                const hits = resp.hits.hits;
                return event.data.child('results').ref.set(hits, a => {
                    console.log('Insertion dans results échouée : ' + a.message);
                });
            }, reason => console.log(reason.message));
        }
    });