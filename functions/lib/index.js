"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const admin = require("firebase-admin");
var ServerValue = admin.database.ServerValue;
const functions = require('firebase-functions');
const request = require('request-promise');
const elasticSearchConfig = functions.config().elasticsearch;
admin.initializeApp();
const db = admin.database();
function getServerTimestamp() {
    return new Promise((resolve, reject) => {
        db.ref('timestamp').child('now').set(ServerValue.TIMESTAMP, function (error) {
            if (error) {
                reject(error);
            }
            else {
                db.ref('timestamp').child('now').once('value').then((data) => {
                    resolve(data.val());
                }, (error1) => {
                    reject(error1);
                });
            }
        }).catch(reason => reject(new Error(reason)));
    });
}
function indexation(annonce) {
    const annonceId = annonce.uuid;
    console.log('Indexing annonce ', annonceId, annonce);
    const elasticsearchRequest = {
        method: 'POST',
        uri: elasticSearchConfig.url + 'annonces/annonce/' + annonceId,
        auth: {
            username: elasticSearchConfig.username,
            password: elasticSearchConfig.password,
        },
        body: annonce,
        json: true
    };
    return request(elasticsearchRequest);
}
// Function d'indexation des annonces
exports.indexAnnonceToElastic = functions.database.ref('/annonces/{annonceId}/')
    .onWrite((data, context) => {
    const annonceData = data.after.val();
    const annonceId = context.params.annonceId;
    console.log('Indexing annonce ', annonceId, annonceData);
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
    return request(elasticsearchRequest)
        .then(response => {
        console.log('Elasticsearch response', response);
    })
        .catch(reason => console.error('Houla ca va pas du tout la !' + reason.message));
});
// TODO finir cette Cloud Function
// Cloud function qui permettra de supprimer l'index annonces sur ES
// Relire toutes la DB sur Firebase Database et réindexer toutes les annonces
exports.reindexElasticsearch = functions.https.onRequest((req, res) => {
    const deleteAnnoncesIndex = {
        method: 'DELETE',
        uri: elasticSearchConfig.url + 'annonces',
        auth: {
            username: elasticSearchConfig.username,
            password: elasticSearchConfig.password,
        }
    };
    return request(deleteAnnoncesIndex)
        .then(response => {
        console.log('Suppression de l\'index annonces réussi', response);
        db.ref('/annonces').once('value', listAnnonces => {
            console.log('Liste des annonces à réindexer : ' + listAnnonces.val());
            if (listAnnonces.forEach(annonce => {
                indexation(annonce)
                    .then(response => console.log('Elasticsearch response', response))
                    .catch(reason => console.error('Houla ca va pas du tout la !' + reason.message));
                return true;
            })) {
                console.log('Tout s\'est bien passé');
                res.status(200).send('OK');
            }
            else {
                console.log('Y a eu un soucis avec la boucle de mise à jour');
                res.status(303).send('FOR LOOP FAIL');
            }
        }).catch(reason => console.error(new Error(reason)));
    })
        .catch(reason => console.error('Suppression de l\'index échouée' + reason.message));
});
// Observe /requests childs on Firebase Database.
// Call ElasticSearch with the query parameters and write the result from ES to /requests/{requestId}/results in Firebase Database
// Or set /requests/{requestId}/no_results = true if no result is return by Elasticsearch
// This way the mobile application never talk to ES directly
exports.observeRequest = functions.database.ref('/requests/{requestId}/')
    .onCreate((snapshot, context) => {
    // Récupération de la requête et de son Id
    const requestData = snapshot.val();
    const requestId = context.params.requestId;
    console.log('Request ', requestId, requestData);
    // We want avoid infinite loop, so we continue only if requestData !== null && results has not been set already.
    if (requestData && util_1.isUndefined(requestData.results) && util_1.isUndefined(requestData.no_results)) {
        // On envoie pas le timestamp à Elasticsearch, car cette donnée n'est utilisée que pour voir quand la request a été créé
        if (!util_1.isUndefined(requestData.timestamp)) {
            delete requestData['timestamp'];
        }
        // Lorsque l'on fait un tri sur le titre, il faut remplacer titre par titre.keyword pour qu'Elasticsearch fasse la bonne requête.
        let jsonSortString = JSON.stringify(requestData.sort);
        if (jsonSortString.includes("titre")) {
            jsonSortString = jsonSortString.replace("titre", "titre.keyword");
            requestData.sort = JSON.parse(jsonSortString);
        }
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
        return request(elasticsearchRequest).then(resp => {
            // Récupération du résultat et écriture dans notre FirebaseDatabase
            const hits = resp.hits.hits;
            console.log("Response", resp);
            if (!util_1.isUndefined(resp.hits.hits) && (resp.hits.hits.length > 0)) {
                snapshot.ref.child('results').set(hits)
                    .then(value => console.log('Insertion réussie'))
                    .catch(a => console.error('Insertion dans results échouée : ' + a.message));
            }
            else {
                snapshot.ref.child('no_results').set(true)
                    .then(value => console.log('Insertion réussie : aucun élément trouvé'))
                    .catch(a => console.error('Insertion dans results échouée : ' + a.message));
            }
        }).catch(reason => console.error('Houla ca va pas du tout la !' + reason.message));
    }
    else {
        return true;
    }
});
// Cloud function qui sera appelée toutes les 5 minutes pour supprimer les requests qui ont plus de 1 minutes
exports.deleteOutdatedRequests = functions.https.onRequest((req, res) => {
    return getServerTimestamp().then(serverTimestamp => {
        // Liste toutes les requêtes rangées par timestamp
        db.ref('/requests/').orderByChild('timestamp').once('value', listRequests => {
            console.log('Liste des requêtes à traiter : ' + listRequests.val());
            // Parcourt de la liste des requêtes pour savoir celles qui sont à supprimer
            if (listRequests.forEach(fbRequest => {
                if (serverTimestamp > Number(fbRequest.child('timestamp').val()) + 60 * 1000) {
                    fbRequest.ref.remove()
                        .then(value => console.log('Requête supprimée car trop longue : ' + value))
                        .catch(reason => console.error(new Error('Une requête n\' pas pu être supprimée. Raisons : ' + reason)));
                }
                return true;
            })) {
                console.log('Tout s\'est bien passé');
                res.status(200).send('OK');
            }
            else {
                console.log('Y a eu un soucis avec la boucle de mise à jour');
                res.status(303).send('FOR LOOP FAIL');
            }
        }).catch(reason => {
            console.log('Y a eu un soucis avec la lecture de la liste');
            res.status(303).send(reason);
        });
    });
});
//# sourceMappingURL=index.js.map