import * as fbfunctions from 'firebase-functions';

const _ = require('lodash');
const request = require('request-promise');

exports.indexAnnonceToElastic = fbfunctions.database.ref('/annonces/{annonceId}')
    .onWrite(event => {
        let annonceData = event.data.val();
        let annonceId   = event.params.annonceId;

        console.log('Indexing annonce ', annonceId, annonceData);

        let elasticsearchFields = ['model','manufacturer','description','transmission_type','fuel_type','noise_level',
            'euro_standard','year','co2','noise_level','urban_metric','extra_urban_metric','combined_metric'];
        let elasticSearchConfig = fbfunctions.config().elasticsearch;
        let elasticSearchUrl = elasticSearchConfig.url + 'annonces/annonce/' + annonceId;
        let elasticSearchMethod = annonceData ? 'POST' : 'DELETE';

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
        })

    });