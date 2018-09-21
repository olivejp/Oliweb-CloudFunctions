import {CloudFunction} from "firebase-functions";
import * as admin from "firebase-admin";
import * as request from "request-promise";
import {isUndefined} from "util";

const functions = require('firebase-functions');
try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}
import DataSnapshot = admin.database.DataSnapshot;

const elasticSearchConfig = functions.config().elasticsearch;

export default class ObserveOnRequestClass {

    private static async callElasticsearch(elasticsearchRequest: any, snapshot: any) {
        return request(elasticsearchRequest)
            .then(resp => {
                // Récupération du résultat et écriture dans notre FirebaseDatabase
                const hits = resp.hits.hits;
                console.log("Response", resp);

                if (!isUndefined(resp.hits.hits) && (resp.hits.hits.length > 0)) {
                    snapshot.ref.child('results').set(hits)
                        .then(value => console.log('Insertion réussie'))
                        .catch(a => console.error('Insertion dans results échouée : ' + a.message));
                } else {
                    snapshot.ref.child('no_results').set(true)
                        .then(value => console.log('Insertion réussie : aucun élément trouvé'))
                        .catch(a => console.error('Insertion dans results échouée : ' + a.message));
                }
            })
            .catch(reason => console.error('Houla ca va pas du tout la !' + reason.message));
    }

    public static observeOnRequestCloudFunction: CloudFunction<DataSnapshot> = functions.database.ref('/requests/{requestId}/').onCreate((snapshot) => {
            const requestData = snapshot.val();

            // We want avoid infinite loop, so we continue only if requestData !== null && results has not been set already.
            if (!requestData || !isUndefined(requestData.results) || !isUndefined(requestData.no_results)) {
                return true;
            }

            // Construction de la requête ES
            const elasticsearchRequest = {
                method: 'POST',
                uri: elasticSearchConfig.url + 'annonces/_search',
                auth: {
                    username: elasticSearchConfig.username,
                    password: elasticSearchConfig.password,
                },
                body: JSON.parse(requestData.request),
                json: true
            };

            // Lancement de la recherche
            return ObserveOnRequestClass.callElasticsearch(elasticsearchRequest, snapshot);
        }
    );
}
