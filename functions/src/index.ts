import {isUndefined} from "util";
import * as admin from "firebase-admin";
import ServerValue = admin.database.ServerValue;

const functions = require('firebase-functions');
const request = require('request-promise');
const elasticSearchConfig = functions.config().elasticsearch;
const elasticIndexName: string = 'biloutes';

// TODO sortir cet objet dans un fichier ressource et y faire référence.
const mappings = {
    "settings": {
        "index": {
            "number_of_shards": 5,
            "number_of_replicas": 1
        }
    },
    "mappings": {
        "annonce": {
            "properties": {
                "categorie": {
                    "properties": {
                        "id": {
                            "type": "long"
                        },
                        "libelle": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        }
                    }
                },
                "contactEmail": {
                    "type": "boolean"
                },
                "contactMsg": {
                    "type": "boolean"
                },
                "contactTel": {
                    "type": "boolean"
                },
                "datePublication": {
                    "type": "long"
                },
                "description": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "photos": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "prix": {
                    "type": "long"
                },
                "titre": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "utilisateur": {
                    "properties": {
                        "email": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        },
                        "profile": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        },
                        "telephone": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        },
                        "uuid": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        }
                    }
                },
                "uuid": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                }
            }
        }
    }
};

admin.initializeApp();

const db = admin.database();

function getServerTimestamp(): Promise<number> {
    return new Promise((resolve, reject) => {
        db.ref('timestamp').child('now').set(ServerValue.TIMESTAMP, function (error) {
            if (error) {
                reject(error);
            } else {
                db.ref('timestamp').child('now').once('value').then(
                    (data) => {
                        resolve(data.val());
                    }, (error1) => {
                        reject(error1);
                    }
                );
            }
        }).catch(reason => reject(new Error(reason)))
    });
}

function indexation(annonce: any): Promise<any> {
    const annonceId = annonce.uuid;

    console.log('Indexing annonce ', annonceId, annonce);
    const elasticsearchRequest = {
        method: 'POST',
        uri: elasticSearchConfig.url + '/' + elasticIndexName + '/annonce/' + annonceId,
        auth: {
            username: elasticSearchConfig.username,
            password: elasticSearchConfig.password,
        },
        body: annonce,
        json: true
    };

    return request(elasticsearchRequest);
}

//
// // TODO Terminer cette function
// // Cloud function permettant d'envoyer une notification
// // Dès que quelqu'un reçoit un message.
// exports.observeRequest = functions.database.ref('/messages/{chatId}/{messageId}')
//     .onCreate((snapshot, context) => {
//
//         // Récupération de la requête et de son Id
//         const messageData = snapshot.val();
//         const chatId = context.params.chatId;
//         const messageId = context.params.messageId;
//         const authorId = messageData.uidAuthor;
//
//         console.log('Message envoyé ', messageId, messageData);
//
//         // Récupération du chat
//         const db.ref('/chats/${chatId}').once('value')
//             .catch(reason => console.error(new Error(reason)))
//             .then(chatData => {
//
//                 // Récupération du tableau des membres participants au chat
//                 let mapMembers: Map<string, boolean> = new Map<string, boolean>();
//                 Object.keys(chatData.members).forEach(key => {
//                     if (chatData.members[key] === true) {
//                         this.mapMembers.set(key, chatData.members[key]);
//                     }
//                 });
//
//                 // Déduction des receveurs de la notification (tous sauf l'auteur)
//                 let receiverIds = [];
//                 for (let memberId: string of mapMembers.keys()){
//                     if (memberId !== authorId) {
//                         receiverIds.push(memberId);
//                     }
//                 }
//
//                 // Récupération du token dans les paramètres des utilisateurs
//                 // TODO voir la solution proposée ici https://stackoverflow.com/questions/39875243/promises-in-the-foreach-loop-typescript-2
//                 const tokens = [];
//                 function searchTokens(receiverIds): Promise<any>{
//                     let promiseArray: Array<any> = [];
//                     for(let userId: string of receiverIds) {
//                         promiseArray.push()
//                         const db.ref('/users/${userId}').once('value')
//                             .catch(reason => console.error(new Error(reason)))
//                             .then(user => {
//                                 tokens.push(user.tokenDevice)
//                             });
//                     }
//                     return Promise.all(promiseArray);
//                 }
//
//                 searchTokens(receiverIds).then(value => {
//
//                 });
//
//                 // Notification details.
//                 const payload = {
//                     notification: {
//                         title: 'You have a new follower!',
//                         body: '${follower.displayName} is now following you',
//                         icon: follower.photoURL
//                     }
//                 };
//             });
//
//         return admin.messaging().sendToDevice(token, payload);
//
//     });

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

