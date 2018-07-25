import {CloudFunction} from "firebase-functions";
import * as admin from "firebase-admin";
import * as request  from "request-promise";
import DataSnapshot = admin.database.DataSnapshot;

const functions = require('firebase-functions');
const elasticSearchConfig = functions.config().elasticsearch;

export default class IndexationAnnonceClass {
    public static indexationCloudFunction: CloudFunction<DataSnapshot> = functions.database.ref('/annonces/{annonceId}/')
        .onWrite((data, context) => {
            const annonceData = data.after.val();
            const annonceId = context.params.annonceId;
            const elasticSearchUrl = elasticSearchConfig.url + 'annonces/annonce/' + annonceId;
            const elasticSearchMethod = annonceData ? 'POST' : 'DELETE';
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

            return request(elasticsearchRequest)
                .then(response => {
                    console.log('Elasticsearch response', response);
                })
                .catch(reason => console.error('Houla ca va pas du tout la !' + reason.message));
        });
}
