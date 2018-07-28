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
            uri: elasticSearchConfig.url + elasticIndexName + '/annonce/' + annonceId,
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
        console.log('Call method deleteIndex');
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
        console.log('Call method createIndex');
        const createAnnoncesIndex = {
            headers: {
                'Content-Type': 'application/json'
            },
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

    // TODO méthode pas encore totalement opérationnelle
    private static listAnnonceToIndex(): Promise<any> {
        console.log('Call method listAnnonceToIndex');
        return db.ref('/annonces').once('value').then((snapshotListAnnonces) => {
            const listPromiseIndex = [];
            snapshotListAnnonces.forEach(annonceSnapshot =>{
                listPromiseIndex.push(ReindexElasticsearchClass.indexation(annonceSnapshot.val()));
                return true;
            });
            return Promise.all(listPromiseIndex);
        });
    }

    private static createAndReindex(): Promise<any> {
        console.log('Call method createAndReindex');
        return ReindexElasticsearchClass.createIndex()
            .then(value => {
                return ReindexElasticsearchClass.listAnnonceToIndex();
            })
            .catch(reason => console.log(reason));
    }

    public static reindexElasticsearchHttpsFunction: HttpsFunction = functions.https.onRequest(async (req, res) => {
        if (req.method !== 'POST') {
            res.status(405).send('Méthode non autorisée');
            return null;
        }

        if (req.get('user') !== functions.config().reindex.user || req.get('password') !== functions.config().reindex.password) {
            res.status(403).send('Utilisateur non autorisé');
            return null;
        }

        await ReindexElasticsearchClass.deleteIndex()
            .then((response) => {
                console.log('Delete the index successfully');
            })
            .catch((reason) => {
                console.error(reason);
            });

        ReindexElasticsearchClass.createAndReindex()
            .then(value => res.status(200).send())
            .catch(reason => {
                console.error(reason);
                res.status(500).send();
            });
    })
}
