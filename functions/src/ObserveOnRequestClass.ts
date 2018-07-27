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

    // On envoie pas le timestamp à Elasticsearch, car cette donnée n'est utilisée que pour voir quand la request a été créé
    private static deleteTimestamp(req: any): any {
        if (!isUndefined(req.timestamp)) {
            delete req['timestamp'];
        }
    }

    // Lorsque l'on fait un tri sur le titre, il faut remplacer titre par titre.keyword pour qu'Elasticsearch fasse la bonne requête.
    private static changeToKeywordTitre(req: any): any {
        let jsonSortString = JSON.stringify(req.sort);
        if (jsonSortString.includes("titre")) {
            jsonSortString = jsonSortString.replace("titre", "titre.keyword");
            req.sort = JSON.parse(jsonSortString);
        }
    }

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
            if (requestData || !isUndefined(requestData.results) || !isUndefined(requestData.no_results)) {
                return true;
            }

            ObserveOnRequestClass.deleteTimestamp(requestData);
            ObserveOnRequestClass.changeToKeywordTitre(requestData);

            // Construction de la requête ES
            const elasticsearchRequest = {
                method: 'POST',
                uri: elasticSearchConfig.url + 'annonces/_search',
                auth: {
                    username: elasticSearchConfig.username,
                    password: elasticSearchConfig.password,
                },
                body: requestData,
                json: true
            };

            // Lancement de la recherche
            return ObserveOnRequestClass.callElasticsearch(elasticsearchRequest, snapshot);
        }
    );
}
