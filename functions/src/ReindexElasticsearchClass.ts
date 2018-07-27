const functions = require('firebase-functions');
import {HttpsFunction} from "firebase-functions";
import * as admin from "firebase-admin";

try {
    admin.initializeApp(functions.config().firebase);
} catch (e) {
}
const request = require('request-promise');
const db = admin.database();
const elasticIndexName: string = 'biloutes';
const elasticSearchConfig = functions.config().elasticsearch;
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

export default class ReindexElasticsearchClass {

    private static indexation(annonce: any): Promise<any> {
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
    };

    private static deleteIndex(): Promise<any> {
        const deleteAnnoncesIndex = {
            method: 'DELETE',
            uri: elasticSearchConfig.url + elasticIndexName,
            auth: {
                username: elasticSearchConfig.username,
                password: elasticSearchConfig.password,
            }
        };
        return request(deleteAnnoncesIndex);
    }

    private static createIndex(): Promise<any> {
        const createAnnoncesIndex = {
            method: 'PUT',
            uri: elasticSearchConfig.url + elasticIndexName,
            auth: {
                username: elasticSearchConfig.username,
                password: elasticSearchConfig.password,
            },
            body: JSON.stringify(mappings)
        };
        return request(createAnnoncesIndex);
    }

    private static listAnnonceToIndex() {
        db.ref('/annonces').once('value')
            .then((snapshotListAnnonces) => {
                const listAnnonce = snapshotListAnnonces.val();
                console.log('Liste des annonces à réindexer : ' + listAnnonce);

                // Pour chaque annonce, j'indexe dans ES
                for (const annonces of listAnnonce) {
                    ReindexElasticsearchClass.indexation(annonces)
                        .then(indexationResponse => console.log('Elasticsearch response', indexationResponse))
                        .catch(reason => console.error('Houla ca va pas du tout la !' + reason.message));
                }
            })
            .catch((reason) => console.error(new Error(reason)));
    }

    // TODO Finir cette méthode
    public static reindexElasticsearchHttpsFunction: HttpsFunction = functions.https.onRequest((req, res) => {
        return new Promise((resolve, reject) => {
            if (req.method !== 'POST') {
                res.status(405).send('Méthode non autorisée');
                reject('Méthode non autorisée');
                return null;
            }

            if (req.get('user') !== functions.config().reindex.user || req.get('password') !== functions.config().reindex.password) {
                res.status(403).send('Utilisateur non autorisé');
                reject('Utilisateur non autorisé');
                return null;
            }


            // Suppression de l'index
            ReindexElasticsearchClass.deleteIndex()
                .then(response => {
                    console.log('Suppression de l\'index ' + elasticIndexName + ' réussi', response);
                    ReindexElasticsearchClass.createIndex();
                })
                .catch(reason => {
                    if (reason.error.status === 404) {
                        ReindexElasticsearchClass.createIndex();
                    } else {
                        console.error('Suppression de l\'index ' + elasticIndexName + ' échouée : ' + reason.message);
                    }
                });
        });
    })

}