// Cloud function qui permettra de supprimer l'index annonces sur ES
// Relire toutes la DB sur Firebase Database et réindexer toutes les annonces
exports.reindexElasticsearch = functions.https.onRequest((req, res) => {
    return new Promise((resolve, reject) => {
        if (req.method !== 'POST') {
            res.status(405).send('Méthode non autorisée');
            reject('Méthode non autorisée');
            return this;
        }

        if (req.get('user') !== functions.config().reindex.user || req.get('password') !== functions.config().reindex.password) {
            res.status(403).send('Utilisateur non autorisé');
            reject('Utilisateur non autorisé');
            return this;
        }

        function createIndex() {
            const createAnnoncesIndex = {
                method: 'PUT',
                uri: elasticSearchConfig.url + elasticIndexName,
                auth: {
                    username: elasticSearchConfig.username,
                    password: elasticSearchConfig.password,
                },
                body: JSON.stringify(mappings)
            };

            // Création de notre nouvel index
            request(createAnnoncesIndex)
                .then((value) => {
                    // Lecture de toutes les annonces
                    db.ref('/annonces').once('value')
                        .then((listAnnonces) => {
                            console.log('Liste des annonces à réindexer : ' + listAnnonces.val());

                            // Pour chaque annonce, j'indexe dans ES
                            for (const annonces of listAnnonces) {
                                indexation(annonces)
                                    .then(indexationResponse => console.log('Elasticsearch response', indexationResponse))
                                    .catch(reason => console.error('Houla ca va pas du tout la !' + reason.message));
                            }
                        })
                        .catch((reason) => console.error(new Error(reason)));
                })
                .catch((reason) => console.error('Création de l\'index ' + elasticIndexName + ' échouée : ' + reason.message));
        }

        // Suppression de l'index
        const deleteAnnoncesIndex = {
            method: 'DELETE',
            uri: elasticSearchConfig.url + elasticIndexName,
            auth: {
                username: elasticSearchConfig.username,
                password: elasticSearchConfig.password,
            }
        };
        request(deleteAnnoncesIndex)
            .then(response => {
                console.log('Suppression de l\'index ' + elasticIndexName + ' réussi', response);
                createIndex();
            })
            .catch(reason => {
                if (reason.error.status === 404) {
                    createIndex();
                } else {
                    console.error('Suppression de l\'index ' + elasticIndexName + ' échouée : ' + reason.message);
                }
            });
    });
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
            if (requestData && isUndefined(requestData.results) && isUndefined(requestData.no_results)) {

                // On envoie pas le timestamp à Elasticsearch, car cette donnée n'est utilisée que pour voir quand la request a été créé
                if (!isUndefined(requestData.timestamp)) {
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

                    if (!isUndefined(resp.hits.hits) && (resp.hits.hits.length > 0)) {
                        snapshot.ref.child('results').set(hits)
                            .then(value => console.log('Insertion réussie'))
                            .catch(a => console.error('Insertion dans results échouée : ' + a.message));
                    } else {
                        snapshot.ref.child('no_results').set(true)
                            .then(value => console.log('Insertion réussie : aucun élément trouvé'))
                            .catch(a => console.error('Insertion dans results échouée : ' + a.message));
                    }

                }).catch(reason => console.error('Houla ca va pas du tout la !' + reason.message));
            } else {
                return true;
            }
        }
    );

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
                        .catch(reason => console.error(new Error('Une requête n\' pas pu être supprimée. Raisons : ' + reason)))
                }
                return true;
            })) {
                console.log('Tout s\'est bien passé');
                res.status(200).send('OK');
            } else {
                console.log('Y a eu un soucis avec la boucle de mise à jour');
                res.status(303).send('FOR LOOP FAIL');
            }
        }).catch(reason => {
            console.log('Y a eu un soucis avec la lecture de la liste');
            res.status(303).send(reason);
        })
    });
});